# Space.Service.Verification — Comprehensive Service Analysis

> **Generated:** 2025-04-02 | **Codebase Commit:** latest on `main`

---

## Table of Contents

- [1. Service Overview](#1-service-overview)
- [2. Architecture](#2-architecture)
- [3. Tech Stack & Frameworks](#3-tech-stack--frameworks)
- [4. API Layer & Communication](#4-api-layer--communication)
- [5. Middleware & Pipeline](#5-middleware--pipeline)
- [6. Data Layer](#6-data-layer)
- [7. Messaging & Event Handling](#7-messaging--event-handling)
- [8. Background Jobs & Scheduled Tasks](#8-background-jobs--scheduled-tasks)
- [9. Cross-Cutting Concerns](#9-cross-cutting-concerns)
- [10. Testing](#10-testing)
- [11. DevOps & Deployment](#11-devops--deployment)
- [12. External Service Dependencies](#12-external-service-dependencies)
- [13. Key Technical Decisions & Patterns Summary](#13-key-technical-decisions--patterns-summary)

---

## 1. Service Overview

### Service Name & Purpose

**Space.Service.Verification** is an identity and liveness verification microservice that handles biometric verification, document validation, and face comparison during customer onboarding, loan disbursement, phone number changes, and other sensitive operations for a digital banking platform operating in Uzbekistan.

### Domain Context

This service represents the **Identity Verification** bounded context. It is responsible for verifying customer identities through biometric liveness checks, document validation against national registries, and facial similarity comparison. It acts as the orchestrator between external verification providers (Identomat, OZ Forensics) and the national registry system.

### Key Entities & Domain Models

| Entity | Primary Key | Description |
|--------|------------|-------------|
| `Session` | `string` | Represents a verification session — tracks the lifecycle of a single verification attempt including provider, status, similarity score, and associated metadata |
| `SessionMedia` | Composite (`Id`, `MediaType`) | Stores references (S3 keys) to media files captured during verification (selfies, ID card images, videos) |
| `Customer` | `string` | Customer profile with personal identity data, document details, and verification status flags |
| `SessionBlock` | `int` | Records when a user is blocked from a specific session type (e.g., after too many failed attempts) |
| `ActiveUser` | `int` | Tracks users who have logged in and need periodic document re-validation |

### Main Use Cases & Workflows

1. **Customer Onboarding Verification** — Full identity verification flow: liveness check → document capture → national registry validation → face comparison
2. **Loan Disbursement Verification** — Re-verification before loan disbursement via liveness check and face comparison against onboarding selfie
3. **Phone Number Change Verification** — Identity re-verification for logged-out or profile-level phone number changes (supports both Identomat and OZ Forensics providers)
4. **Document Validation** — On-demand document checks against the national registry (for both residents and non-residents)
5. **Periodic Document Re-validation** — Background worker that periodically re-checks active users' document validity against the national registry
6. **Session Data Support** — Internal endpoints for support teams to query verification session history and media

---

## 2. Architecture

### Architectural Pattern

The service follows **Clean Architecture** combined with **CQRS** (Command/Query Responsibility Segregation) using MediatR. This is evidenced by:

- **Strict layer separation** with dependency inversion — the Domain layer has zero references to any other layer
- **Feature-based organization** within the Application layer under `Features/` with dedicated `Commands/` and `Queries/` subfolders
- **Unidirectional dependency flow** enforced by architecture tests using `NetArchTest.Rules`

The architecture flow is:

```
Controller → IMediator → Command/Query Handler → Services/Repositories → DbContext/External APIs
```

### Project Structure Breakdown

| Project | Responsibility |
|---------|---------------|
| `Space.Service.Verification.Api` | HTTP entry point — controllers, middleware pipeline, authentication, Swagger, Prometheus metrics |
| `Space.Service.Verification.Application` | Business logic — CQRS handlers, validators, service interfaces, repository interfaces, HttpClient interfaces, DTOs, events, options |
| `Space.Service.Verification.Domain` | Pure domain model — entities, enums, constants, domain extensions. No external dependencies beyond common base classes |
| `Space.Service.Verification.Infrastructure` | Infrastructure concerns — external API client implementations (Identomat, OZ Forensics wrappers), media processing, email service, background workers, datetime service |
| `Space.Service.Verification.Persistence` | Data access — EF Core DbContext, entity configurations, repository implementations, migrations, seeder |
| `Space.Service.Verification.UnitTests` | Unit tests for all layers with mocked dependencies |
| `Space.Service.Verification.ComponentTests` | Integration tests using `WebApplicationFactory`, WireMock, and in-memory database |
| `Space.Service.Verification.ArchitectureTests` | Architecture enforcement tests validating layer dependency rules and naming conventions |
| `Space.Service.Verification.CITools` | CI tooling — domain model JSON generation for pipeline use |

### Dependency Flow

```
Api ──────────┬──→ Application ──→ Domain
              ├──→ Infrastructure ──→ Application ──→ Domain
              └──→ Persistence ──→ Application ──→ Domain
```

- **Domain** depends on nothing (only `Space.Service.Common.Persistence`, `Space.Service.Common.Logging`, `Space.Service.Common.Otp`, `Space.Service.Common.Misc`)
- **Application** depends only on Domain
- **Infrastructure** depends on Application (and transitively Domain)
- **Persistence** depends on Application (and transitively Domain)
- **Api** depends on Application, Infrastructure, and Persistence

### CQRS Implementation

Commands and Queries are organized under `Application/Features/{FeatureName}/Commands/` and `Application/Features/{FeatureName}/Queries/`:

- **Commands** implement `IRequest` or `IRequest<TResponse>` and represent state-changing operations (e.g., `CheckSessionCommand`, `AuthorizeCommand`, `CreateCustomerCommand`)
- **Queries** implement `IRequest<TResponse>` and represent read-only operations (e.g., `GetVerificationStatusQuery`, `GetSessionsByUserQuery`)
- **Handlers** extend `RequestHandlerBase<TRequest, TResponse>` (from `Space.Service.Common.Mediator`)
- **MediatR** dispatches all requests through `IMediator` injected into controllers
- **Pipeline Behaviors** are registered in order: `LoggingBehavior<,>` → `ValidationBehavior<,>` — applied to every mediator request

### Architecture Tests Enforcement

The `ArchitectureTests` project enforces 17 rules including:

- Controllers must not depend on Persistence, Domain, or Infrastructure directly
- Controllers must use MediatR and inherit from `ApiControllerBase`
- Domain must not depend on any other layer
- Application must not depend on Persistence or Infrastructure
- Naming conventions for Commands, Queries, Handlers, and Repositories
- `[ConsumeEvent]`-decorated classes must be named `*Command`

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Component | Version |
|-----------|---------|
| .NET | 9.0 |
| C# | Latest (implicit via `net9.0` TFM) |
| Target Framework | `net9.0` |

### Primary Frameworks

| Framework | Version | Source |
|-----------|---------|--------|
| ASP.NET Core 9 | 9.0 | Microsoft.NET.Sdk.Web |
| Entity Framework Core | 9.0.10 | `Microsoft.EntityFrameworkCore.Relational` |
| MediatR | (via `Space.Service.Common.Mediator` 2.9.8) | Application |
| FluentValidation | (via `Space.Service.Common.Mediator`) | Application |

### Significant NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| **Space.Service.Common.Mediator** | 2.9.8 | MediatR + pipeline behaviors (logging, validation) |
| **Space.Service.Common.Auth** | 2.9.9 | IdentityServer + Microsoft Entra ID authentication |
| **Space.Service.Common.EventBus** | 2.9.35 | Kafka-based event bus with outbox pattern |
| **Space.Service.Common.RestClient** | 2.9.23 | RestEase-based typed HTTP client factory |
| **Space.Service.Common.Persistence** | 2.9.13 | Base entity classes, Unit of Work, DB create/migrate helpers |
| **Space.Service.Common.Caching** | 2.9.15 | Distributed caching abstraction (`ISuperCache`) |
| **Space.Service.Common.Storage** | 2.9.3 | Object storage client (S3-compatible) |
| **Space.Service.Common.Middlewares** | 2.9.11 | Standard middleware pipeline (exception handling, correlation ID, etc.) |
| **Space.Service.Common.HealthChecks** | 2.9.10 | Health check endpoints |
| **Space.Service.Common.Swagger** | 2.9.13 | Swagger/OpenAPI configuration |
| **Space.Service.Common.Logging** | 2.9.9 | `[SensitiveData]` attribute, structured logging |
| **Space.Service.Common.Otp** | 2.9.9 | OTP token validation |
| **Space.Service.Common.FeatureToggle** | 2.9.16 | GrowthBook-based feature flags |
| **Space.Service.Common.Factory** | 2.9.9 | Tenant-specific service resolution via `[Service]` attribute |
| **Space.Service.Common.Mapping** | 2.9.2 | Auto-mapping via `IMap` interface |
| **Space.Service.Common.Misc** | 2.9.56 | Shared enums (`Platform`, `Operation`), utilities |
| **Space.Service.Common.EmployeePermissionManagement** | 1.0.27 | Employee permission-based authorization |
| **Space.Service.Common.Workers** | (via Infrastructure) | `PeriodicBackgroundServiceBase`, `CronBackgroundServiceBase` |
| **CsvHelper** | 33.1.0 | CSV report generation for active user document checks |
| **prometheus-net.AspNetCore** | 8.2.1 | Prometheus metrics endpoint |
| **Microsoft.Extensions.Caching.Memory** | 9.0.10 | In-memory caching |
| **StyleCop.Analyzers** | 1.1.118 | Code style enforcement |
| **Space.Service.Common.CodeAnalyzers** | 2.9.6 | Custom analyzers (e.g., `SensitiveDataAnalyzer`) |

### Database

| Component | Technology |
|-----------|-----------|
| Database | **PostgreSQL** (via Npgsql) |
| ORM | Entity Framework Core 9.0.10 |
| Connection string key | `"NpgSql"` |

### Caching

- **Distributed cache**: `ISuperCache` (from `Space.Service.Common.Caching`) — used for rate limiting counters (liveness failure counts, non-resident daily limits) and blocked user sessions
- **In-memory cache**: `Microsoft.Extensions.Caching.Memory` registered in Infrastructure — used for short-lived local lookups

### Logging & Observability

| Component | Technology |
|-----------|-----------|
| Structured logging | **Serilog** (configured via `UseSerilog` in `Program.cs`) |
| APM | `AddApm(configuration)` — likely Elastic APM or similar |
| Metrics | **Prometheus** via `prometheus-net.AspNetCore` (HTTP metrics + `/metrics` endpoint) |
| Sensitive data masking | `[SensitiveData]` attribute + `SensitiveDataUtils.SerializeSensitiveData()` |
| Test log correlation | `Serilog.Sinks.TestCorrelator` (in unit tests) |

---

## 4. API Layer & Communication

### API Style

**REST** over HTTP/HTTPS with JSON payloads. API versioning is supported via URL path segments (`v1`, `v2`, `v3`).

### Endpoints by Controller

#### `LoanController` — `api/v{version}/loan`

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `authorize-session` | Authorized | Authorize OZ Forensics liveness session for loan disbursement |
| `POST` | `check-session` | Authorized | Validate liveness + face comparison for loan session |
| `GET` | `verification-status` | Authorized | Check if user needs re-verification today |
| `POST` | `baas-authorize-session` | Anonymous | BaaS variant — authorize session with explicit `UserId` |
| `POST` | `baas-check-session` | Anonymous | BaaS variant — check loan session |
| `GET` | `baas-verification-status` | Anonymous | BaaS variant — verification status query |

#### `SessionController` — `api/v{version}/session`

| Method | Route | Version | Auth | Purpose |
|--------|-------|---------|------|---------|
| `POST` | `authorize` | v1 | Anonymous | Start OZ Forensics liveness session (by `SessionType`) |
| `POST` | `authorize` | v2 | Anonymous | Start OZ Forensics liveness session (by `Operation`) |
| `POST` | `analyze` | v1 | Authorized | Run liveness analysis + national registry validation |
| `POST` | `compare-face` | v1 | Anonymous | Compare liveness selfie with onboarding photo (by `SessionType`) |
| `POST` | `compare-face` | v2 | Anonymous | Compare faces (by `Operation`) |
| `GET` | `{userId}/sessions` | v1 | Anonymous | Get user's sessions filtered by status/date |
| `GET` | `{userId}/session` | v1 | Anonymous | Get customer's approved onboarding session |
| `GET` | `{userId}/session-media` | v1 | Anonymous | Get base64-encoded onboarding selfie |
| `GET` | `get-session-data-for-support` | v1 | Anonymous | Get detailed session data for support team |

#### `VerificationController` — `api/v{version}/verification`

| Method | Route | Version | Auth | Purpose |
|--------|-------|---------|------|---------|
| `POST` | *(root)* | v1 | Authorized | Full Identomat verification check (onboarding) |
| `POST` | `checkdocument` | v3 | Entra ID + `EmployeePermission` | Document check by employee (anonymous + permission-gated) |
| `POST` | `check-document-unauthorized` | v1 | Anonymous | Document validation by customer ID |
| `POST` | `start-phone-number-change-session` | v1 | Anonymous | Start phone change verification session |
| `POST` | `check-phone-number-change-session` | v1 | Anonymous | Complete phone change verification |
| `GET` | `get-phone-number-change-session` | v1 | Anonymous | Get approved phone change session details |
| `POST` | `start-logged-out-phone-number-change-session` | v1 | Anonymous | **[Obsolete]** — redirects to phone number change |
| `POST` | `check-logged-out-phone-number-change-session` | v1 | Anonymous | **[Obsolete]** — redirects to phone change check |
| `GET` | `get-logged-out-phone-number-change-session` | v1 | Anonymous | **[Obsolete]** |
| `DELETE` | *(root)* | v1 | Anonymous | Delete session (non-production only via `[NonProduction]`) |
| `GET` | `get-liveness-media-file-url` | v1 | Anonymous | Get pre-signed URLs for liveness media files |

### Request/Response Patterns

- **Commands** accept JSON request bodies with FluentValidation
- **Queries** accept parameters via `[FromQuery]` or route parameters
- **Responses** use direct DTO return types (no envelope pattern)
- **DTOs** use `IMap` interface for auto-mapping from domain entities and external responses
- **Sensitive data** properties are annotated with `[SensitiveData]` for log masking

### API Versioning

URL-based versioning: `api/v{version}/...` using `AddVersioning()` from the common library. Controllers declare `[MapToApiVersion("1.0")]`, `[MapToApiVersion("2.0")]`, or `[MapToApiVersion("3.0")]`.

### Authentication & Authorization

| Mechanism | Where Used |
|-----------|-----------|
| **IdentityServer** (JWT Bearer) | Default for `[Authorize]` endpoints — configured via `AddIdentityServerAuthentication` |
| **Microsoft Entra ID** | Used for `CheckDocumentAnonymous` endpoint via `[MicrosoftEntraId]` scheme |
| **Employee Permissions** | `[EmployeePermission("UpdateDocumentInfo")]` attribute for internal admin endpoints |
| **`[AllowAnonymous]`** | Many endpoints are anonymous (service-to-service calls) |
| **JWT generation** | `CompareFaceCommandHandler` generates signed JWTs (`LivenessResultToken`) with 600s expiry containing `userId`, `operation`, `sessionType` |

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

Configured in `Program.cs` → `ConfigureAPI()` in the following order:

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `UsePathBase("/verification")` | Sets the base path for all routes |
| 2 | `UseLocalization()` | Request culture/localization (`ka-GE`, `en-US`, `ru-RU`, `uz-Latn-UZ`) |
| 3 | `UseHttpsRedirection()` | Redirects HTTP → HTTPS |
| 4 | `UseRouting()` | Endpoint routing |
| 5 | `UseHttpMetrics()` | Prometheus HTTP request metrics |
| 6 | `UseAuthentication()` | JWT Bearer + Entra ID authentication |
| 7 | `UseStaticFiles()` | Static file serving (from `wwwroot/`) |
| 8 | `UseAuthorization()` | Authorization policies |
| 9 | `UseMiddlewares()` | Common middleware pipeline (exception handling, correlation ID, request logging, etc.) |
| 10 | `UseHealthCheckMiddleware(env)` | Health check endpoints |
| 11 | `UseEventEndpoints()` | Event bus consumer endpoints (Kafka event ingestion) |
| 12 | `UseVersionEndpoint(configuration)` | Service version endpoint |
| 13 | `MapControllers()` + `MapMetrics()` | Controller routing + Prometheus `/metrics` endpoint |
| 14 | `UseSwagger(env, provider, pathBase)` | Swagger UI (environment-conditional) |

### MediatR Pipeline Behaviors

Registered in `ApplicationExtensions.cs` in this order:

| Order | Behavior | Purpose |
|-------|----------|---------|
| 1 | `LoggingBehavior<TRequest, TResponse>` | Logs request/response with sensitive data masking |
| 2 | `ValidationBehavior<TRequest, TResponse>` | Runs FluentValidation validators before handler execution |

### Global Exception Handling

Handled by `UseMiddlewares()` from `Space.Service.Common.Middlewares`. The common middleware intercepts exceptions and maps them to standardized HTTP error responses. Custom domain exceptions use `Space.Service.Common.Exceptions` (`AppException`, `HttpException`).

### Request Validation

- **FluentValidation** — validators are auto-discovered from the Application assembly via `AssemblyScanning`
- **Display name convention**: camelCase resolver configured globally
- **Pipeline integration**: `ValidationBehavior<,>` runs all registered validators before handler execution
- **`SuppressModelStateInvalidFilter = true`** — model state validation is disabled in favor of FluentValidation through MediatR

### Correlation ID / Request Tracing

Handled by `UseMiddlewares()` from `Space.Service.Common.Middlewares`, which propagates correlation IDs through the request pipeline and into event bus messages.

---

## 6. Data Layer

### Database Type & Provider

| Component | Value |
|-----------|-------|
| Database | PostgreSQL |
| EF Core Provider | `Npgsql.EntityFrameworkCore.PostgreSQL` |
| Connection string key | `NpgSql` |
| EF Core version | 9.0.10 |

### DbContext Configuration

`VerificationDbContext` extends `DbContextBase` (from `Space.Service.Common.Persistence`):

```csharp
public class VerificationDbContext : DbContextBase
{
    public DbSet<Session> Sessions { get; set; }
    public DbSet<SessionMedia> SessionMedias { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<SessionBlock> SessionBlocks { get; set; }
    public DbSet<ActiveUser> ActiveUsers { get; set; }
}
```

Entity configurations are applied via `ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly())`.

### Entity Configurations

| Entity | Table | Key | Column Overrides | Indexes |
|--------|-------|-----|-----------------|---------|
| `Session` | `Sessions` | `Id` (string) | `Data` → `jsonb` | `(Timestamp)`, `(UserId)`, `(DeviceUniqueId, AttemptTimestamp, Type)` |
| `SessionMedia` | `SessionMedias` | Composite `(Id, MediaType)` | — | `(Timestamp)` |
| `Customer` | `Customers` | `Id` (string) | `BirthDate` → `date` | `(DocumentSeries, DocumentNumber, BirthDate)`, `(UserId)` UNIQUE |
| `SessionBlock` | `SessionBlocks` | `Id` (int, identity) | `UserId` → `IsRequired()` | `(UserId, Type)` UNIQUE |
| `ActiveUser` | `ActiveUsers` | `Id` (int, identity) | — | `(UserId, Timestamp)` |

**Notable**: No foreign-key constraints or navigation properties are configured. All entity relationships are handled through query-time joins by convention-matched IDs.

### Migration Strategy

**EF Core Code-First Migrations**. 23 migrations from `2023-06-15` (initial schema) to `2026-03-19` (latest). Migrations are auto-applied on startup via `db.Database.Migrate()` in `ConfigurePersistence()`.

Migration commands:
```bash
dotnet ef migrations add MigrationName \
  --project Space.Service.Verification.Persistence \
  --startup-project Space.Service.Verification.Api
```

### Repository Pattern

The service uses a full **Repository + Unit of Work** pattern:

- **`IRepositoryBase<TEntity, TEntityId>`** — defined in `Application/Repositories/` with generic CRUD operations
- **`RepositoryBase<TEntity, TEntityId>`** — implemented in `Persistence/Repositories/` with EF Core
- **Entity-specific repositories** add domain-specific query methods (e.g., `GetApprovedSessionByType`, `GetCustomerByIdentityInfo`)
- **`IUnitOfWork`** — from `Space.Service.Common.Persistence`, used for transactions spanning multiple repository operations + event bus publishing

Controllers never touch `DbContext` directly — all data access goes through repository interfaces.

### Connection Resilience

Database creation and migration run on startup. Connection string is loaded from configuration (`NpgSql` key). Npgsql provider handles connection pooling by default.

---

## 7. Messaging & Event Handling

### Message Broker

**Apache Kafka** via `Space.Service.Common.EventBus` (version 2.9.35). The event bus is registered with outbox pattern support:

```csharp
services.AddEventBus(configuration, typeof(VerificationDbContext));
```

Event endpoints are exposed via `UseEventEndpoints()` in the middleware pipeline.

### Published Events

| Event | Topic | Key | Purpose |
|-------|-------|-----|---------|
| `VerificationSessionDataRetrievedEvent` | `verification` | `session-data-retrieved` | Emitted after Identomat session data is fetched and session record is created |
| `VerificationSessionRejectedEvent` | `verification` | `session-rejected` | Emitted when a verification session is rejected |
| `VerificationSessionMediaDataRetrievedEvent` | `verification` | `session-media-data-retrieved` | Emitted after media files are persisted to S3 |
| `DocumentValidatedEvent` | `verification` | `document-validated` | Emitted after successful document validation against national registry |
| `UserDocumentValidationFailedEvent` | `verification` | `document-validation-failed` | Emitted when document validation fails |
| `LoggedOutPhoneNumberChangeUserBlockedEvent` | `verification` | `logged-out-phone-number-change-user-blocked` | Emitted when user is blocked from phone number change |
| `LoggedOutPhoneNumberChangeUserUnBlockedEvent` | `verification` | `logged-out-phone-number-change-user-unblocked` | Emitted when block expires and is removed |
| `UpdateCustomerThirdPartyDataEvent` | `verification` | `update-customer-third-party-data` | Triggers downstream customer data refresh |
| `CustomerSelfieUpdatedEvent` | `verification` | `customer-selfie-updated` | Emitted when customer's selfie reference is updated |
| `LivenessStartedEvent` | `verification` | `liveness-started` | Emitted when a liveness session is authorized |
| `LivenessFinishedEvent` | `verification` | `liveness-finished` | Emitted after liveness check completes |
| `LivenessLimitReachedEvent` | `verification` | `liveness-limit-reached` | Emitted when user hits daily liveness attempt limit |
| `CreateLabelEvent` | `crm` | `create-label` | Creates a CRM contact label |
| `RemoveLabelEvent` | `crm` | `remove-labelv2` | Removes a CRM contact label |
| `CheckUserDocumentReportEvent` | `notification` | `send-email` | Sends email notification (MessageType.Command) |

### Consumed Events

| Event | Consumed As | Trigger |
|-------|------------|---------|
| `customer-created` | `CreateCustomerCommand` | Creates local `Customer` record from onboarding service data |
| `customer-updated` | `UpdateCustomerCommand` | Updates local `Customer` record with new personal/document data |
| `user-logged-in-event` | `UserLoggedInCommand` | Registers user as `ActiveUser` for periodic document checks |
| `session-rejected` | `PersistRejectedSessionMediaCommand` | Persists media from rejected verification sessions to S3 |

### Event Handling Patterns

- **Outbox pattern**: Event bus is registered with `typeof(VerificationDbContext)` for transactional outbox support — events are persisted in the same DB transaction as business data
- **Unit of Work**: Critical operations use `IUnitOfWork.BeginTransactionAsync()` to atomically commit DB changes + event publications
- **Idempotent consumers**: Consumed events create or update records with existence checks (e.g., `CreateCustomerCommand` checks for duplicate customer by ID)

---

## 8. Background Jobs & Scheduled Tasks

### Workers

Both workers extend `CronBackgroundServiceBase` from `Space.Service.Common.Workers`.

| Worker | Schedule | Purpose |
|--------|----------|---------|
| `DeleteExpiredSessionBlocksWorker` | Cron (with seconds), UTC | Deletes `SessionBlock` records older than `OlderThanInHours`. For each deleted block, publishes `LoggedOutPhoneNumberChangeUserUnBlockedEvent` in a transaction |
| `CheckActiveUserDocumentWorker` | Cron (standard), UTC | Fetches active users via `IActiveUserRepository.GetUsers(dailyLimit)`, validates documents against the national registry, updates expiration/validation dates. On the **27th of each month**, also generates a CSV report of users exceeding attempt limits, uploads to S3, emails a signed URL |

### Worker Configuration

```csharp
// DeleteExpiredSessionBlocksWorkerOptions
string Cron          // [Required] — e.g., "0 0 */6 * * *" (every 6 hours)
int OlderThanInHours // [Required] — block expiry threshold

// CheckActiveUserDocumentWorkerOptions
string Cron                      // [Required]
int DailyLimit                   // [Required] — max users to process per run
int UserCheckAttemptLimit        // [Required]
int DocumentExpirationDayLimit   // [Required]
int DocumentValidationDayLimit   // [Required]
int LastAttemptDayLimit           // [Required]
string ReportEmail               // [Required]
int ReportAccessibleForDays      // [Required]
string ReportDirectory           // [Required]
```

Options are validated on startup via `ValidateDataAnnotations().ValidateOnStart()`.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Serilog** for structured logging, configured via `UseSerilog` in `Program.cs`
- **`LoggingBehavior<,>`** MediatR pipeline behavior logs every request/response
- **`[SensitiveData]`** attribute masks PII in logs — applied extensively to request/response DTOs containing personal numbers, birth dates, phone numbers, passwords, tokens, face images, and folder IDs
- **Helper**: `SensitiveDataUtils.SerializeSensitiveData()` replaces sensitive strings with `"*** HIDDEN ***"`

### Health Checks

Registered via `AddHealthChecks(configuration)` from `Space.Service.Common.HealthChecks` and exposed via `UseHealthCheckMiddleware(env)`. Includes database connectivity checks (PostgreSQL) and configured infrastructure checks.

### Rate Limiting & Throttling

Rate limiting is implemented at the **application level** through cached counters, not HTTP middleware:

| Counter | Cache Key Pattern | Limit Source | Action on Breach |
|---------|------------------|-------------|-----------------|
| Start liveness session failures | `StartLivenessSessionFailedCount_{userId}` | `SessionLimitOptions.FailedLivenessSessionDailyLimit` | Throws `USER_BLOCKED_FOR_24_HOURS` |
| Compare face failures | `CompareFaceSessionFailedCount_{userId}` | `SessionLimitOptions.FailedCompareFaceSessionDailyLimit` | Throws `USER_BLOCKED_FOR_24_HOURS` |
| Non-resident daily calls | `NonResidentDailyCallCount_{customerId}` | `NonResidentDailyLimitOptions.MaxDailyCallsPerCustomer` | Throws `NON_RESIDENT_DAILY_LIMIT_REACHED` |
| Failed session daily attempts | Via `ISessionRepository` query | `SessionLimitOptions.FailedSessionDailyLimits[SessionType]` | Throws `LIVENESS_LIMIT_REACHED` |

CacheTTLs are calculated to expire at midnight Tashkent time (UTC+5).

### Resilience Patterns

| Pattern | Implementation |
|---------|---------------|
| **Polling with timeout** | `LivenessVerificationService.GetAnalyze()` polls every 500ms for up to 20 seconds until analysis completes |
| **Graceful 404 handling** | `MediaProcessingService.PersistMedia()` skips media types that return 404 from Identomat |
| **Feature toggles** | GrowthBook-based toggles gate risky features without redeployment |
| **Session blocking** | Physical `SessionBlock` records prevent re-attempts; auto-cleanup via cron worker |
| **Transaction safety** | `IUnitOfWork` with `await using` ensures automatic rollback on failure |

### Configuration Management

| Source | Loaded In | Contents |
|--------|-----------|----------|
| `appsettings.json` | Always | Default settings |
| `appsettings.Local.json` | Local development | Local overrides |
| `/settings/globalsettings.json` | Non-local environments | Shared global settings (with file watch) |
| `/settings/appsettings.json` | Non-local environments | Environment-specific settings (with file watch) |
| `/settings/dbsettings.json` | Non-local environments | Database connection strings (with file watch) |
| User Secrets | Development | `UserSecretsId` configured in Api and Infrastructure `.csproj` |
| Environment variables | Always | Standard .NET configuration |

**Options classes** with `[Required]` data annotations and `ValidateOnStart()`:

| Options Class | Configuration Section |
|--------------|----------------------|
| `DocumentValidationOptions` | Document validation days threshold |
| `IdentomatOptions` | Identomat company key |
| `VerificationStorageOptions` | S3 bucket name |
| `RestrictionOptions` | Age limits, thresholds, country codes, passport series |
| `OzForensicsOptions` | OZ credentials, spoofing/confidence thresholds, analyze & liveness configs |
| `SessionLimitOptions` | Daily failure limits per session type/operation |
| `CacheTllOptions` | Cache TTLs for specific scenarios |
| `DeleteExpiredSessionBlocksWorkerOptions` | Worker cron schedule and expiry threshold |
| `CheckActiveUserDocumentWorkerOptions` | Worker cron schedule and document check parameters |
| `NonResidentDailyLimitOptions` | Max daily calls per non-resident customer |

### Feature Toggles

| Toggle Name | Location | Purpose |
|-------------|----------|---------|
| `active-user-document-check` | `CheckUserDocumentCommandHandler` | Gates periodic document validation worker execution |
| `generate-check-user-document-report` | `CheckUserDocumentReportCommandHandler` | Gates monthly report generation |
| `onboarding_verification_sync_statuses` | `CustomerService` | Syncs resident/taxpayer/verified status flags |
| `onboarding_verification_sync_citizenship_code` | `CustomerService` | Syncs citizenship country code |
| `onboarding-compare-face-selfie-image-replace` | `CompareFaceCommandHandler` | Uses customer selfie from DB vs. session media |
| `onboarding-national-registry-non-resident-details` | `CheckDocumentAnonymousCommandHandler` | Enables non-resident document lookup |

---

## 10. Testing

### Test Projects

| Project | Type | Test Count (est.) |
|---------|------|-------------------|
| `Space.Service.Verification.UnitTests` | Unit tests | ~50+ test classes |
| `Space.Service.Verification.ComponentTests` | Integration/component tests | ~4 test classes |
| `Space.Service.Verification.ArchitectureTests` | Architecture enforcement | 17 tests |

### Frameworks & Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **xUnit** | 2.9.3 | Test framework |
| **NSubstitute** | 5.3.0 | Mocking framework |
| **AutoFixture** | 4.18.1 | Test data generation |
| **FluentAssertions** | 7.2.0 | Assertion library |
| **Microsoft.AspNetCore.Mvc.Testing** | 9.0.10 | `WebApplicationFactory` for component tests |
| **WireMock.Net** | 1.5.47 | HTTP mock server for external API simulation |
| **Microsoft.EntityFrameworkCore.InMemory** | 9.0.0 | In-memory database for unit tests |
| **RichardSzalay.MockHttp** | 7.0.0 | HTTP message handler mocking |
| **Serilog.Sinks.TestCorrelator** | 4.0.0 | Log assertion in tests |
| **coverlet** | (msbuild + collector) | Code coverage collection |
| **NetArchTest.Rules** | 1.3.2 | Architecture rule enforcement |
| **GitHubActionsTestLogger** | — | Test result reporting for CI |
| **XunitXml.TestLogger** | — | XML test result output |

### Testing Patterns

#### Unit Tests
- **AAA pattern** with `// Arrange`, `// Act`, `// Assert` comments
- **Naming**: `MethodName_Condition_ExpectedResult`
- **Fixtures**: Shared via `[Collection("SharedFixtures")]` — `InMemoryDbContextFixture`, `MapperFixture`, `LocalizerFixture`
- **Mocking**: All external dependencies mocked via NSubstitute
- **Coverage**: Unit tests for controllers, command handlers, query handlers, validators, services, repositories, and infrastructure services

#### Component Tests
- **`CustomWebApplicationFactory<Program>`** replaces real services:
  - In-memory EF Core database (seeded via `VerificationDbInitializer`)
  - `TestAllowAnonymous` authorization handler (bypasses all auth)
  - Stubbed `IEventBus`, `ISuperCache`, `IMediaStorage`, `IDistributedLockProvider`
  - Fixed `RequestMetadata` (UserId=`"123"`, TenantId=`TbcUz`)
- **WireMock** server on port 5980 for external API simulation (Identomat, OZ Forensics, National Registry)
- **13 mock JSON files** for HTTP response stubs organized under `Mocks/` directory

#### Architecture Tests
- **NetArchTest.Rules** validates layer dependency direction, naming conventions, and MediatR usage patterns
- 17 enforced rules covering Clean Architecture constraints

### Test File Structure

```
UnitTests/
├── Api/Controllers/          — Controller action tests (3 files)
├── Application/
│   ├── Extensions/           — ImageValidationExtensions tests
│   ├── Features/
│   │   ├── ActiveUser/       — 3 handler tests
│   │   ├── Customer/         — 2 handler tests
│   │   ├── Loan/             — 3 handler + 1 validator tests
│   │   ├── Session/          — 10 handler + 6 validator tests
│   │   └── Verification/     — 18 handler + validator tests
│   └── Services/             — 2 service tests
├── Infrastructure/Services/  — 6 service tests + 3 tenant-specific tests
├── Persistence/Repositories/ — 3 repository tests
└── Fixtures/                 — 4 shared fixtures
```

---

## 11. DevOps & Deployment

### Dockerfile

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt
RUN update-ca-certificates --verbose
COPY app/publish .
ENV ASPNETCORE_HTTP_PORTS=80
ENTRYPOINT ["dotnet", "Space.Service.Verification.Api.dll"]
```

| Aspect | Detail |
|--------|--------|
| Base image | `mcr.microsoft.com/dotnet/aspnet:9.0` (runtime only, no SDK) |
| Build stages | **Single stage** — expects pre-built `app/publish` directory (build happens in CI) |
| Custom CA certs | Two certificates installed: one for general TLS, one specifically for Kafka TLS |
| Port | HTTP on port 80 |
| Optimizations | Runtime-only image, no SDK overhead. Build is externalized to CI pipeline |

### CI/CD Pipeline

CI/CD uses **GitHub Actions** (evidenced by badge links in README pointing to `ci-cd` and `cd` workflows). Pipeline artifacts include:
- `GitHubActionsTestLogger` for test result reporting
- `coverlet` for code coverage collection
- SonarQube integration (`SonarQubeTestProject` property in `.csproj` files)
- Trivy security scanning (`trivy-secret-config.json` at root)

### Tools Directory

```
tools/
├── localDevSetup.sh          — Pre-build script for Debug configuration
├── codeCoverage/              — Coverage configuration/reporting
├── hooks/                     — Git hooks
├── sonarqube/                 — SonarQube analysis configuration
├── stryker/                   — Mutation testing with Stryker.NET
├── trivy/                     — Container vulnerability scanning
└── zap/                       — OWASP ZAP security testing
```

### Container Security

- **Trivy** configuration at root (`trivy-secret-config.json`) for container image vulnerability scanning
- **OWASP ZAP** tooling under `tools/zap/` for dynamic application security testing

### Build Configuration

| Setting | Value |
|---------|-------|
| Server GC | `true` (via `Directory.Build.props`) |
| GC Adaptation Mode | `1` — DATAS (Dynamic Adaptation To Application Sizes) |
| Min thread pool threads | `100` (set in `Program.cs` after build) |
| Kestrel body rate | `MinRequestBodyDataRate` = 50 bytes/sec, 15s grace |

### Environment-Specific Config

| Profile | URL | Environment |
|---------|-----|-------------|
| Local development | `https://localhost:7141` / `http://localhost:5141` | `Local` |
| Docker | Dynamic port | — |
| Non-local | `/settings/` volume-mounted JSON files | Production/Staging |

---

## 12. External Service Dependencies

### HTTP Clients

All HTTP clients are registered via `AddRestClient` (RestEase-based) in `InfrastructureExtensions.cs`.

#### Identomat — `IIdentomatClient`

| Method | HTTP | Route | Purpose |
|--------|------|-------|---------|
| `GetSession` | GET | `result/?company_key=&session_token=` | Fetch verification session result (status, similarity, person data) |
| `GetSessionMedia` | GET | `result/{mediaPath}/?...` | Download media files (card-front, card-back, passport, face, face-video) |
| `CompareFaces` | POST | `compare-faces/` | Compare two base64 face images → similarity score |
| `StartSession` | GET | `begin/?company_key=&flags=` | Initiate new Identomat verification session with config flags |
| `GetFaceImage` | GET | `result/face/?...` | Download face image from completed session |

**Configuration**: `IdentomatOptions` section → `CompanyKey`  
**Attribute**: `[ExternalApiClient]`

#### OZ Forensics — `IOzForensicsClient`

| Method | HTTP | Route | Purpose |
|--------|------|-------|---------|
| `Authorize` | POST | `/api/authorize/auth` | Authenticate with credentials → access token |
| `StartAnalyze` | POST | `/api/folders/{folder_id}/analyses/` | Start quality/biometry analysis on uploaded media |
| `GetAnalyze` | GET | `/api/analyses/{analyse_id}` | Poll analysis status and retrieve results |
| `GetAnalyzeMedia` | GET | `/static/{mediaUrl}` | Download analysis media thumbnail |
| `GetAnalyzeMediaWithUrl` | GET | `{mediaUrl}` | Download media by absolute URL |
| `GetFolderMedia` | GET | `/api/folders/{folder_id}/media` | List media in a folder |
| `UploadMedia` | POST | `/api/folders/{folder_id}/media` | Upload multipart media (selfie/video) |

**Configuration**: `OzForensicsOptions` section → `Username`, `Password`, confidence thresholds, analyze config  
**Attribute**: `[ExternalApiClient]`  
**Resilience**: Polling loop (500ms interval, 20s timeout) in `LivenessVerificationService.GetAnalyze()`

#### National Registry — `INationalRegistryClient`

| Method | HTTP | Route | Purpose |
|--------|------|-------|---------|
| `GetNationalRegistryCustomerProfile` | POST | `api/v1/nationalregistry/get-personal-information` | Validate citizen identity with face photo comparison |
| `GetNationalRegistryCustomerDocument` | POST | `api/v1/nationalregistry/customerdatafordocumentvalidation` | Get document status (alive, expiry, status) |
| `GetNationalRegistryCustomerDocumentV2` | POST | `api/v1/nationalregistry/get-person-data-by-personalnumber` | Enhanced document validation with archive flag |
| `GetNationalRegistryCustomerDocumentDetails` | POST | `api/v1/nationalregistry/get-person-details-by-personalnumber` | Full person details including addresses |
| `GetNonResidentDetails` | POST | `api/v1/nationalregistry/non-resident/get-non-resident-details` | Non-resident identity lookup |

**Configuration**: `NationalRegistryOptions` section  
**Attribute**: `[InternalApiClient("Space.Service.NationalRegistry")]` — internal microservice call

### Object Storage — `IMediaStorage`

S3-compatible object storage registered via `AddStorage<IMediaStorage>(config, "StorageOptions")`. Used to:
- Persist verification session media (selfies, ID photos, videos) under `VerificationMedia/` prefix
- Generate pre-signed URLs for media download (7-day expiry)
- Upload CSV reports for user document checks

**Configuration**: `VerificationStorageOptions` → `BucketName`

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Summary Table

| Pattern | Where Used | Why |
|---------|-----------|-----|
| **Clean Architecture** | Project structure (Api → Application → Domain ← Persistence, Infrastructure) | Dependency inversion — domain logic is isolated, infrastructure is swappable |
| **CQRS** | `Application/Features/*/Commands/` and `Queries/` | Separates read/write concerns, allows independent scaling and optimization |
| **MediatR** | All controllers delegate to `IMediator.Send()` | Decouples controllers from business logic, enables pipeline behaviors |
| **Repository Pattern** | `Application/Repositories/` interfaces, `Persistence/Repositories/` implementations | Abstracts data access, enables testing with in-memory DB |
| **Unit of Work** | `IUnitOfWork` in handlers that publish events | Transactional consistency between DB writes and event publishing |
| **Outbox Pattern** | `AddEventBus(configuration, typeof(VerificationDbContext))` | Guarantees at-least-once event delivery via transactional outbox |
| **Feature Toggles** | GrowthBook-based `IFeatureToggle` in handlers and services | Enables zero-downtime feature rollout and kill-switch capability |
| **Tenant-specific services** | `[Service(TbcUz)]` attribute on service implementations | Supports multi-tenant business logic differentiation |
| **Sensitive Data Masking** | `[SensitiveData]` attribute on DTOs/entities | PII protection in logs — GDPR/regulatory compliance |
| **Event-Driven Architecture** | Kafka via `IEventBus` (15 published events, 4 consumed) | Loose coupling with upstream/downstream services |
| **Background Workers** | `CronBackgroundServiceBase` (2 workers) | Periodic maintenance without external scheduler dependency |
| **Architecture Tests** | `NetArchTest.Rules` (17 tests) | Automated enforcement of Clean Architecture constraints |
| **API Versioning** | URL-based `v1`/`v2`/`v3` via controller attributes | Non-breaking API evolution |
| **Dual Verification Provider** | Identomat + OZ Forensics via `Provider` enum | Provider flexibility — can route verification to either engine |

### Notable Deviations from Conventions

| Observation | Detail |
|-------------|--------|
| **No foreign keys in DB** | All entity relationships are query-time joins — no EF Core navigation properties or FK constraints. Trades referential integrity for deployment flexibility |
| **String primary keys** | `Session`, `SessionMedia`, and `Customer` use `string` PKs (likely external IDs) — diverges from typical GUID/int patterns |
| **Mixed auth patterns** | Many endpoints are `[AllowAnonymous]` despite being internal service-to-service — relies on network-level security rather than per-endpoint auth |
| **Some obsolete endpoints remain** | `StartLoggedOutPhoneNumberChangeSession`, `CheckLoggedOutPhoneNumberChangeSession`, `GetLoggedOutPhoneNumberChangeSession` marked `[Obsolete]` but still present |
| **`SessionType` enum gaps** | Values 13, 15–19, 22 are missing — suggests removed features or reserved ranges |
| **`DuplicationNumberChangeLivenessCheck` unmapped** | `EnumMapperExtensions` has no mapping for `SessionType.DuplicationNumberChangeLivenessCheck (5)` → potential runtime `ArgumentOutOfRangeException` |

### Technical Debt & Improvement Opportunities

| Item | Impact | Recommendation |
|------|--------|---------------|
| **Obsolete endpoints** | Maintenance burden, confusing API surface | Remove after confirming no consumers |
| **`FolderId` marked `[SensitiveData]`** | `FolderId` is a system identifier, not PII — false positive per style guidelines | Review and remove attribute if it's just a UUID |
| **No FK constraints** | Data integrity risk — orphaned records possible | Consider adding FK constraints where entity lifecycle is coupled |
| **`DuplicationNumberChangeLivenessCheck` enum mapping gap** | Potential runtime exception if this session type is used with `ToOperation()` | Add mapping or remove unused enum value |
| **Polling-based analysis check** | `GetAnalyze()` uses `Thread.Sleep(500)` loop — blocks thread | Consider webhook callback or `Task.Delay` with `CancellationToken` |
| **`Platform` marked as `[SensitiveData]` on `Session`** | `Platform` is an enum (iOS/Android/Web) — not sensitive per guidelines | Remove attribute |
| **Parameterless DbContext constructor with hardcoded connection** | `VerificationDbContext()` has a design-time-only constructor with hardcoded `"NpgSql"` | Ensure this is never used at runtime; consider `IDesignTimeDbContextFactory` |
| **Single Docker stage** | Build externalized to CI — acceptable but limits `docker build` reproducibility | Consider multi-stage Dockerfile for local development |
| **No explicit retry/circuit-breaker policies** | External API calls (Identomat, OZ, National Registry) have no Polly resilience policies | Add retry + circuit breaker via `Space.Service.Common.RestClient` configuration |
| **Seeder is empty** | `Seeder.cs` is a no-op | Remove or populate with seed data if needed |
