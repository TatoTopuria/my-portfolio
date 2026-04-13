# Space.Service.ThreatDetection — Comprehensive Service Analysis

---

## Table of Contents

1. [Service Overview](#1-service-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack & Frameworks](#3-tech-stack--frameworks)
4. [API Layer & Communication](#4-api-layer--communication)
5. [Middleware & Pipeline](#5-middleware--pipeline)
6. [Data Layer](#6-data-layer)
7. [Messaging & Event Handling](#7-messaging--event-handling)
8. [Background Jobs & Scheduled Tasks](#8-background-jobs--scheduled-tasks)
9. [Cross-Cutting Concerns](#9-cross-cutting-concerns)
10. [Testing](#10-testing)
11. [DevOps & Deployment](#11-devops--deployment)
12. [External Service Dependencies](#12-external-service-dependencies)
13. [Key Technical Decisions & Patterns Summary](#13-key-technical-decisions--patterns-summary)

---

## 1. Service Overview

### Service Name & Purpose

**Space.Service.ThreatDetection** is a .NET 9 microservice owned by the **identity-sso** team. It serves as the centralized anti-fraud and Anti-Money Laundering (AML) gateway for the SpaceBank digital banking platform. The service screens customers, companies, financial transfers, cards, and business-banking activities for fraud risk and AML compliance.

### Domain Context

This service represents the **Threat Detection / Compliance bounded context**. It sits at the intersection of identity verification, transaction monitoring, and regulatory compliance. It is the single point of contact for all fraud and AML decisions across the platform — other services (transfers, cards, deposits, onboarding, business banking) publish events or call this service's API to obtain fraud/AML verdicts before proceeding.

### Key Entities & Domain Models

| Entity | Base Class | Storage | Purpose |
|---|---|---|---|
| `Customers` | `EntityBase<string>` | PostgreSQL + MongoDB | Customer personal/identity data for AML screening |
| `AmlCardStorage` | `EntityBase<ObjectId>` | MongoDB | Card details stored for AML correlation |
| `AntiFraudBlackList` | `EntityBase<ObjectId>` | MongoDB | Blacklisted persons (name + personal number) |
| `AntiFraudResultLog` | `EntityBase<int>` | PostgreSQL | Legacy anti-fraud result logs |
| `AntiFraudResultLogs` | `EntityBase<string>` | MongoDB | Anti-fraud session result logs (BSON) |
| `FormicaSession` | `EntityBase<string>` | MongoDB | Formica anti-fraud session data |
| `SuspiciosCards` | `EntityBase<ObjectId>` | MongoDB | Cards flagged as blacklisted or gray-listed |
| `UserAppRestrictionLog` | `EntityBase<ObjectId>` | MongoDB | Tracks last restricted-app check per user |
| `RestrictedAppNotificationLog` | `EntityBase<ObjectId>` | MongoDB | Logs of restricted-app notifications sent |

### Main Use Cases & Workflows

| Use Case | Description |
|---|---|
| **AML Customer Screening** | Screen individual customers against Acuity sanctions/PEP lists before onboarding, card issuance, deposit opening, or loan disbursement |
| **AML Company/Member Screening** | Screen legal entities and their members for sanctions and compliance |
| **AML Transfer Screening** | Screen outbound transfers for AML risk; publish success/failure events |
| **TMX Anti-Fraud Checks** | Evaluate user actions (login, registration, account opening, passcode change, transfers, deposits) via ThreatMetrix (TMX) |
| **Formica Anti-Fraud Checks** | Evaluate onboarding, authorization, P2P transfers, deposit withdrawals, and phone number changes through Formica engine |
| **Business Banking Checks** | Dedicated fraud checks for business-banking flows: account creation, role management, transfers, approvals, loans, and TMX session generation |
| **Blacklist Management** | Upload blacklists via CSV, check persons/cards against the blacklist, and return card details enriched from Uzcard/Humo |
| **CBU Anti-Fraud** | Validate card numbers and phone numbers against Central Bank of Uzbekistan (CBU) fraud database |
| **Customer Remediation** | Unblock customers flagged by TMX, handle review results |
| **Genesys Active Call Check** | Detect if a user is currently on a phone call (social engineering protection) |
| **Restricted App Detection** | Detect and report restricted/malicious apps installed on user devices |
| **Data Encryption** | Encrypt/decrypt sensitive data (card numbers, etc.) for secure cross-service communication |
| **Log Archival** | Periodically archive and clean old anti-fraud and Formica session logs |
| **CBU Transfer Reporting** | Generate periodic CBU compliance reports for card transfers |

---

## 2. Architecture

### Architectural Pattern

The service implements **Clean Architecture** combined with **CQRS** (Command Query Responsibility Segregation) using MediatR as the in-process mediator. This is evidenced by:

- **Strict layer separation** enforced by `NetArchTest.Rules` in `ArchitectureTests.cs`
- **Dependency flow**: Domain ← Application ← (Infrastructure, Persistence) ← API
- **Feature-based organization** under `Application/Features/` with distinct `Commands/` and `Queries/` sub-folders
- **Handlers inherit from** `RequestHandlerBase<TCommand, TResponse>` (from `Space.Service.Common.Mediator`)

```
Controller → IMediator → Command/Query Handler → Application Services → Repository → DbContext/MongoCollection
```

### Project Structure Breakdown

| Project | Responsibility |
|---|---|
| `Space.Service.ThreatDetection.Api` | HTTP entry point: controllers, middleware pipeline, auth, Swagger, health checks |
| `Space.Service.ThreatDetection.Application` | Business logic: CQRS commands/queries/handlers, service interfaces, repository interfaces, DTOs, validators, events, options, HTTP client interfaces |
| `Space.Service.ThreatDetection.Domain` | Core domain: entities, enums, constants, exception definitions (anemic — no domain services) |
| `Space.Service.ThreatDetection.Infrastructure` | External integrations: HTTP service implementations (Acuity, CBU, Humo, Uzcard, Genesys), background workers, SOAP client, event bus registration |
| `Space.Service.ThreatDetection.Persistence` | Data access: EF Core DbContext, MongoDB contexts, repository implementations, entity configurations, migrations, seeder |
| `Space.Service.ThreatDetection.UnitTests` | Unit tests for handlers, services, validators, controllers (~88 test files) |
| `Space.Service.ThreatDetection.ComponentTests` | Integration/component tests with real containers (Postgres, MongoDB, WireMock) (~13 test files) |
| `Space.Service.ThreatDetection.ArchitectureTests` | Architectural fitness functions via NetArchTest (~15 rules) |
| `Space.Service.ThreatDetection.CITools` | CI utility project |

### Dependency Flow Direction

```
Domain ← Application ← Persistence ← API
                     ← Infrastructure ← API
```

- **Domain** has no project references (standalone)
- **Application** references only Domain
- **Persistence** references Application (and transitively Domain)
- **Infrastructure** references Application (and transitively Domain)
- **API** references Application, Persistence, and Infrastructure

This is enforced at build time by the architecture tests:

```csharp
// From ArchitectureTests.cs
Domain_ShouldNotDependOnAnyLayer()       // Domain → nothing
Application_ShouldNotDependOnPersistence()
Application_ShouldNotDependOnInfrastructure()
Controllers_ShouldNotDependOnPersistence()
Controllers_ShouldNotDependOnDomain()
Controllers_ShouldNotDependOnInfrastructure()
Api_ShouldNotDependOnDomain()
```

### CQRS Organization

All features live under `Application/Features/` organized by business domain:

```
Features/
├── Aml/                    # AML screening (individual, company, member, transfer)
│   ├── Commands/
│   │   └── BusinessBanking/
│   └── Events/
├── AntiFraud/              # TMX-based fraud checks
│   ├── Commands/
│   │   ├── BusinessBanking/
│   │   ├── CheckTransfer/
│   │   ├── CheckDeposit/
│   │   ├── CheckUserLogin/
│   │   ├── ... (15+ command folders)
│   │   └── ReportFraud/
│   └── Events/
├── Card/                   # Card AML storage management
│   └── Commands/
├── CbuAntiFraud/           # CBU checks and reporting
│   └── Commands/
├── Customer/               # Customer creation/update (consumed events)
│   └── Commands/
├── FormicaAntiFraud/       # Formica engine checks
│   ├── BusinessBanking/
│   │   └── Commands/
│   └── Commands/
├── Genesys/                # Active call detection
│   └── Commands/
└── RestrictedAppReport/    # Device app restriction reporting
    └── Commands/
```

Each command folder typically contains:
- `*Command.cs` — the MediatR request (implements `IRequest<TResponse>`)
- `*CommandHandler.cs` — handler inheriting `RequestHandlerBase<TCommand, TResponse>`
- `*Response.cs` — response DTO
- `*CommandValidator.cs` — FluentValidation validator

**Note**: The codebase is command-heavy with no explicit Query classes — all operations (including reads like blacklist checks) are modeled as Commands, likely because even "read" operations trigger side effects (logging, event publishing, or state checks).

### DDD Patterns

The project uses a **lightweight DDD** approach:
- **Entities** derive from `EntityBase<TEntityId>` (from `Space.Service.Common.Persistence`)
- **No Aggregates/Value Objects/Domain Events** in the traditional DDD sense — the Domain layer is anemic (data containers only)
- **Business logic** resides entirely in Application layer handlers and services
- **Repository pattern** is present with interfaces in Application and implementations in Persistence

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Item | Version |
|---|---|
| Runtime | .NET 9.0 |
| Language | C# (latest features) |
| Target Framework | `net9.0` |

### Primary Frameworks & Packages

| Package | Version | Role |
|---|---|---|
| `ASP.NET Core 9` | 9.0.x | Web API framework |
| `MediatR` (via `Space.Service.Common.Mediator`) | 2.9.8 | CQRS mediator, pipeline behaviors |
| `FluentValidation` (via Common.Mediator) | — | Request validation |
| `Entity Framework Core` | 9.0.9 | PostgreSQL ORM |
| `Npgsql` (EF Core provider) | — | PostgreSQL driver |
| `MongoDB.Driver` | 3.4.0 | MongoDB data access |
| `Space.Service.Common.RestClient` | 2.9.23 | RestEase-based typed HTTP clients |
| `Space.Service.Common.EventBus` | 2.9.36.7-beta | Message broker abstraction (event publishing/consuming) |
| `Space.Service.Common.Auth` | 2.9.9 | IdentityServer authentication |
| `Space.Service.Common.Caching` | 2.9.15 | ISuperCache Redis caching |
| `Space.Service.Common.Workers` | 2.9.13 | Cron-based background worker base classes |
| `Space.Service.Common.Mapping` | 2.9.2 | Object mapping |
| `Space.Service.Common.Exceptions` | 2.9.9 | Standardized exception handling |
| `Space.Service.Common.Middlewares` | 2.9.12.7-beta | Common HTTP middleware |
| `Space.Service.Common.HealthChecks` | 2.9.10 | Health check endpoints |
| `Space.Service.Common.Swagger` | 2.9.13 | Swagger/OpenAPI generation |
| `Space.Service.Common.Logging` | 2.9.9 | Serilog-based structured logging, `[SensitiveData]` attribute |
| `Space.Service.Common.FeatureToggle` | 2.9.16 | GrowthBook feature toggle integration |
| `Space.Service.Common.Factory` | 2.9.9 | Tenant-specific service resolution |
| `Space.Service.Common.Persistence` | 2.9.14.7-beta | Entity base classes, Unit of Work |
| `Space.Service.Common.Storage` | 2.9.3 | Cloud storage abstraction |
| `Space.Service.Common.Soap` | 2.9.8 | SOAP client support |
| `Space.Service.Common.Misc` | 2.9.64.7-beta | Shared utilities |
| `CsvHelper` | 33.0.1 | CSV parsing (blacklist upload, reporting) |
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus metrics |
| `Microsoft.Extensions.Caching.Memory` | 9.0.11 | In-memory caching |
| `System.ServiceModel.*` | 6.0.0–8.1.2 | WCF/SOAP connected services |
| `Space.Service.Common.CodeAnalyzers` | 2.9.6 | Static analysis rules |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |

### Databases

| Database | Purpose |
|---|---|
| **PostgreSQL** (via Npgsql) | Relational store for `Customers` entity, legacy `AntiFraudResultLog` |
| **MongoDB** (Default instance) | Primary document store for most entities: `AmlCardStorage`, `AntiFraudBlackList`, `AntiFraudResultLogs`, `FormicaSession`, `SuspiciosCards`, `UserAppRestrictionLog`, `RestrictedAppNotificationLog`, `Customers` |
| **MongoDB** (Archive instance) | Separate archive database (`ThreatDetection_arch`) for migrated anti-fraud logs and Formica sessions |

### Caching Layer

- **Redis** via `ISuperCache` (from `Space.Service.Common.Caching`)
  - Used for: Acuity OAuth token caching, Formica auth token caching, restricted app list caching
  - Both `GetOrAdd` (in-memory with Redis fallback) and `GetOrAddRedis` (Redis-only) patterns used
- **In-memory caching** via `Microsoft.Extensions.Caching.Memory` registered in Infrastructure

### Logging & Observability

| Concern | Implementation |
|---|---|
| Structured logging | Serilog (via `UseSerilog` in `Program.cs`) |
| Sensitive data masking | `[SensitiveData]` attribute → masked in logs via `SensitiveDataUtils.SerializeSensitiveData()` |
| Metrics | Prometheus (`prometheus-net.AspNetCore`, `UseHttpMetrics`, `MapMetrics`) |
| APM | `AddApm(configuration)` in `Program.cs` |
| MediatR pipeline logging | `LoggingBehavior<,>` registered in pipeline |

---

## 4. API Layer & Communication

### API Style

**REST** — all endpoints are HTTP POST operations. The service acts primarily as a command gateway — callers POST requests and receive synchronous verdicts.

### API Versioning

API versioning is supported via URL path segment: `api/v{version:apiVersion}/`. Configured through `AddVersioning()` in `ApiExtensions.cs`. Endpoints declare version mappings via `[MapToApiVersion("1")]` or `[MapToApiVersion("2")]`.

### Authentication & Authorization

- **IdentityServer authentication** via `AddIdentityServerAuthentication()` in `ApiExtensions.cs`
- **Base controller** is decorated with `[Authorize]` — all endpoints require authentication by default
- **`[AllowAnonymous]`** applied to specific endpoints (anonymous AML checks, event-consumed commands, business banking flows)
- **API Key authentication** (`[ApiKey("TmxAuth")]`, `[ApiKey("AntiFraudBlackListAuth")]`, etc.) for service-to-service endpoints

### Endpoints by Controller

#### AmlController — `api/v{version:apiVersion}/Aml`

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `POST` | `/` | Authorized | Screen individual customer AML status |
| `POST` | `/company` | Anonymous | Screen company AML status |
| `POST` | `/company-member` | Anonymous | Screen company member AML status |
| `POST` | `/anonymous` | Anonymous | Screen customer AML status (anonymous) |

#### AntiFraudController — `api/v{version:apiVersion}/AntiFraud`

| Method | Route | Version | Auth | Purpose |
|---|---|---|---|---|
| `POST` | `/user-registration` | v1 | Anonymous | TMX check for user registration |
| `POST` | `/account-open` | v1 | Authorized | TMX check for account opening |
| `POST` | `/phone-number-change` | v1 | Anonymous | TMX check for phone number change |
| `POST` | `/phone-number-change` | v2 | Anonymous | Formica check for phone number change |
| `POST` | `/user-login` | v1 | Authorized | TMX check for user login |
| `POST` | `/local-authentication-id-change` | v1 | Authorized | TMX check for biometric ID change |
| `POST` | `/change-passcode` | v1 | Anonymous | TMX check for passcode change |
| `POST` | `/encrypt` | v1 | Anonymous | Encrypt sensitive data |
| `POST` | `/decrypt` | v1 | Anonymous | Decrypt sensitive data |
| `POST` | `/customer` | v1 | Anonymous, NonProduction | Full TMX customer check (non-prod only) |
| `POST` | `/customer/unblock` | v1 | Anonymous | Unblock a TMX-blocked customer |
| `POST` | `/check-transfer` | v1 | Authorized | Synchronous TMX transfer check |
| `POST` | `/check-deposit` | v1 | Anonymous | Synchronous TMX deposit check |
| `POST` | `/businessbanking/account-creation` | v1 | Anonymous | Business banking account creation check |
| `POST` | `/businessbanking/role-management` | v1 | Authorized | Business banking role management check |
| `POST` | `/businessbanking/submit-transfer` | v1 | Authorized | Business banking transfer submission check |
| `POST` | `/businessbanking/approve-transfer` | v1 | Authorized | Business banking transfer approval check |
| `POST` | `/businessbanking/transfer-review-result` | v1 | ApiKey (TmxAuth) | Receive transfer review results from TMX |
| `POST` | `/businessbanking/generate-tmxsessionid` | v1 | Anonymous | Generate TMX session ID (mobile) |
| `POST` | `/businessbanking/generate-tmxwebsessionid` | v1 | Anonymous | Generate TMX session ID (web) |
| `POST` | `/businessbanking/user-login` | v1 | Anonymous | Business banking login check |
| `POST` | `/businessbanking/check-transfer` | v1 | Anonymous | Business banking transfer fraud check |
| `POST` | `/businessbanking/check-loan-application` | v1 | Anonymous | Business banking loan application check |
| `POST` | `/blacklist-check` | v1 | Authorized | Check person against blacklist |
| `POST` | `/blacklist-check` | v2 | ApiKey (TmxAuth) | Check person against blacklist (service-to-service) |
| `POST` | `/blacklist/upload` | v1 | ApiKey (AntiFraudBlackListAuth) | Upload blacklist CSV |
| `POST` | `/blacklist-check/card-details` | v1 | ApiKey (multiple) | Check card against blacklist with enrichment |
| `POST` | `/blacklist-check/card-details/anonymous` | v1 | Anonymous | Check card (deprecated) |
| `POST` | `/cbu/check` | v1 | Authorized | CBU anti-fraud check |
| `POST` | `/cbu/card-number-check` | v1 | Authorized | CBU transfer card validation |
| `POST` | `/oncall/check` | v1 | Authorized | Genesys active call detection |
| `POST` | `/deposit-withdrawal` | v1 | Authorized | Formica deposit withdrawal check |
| `POST` | `/p2p-transfer` | v1 | Authorized | Formica P2P transfer check |
| `POST` | `/report-fraud` | v1 | Authorized | Report fraud incident |

### Request/Response Patterns

- Each command has a dedicated `*Response` DTO
- Controllers return `IActionResult` (typically `Ok(response)` or `CreatedResult(response)`)
- Single `ActionResult<T>` used for business banking transfer responses
- `[SensitiveData]` attribute applied to command/response properties containing PII
- `SuppressModelStateInvalidFilter = true` — validation is handled by FluentValidation in the MediatR pipeline

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

The middleware pipeline is configured in `ApiExtensions.ConfigureAPI()` in the following order:

```csharp
1. UsePathBase(PATH_BASE)           // Base path: /threatdetection
2. UseLocalization()                 // Request localization (en-US, ru-RU, ka-GE, uz-Latn-UZ)
3. UseHttpsRedirection()             // HTTPS redirect
4. UseRouting()                      // Endpoint routing
5. UseHttpMetrics()                  // Prometheus HTTP metrics
6. UseAuthentication()               // IdentityServer JWT auth
7. UseStaticFiles()                  // Static files (Swagger CSS)
8. UseAuthorization()                // Authorization policies
9. UseMiddlewares()                  // Common middlewares (Space.Service.Common.Middlewares)
10. UseHealthCheckMiddleware()       // Health check endpoints
11. UseEventEndpoints()             // Event bus consumer endpoints
12. UseVersionEndpoint()            // Version info endpoint
13. MapControllers + MapMetrics     // API controllers + Prometheus scrape endpoint
14. PrometheusUtils.SetStaticLabels // Prometheus static labels
15. UseWorkerTriggerEndpoints()     // Background worker manual trigger endpoints
16. UseSwagger()                    // Swagger UI
```

### MediatR Pipeline Behaviors

Registered in `ApplicationExtensions.cs`, executed in order for every command/query:

| Order | Behavior | Purpose |
|---|---|---|
| 1 | `LoggingBehavior<,>` | Logs request/response with sensitive data masking |
| 2 | `ValidationBehavior<,>` | Runs FluentValidation validators; throws on failure |

### Global Exception/Error Handling

- Handled via `UseMiddlewares()` from `Space.Service.Common.Middlewares` — standardized error response envelope
- `Space.Service.Common.Exceptions` provides `AppException` for domain-specific errors with error codes

### Request Validation

- **FluentValidation** — validators discovered and registered via `AddValidatorsFromAssembly()`
- Triggered by `ValidationBehavior<,>` in the MediatR pipeline before handler execution
- Model state validation is suppressed (`SuppressModelStateInvalidFilter = true`) to avoid double validation

### Correlation ID / Request Tracing

- `RequestMetadata` is registered as scoped and populated per request (tenant context, user info)
- Background workers manually set `RequestMetadata.Tenant` before dispatching commands
- `CorrelationId` is explicitly propagated in CBU and AML event flows (e.g., `CheckCbuAntiFraudEvent.CorrelationId`)
- APM integration via `AddApm(configuration)` in `Program.cs`

---

## 6. Data Layer

### Database Type & Provider

| Database | Provider | Connection Key |
|---|---|---|
| PostgreSQL | `Npgsql` (EF Core) | `ConnectionStrings:NpgSql` |
| MongoDB (Primary) | `MongoDB.Driver` 3.4.0 | `ConnectionStrings:Mongo:Default` |
| MongoDB (Archive) | `MongoDB.Driver` 3.4.0 | `ConnectionStrings:Mongo:Archive` |

### ORM Configuration

**Entity Framework Core (PostgreSQL)**:
- `ThreatDetectionDbContext` extends `DbContextBase` (from `Space.Service.Common.Persistence`)
- No explicit `DbSet<>` properties — entities discovered via `ApplyConfigurationsFromAssembly()`
- Single entity configuration: `CustomerConfiguration` sets `BirthDate` column type to `date`

**MongoDB**:
- Two MongoDB contexts registered as scoped:
  - `ThreatDetectionMongoDbContext` → database `ThreatDetection` (keyed `Default` client)
  - `AntiFraudLogMongoDbContext` → database `ThreatDetection_arch` (keyed `Archive` client)
- BSON serializers registered: `GuidSerializer(Standard)`, `DecimalSerializer(Decimal128)`
- MongoDB indexes configured at startup via static index classes:

| Collection | Index | Type |
|---|---|---|
| `AmlCardStorage` | `CardId`, `CardNumber`, `CardNumberHash` | Ascending, non-unique |
| `AntiFraudBlackList` | `(FirstName, LastName)` compound, `PersonalNumber` | Ascending |
| `AntiFraudResultLogs` | `SessionId` (on Archive DB only) | Ascending |
| `SuspiciosCards` | `CardNumber` | Ascending, unique |
| `UserAppRestrictionLog` | `UserId` | Ascending, unique |
| `RestrictedAppNotificationLog` | `UserId` ascending, `Timestamp` descending | Two indexes |

### Migration Strategy

- **EF Core Migrations** for PostgreSQL — 10 migrations from June 2023 to February 2026
- Migration history tracks `Customers` table evolution: initial creation → column type changes → renames → added fields (`PersonalNumber`, `IsResident`)
- MongoDB has no formal migration strategy — indexes are idempotently applied at application startup

### Repository Pattern

**Interface-implementation separation**:
- Interfaces in `Application/Repositories/` (12 interfaces)
- Implementations in `Persistence/Repositories/` (10 concrete classes)

**MongoDB repositories** extend `MongoRepositoryBase<TEntity, TEntityId>`:

```csharp
// Base repository provides:
Task<TEntityId> Add(TEntity entity)
Task<TEntity> GetById(TEntityId id, bool asNoTracking, bool ensureNotNull)
Task Update(TEntity entity, bool beginTracking)
Task<IEnumerable<TEntity>> GetAll()
Task Remove(TEntityId id)
```

Specialized repositories add domain-specific queries (e.g., `GetByCardId`, `CheckBlackList`, `GetByBatches`).

### Read/Write Separation

- Two separate MongoDB instances for read/write operations on logs:
  - **Default** (primary): Active data for all entities
  - **Archive**: Historical anti-fraud logs and Formica sessions (written by archive workers)
- Worker repositories (`AntiFraudResultLogWorkerRepository`, `FormicaSessionWorkerRepository`) write to the Archive context

### Connection Resilience

- `IDistributedLockProvider` registered via `PostgresDistributedSynchronizationProvider` for distributed locking
- HTTP client retry policies configured via `EnableRetries` in RestClient options (configuration-driven)
- Kestrel configured with `MinRequestBodyDataRate`: 50 bytes/sec with 15-second grace period

---

## 7. Messaging & Event Handling

### Message Broker

The service uses `Space.Service.Common.EventBus` (registered via `AddEventBus(configuration, typeof(ThreatDetectionDbContext))` in `InfrastructureExtensions.cs`). The broker configuration is loaded from `EventBusOptions` in appsettings. Kafka certificates are included in the Dockerfile (`ca_cert_kafka.pem`), indicating **Kafka** as the message broker.

### Published Events

All events use the `[ProduceEvent]` attribute with topic `threatdetection`:

| Event Class | Routing Key | Purpose |
|---|---|---|
| `AmlCheckTransferFailedEvent` | `aml-check-transfer-failed` | AML transfer screening failed |
| `AmlCheckTransferSucceededEvent` | `aml-check-transfer-succeeded` | AML transfer screening passed |
| `AmlCheckFailedEvent` | `aml-check-failed` | General AML check failure (automatic case creation) |
| `TmxCheckTransferFailedEvent` | `tmx-check-transfer-failed` | TMX transfer check failed |
| `TmxTransferResultEvent` | `tmx-check-transfer-succeeded` | TMX transfer check succeeded |
| `TmxCheckDepositFailedEvent` | `tmx-check-deposit-failed` | TMX deposit check failed |
| `TmxDepositResultEvent` | `tmx-check-deposit-succeeded` | TMX deposit check succeeded |
| `CheckCbuAntiFraudEvent` | `cbu-check-antifraud-result` | CBU anti-fraud check result |
| `UserBlockedEvent` | `user-blocked` | User blocked by fraud system |
| `UserBlackListedEvent` | `user-blacklisted` | User placed on blacklist |
| `CheckTransferFormicaEvent` | *(consumed internally)* | Trigger Formica check for transfer |
| `CheckDepositFormicaEvent` | *(consumed internally)* | Trigger Formica check for deposit |
| `CheckCustomerFormicaEvent` | *(consumed internally)* | Trigger Formica check for customer |
| `CreateAutomaticCaseEvent` | *(consumed internally)* | Trigger automatic case creation |
| `CaseCreatedEvent` | *(produced)* | Case created notification |
| `BusinessBankingAntiFraudTransferEvent` | *(produced)* | Business banking transfer fraud result |
| `CheckTransferCbuEvent` | *(produced)* | CBU transfer check trigger |
| `CheckTransferCbuReportEvent` | *(produced)* | CBU report generation trigger |
| `SendEmailCommandEvent` | *(produced)* | Send email notification |
| `SmsNotificationEvent` | *(produced)* | Send SMS notification |
| `SendInboxNotificationEvent` | *(produced)* | Send inbox notification |
| `PushNotificationEvent` | *(produced)* | Send push notification |

### Consumed Events

Events consumed via `[ConsumeEvent]` attribute:

| Command Class | Consumed Event | Purpose |
|---|---|---|
| `CreateCustomerCommand` | Customer creation event | Create/sync customer record |
| `UpdateCustomerCommand` | Customer update event | Update customer data |
| `AddCardInAmlStorageCommand` | Card events (multiple bindings) | Store card in AML storage |
| `CheckAmlTransferStatusCommand` | AML transfer check | Screen transfer for AML |
| `CheckCustomerCommand` | Customer check event | Full TMX customer screening |
| `CheckTransferCommand` | Transfer check event | TMX transfer fraud check |
| `CheckDepositCommand` | Deposit check event | TMX deposit fraud check |
| `CheckUserLoginAsyncCommand` | User login async event | Async TMX login check |
| `UnblockCustomerCommand` | Unblock event | Unblock TMX-blocked customer |
| `CheckCbuAntiFraudEventCommand` | CBU check event | CBU anti-fraud check |
| `CheckTransferCbuEventCommand` | CBU transfer event | CBU transfer validation |
| `CheckOnboardingCommand` | Onboarding event | Formica onboarding check |
| `CheckAuthorizationCommand` | Authorization event | Formica authorization check |
| `CheckP2PTransferCommand` | P2P transfer event | Formica P2P transfer check |
| `CheckDepositWithdrawalCommand` | Deposit withdrawal event | Formica deposit/withdrawal check |

### Event Handling Patterns

- **Fire-and-forget** for most outbound events (via `IEventBus.Produce`)
- **Eventual consistency** — consumed events trigger commands that may produce further events
- **Event chaining** — e.g., transfer check → TMX check → result event → Formica check event
- No explicit outbox pattern or saga orchestration detected
- Retry/dead-letter policies managed at the event bus infrastructure level (configuration-driven)

---

## 8. Background Jobs & Scheduled Tasks

All workers extend `CronBackgroundServiceBase` (from `Space.Service.Common.Workers`) and are triggered by configurable cron expressions.

| Worker | Cron Options Class | Purpose |
|---|---|---|
| `DeleteOldLogsWorker` | `DeleteOldLogsWorkerOptions` | Clean old anti-fraud result logs (currently no-op) |
| `AntifraudLogRewriterWorker` | `AntifraudLogRewriterWorkerOptions` | Archive anti-fraud logs from primary to archive MongoDB by sending `ArchiveAntiFraudLogsCommand` |
| `FormicaAntiFraudLogRewriteWorker` | `FormicaAntifraudLogRewriterWorkerOptions` | Archive Formica session logs by sending `ArchiveSessionLogsCommand` |
| `CheckTransferCbuReportWorker` | `CheckTransferCbuReportWorkerOptions` | Generate CBU transfer compliance reports (currently sets tenant only) |
| `RestrictedAppReportWorker` | `RestrictedAppReportWorkerOptions` | Generate restricted app detection reports (sends `GenerateRestrictedAppReportCommand` with email receivers); conditionally registered only if config section exists; checks `Enabled` flag before execution |

Workers set tenant context (`RequestMetadata.Tenant = "TbcUz"`) before dispatching MediatR commands.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Serilog** configured via `UseSerilog(services, configuration)` in `Program.cs`
- **Structured logging** with sensitive data masking via `[SensitiveData]` attribute
- **MediatR LoggingBehavior** logs all requests/responses through the pipeline
- PII properties (names, card numbers, personal numbers, phone numbers) are decorated with `[SensitiveData]` and masked as `"*** HIDDEN ***"` in logs
- GitHub Actions test logger configured for CI test output

### Health Checks

- Registered via `services.AddHealthChecks(configuration)` in `ApiExtensions.cs`
- Exposed via `app.UseHealthCheckMiddleware(env)` in the middleware pipeline
- Implementation provided by `Space.Service.Common.HealthChecks` package

### Rate Limiting / Throttling

Not explicitly configured in this service. The Kestrel `MinRequestBodyDataRate` (50 bytes/sec, 15s grace) provides basic slow-request protection but is not rate limiting.

### Resilience Patterns

| Pattern | Implementation |
|---|---|
| HTTP retry | Configuration-driven via `EnableRetries` in RestClient options per HTTP client |
| Distributed locking | `PostgresDistributedSynchronizationProvider` for cross-instance coordination |
| Timeout control | `X-RestClient-TryTimeoutInMilliseconds` header on CBU client calls |
| Kestrel hardening | `MinRequestBodyDataRate` with grace period |

No explicit Polly circuit-breaker or timeout policies found in application code — resilience is handled by the `Space.Service.Common.RestClient` library internally via configuration.

### Configuration Management

| Source | Purpose |
|---|---|
| `appsettings.Local.json` | Local development configuration |
| Environment variables | `ASPNETCORE_ENVIRONMENT`, `PATH_BASE` |
| Options pattern | 25+ strongly-typed options classes bound via `AddOptions<T>().Bind().ValidateDataAnnotations()` |
| Conditional registration | Sections like `FormicaAuthClientOptions`, `AcuityClientOptions`, worker options are registered only if config section exists |
| Feature toggles | GrowthBook-based via `IFeatureToggle` (e.g., transliteration fallback, personal-number unique ID) |
| Secrets | User Secrets for local development; CA certificates for Kafka in production |

### ThreadPool Configuration

```csharp
ThreadPool.SetMinThreads(100, 100); // Set in Program.cs
```

### GC Configuration (Directory.Build.props)

```xml
<ServerGarbageCollection>true</ServerGarbageCollection>
<GarbageCollectionAdaptationMode>1</GarbageCollectionAdaptationMode>
```

---

## 10. Testing

### Test Projects

| Project | Type | Test Count (files) |
|---|---|---|
| `Space.Service.ThreatDetection.UnitTests` | Unit tests | ~88 files |
| `Space.Service.ThreatDetection.ComponentTests` | Integration/component tests | ~13 files |
| `Space.Service.ThreatDetection.ArchitectureTests` | Architecture fitness tests | ~15 rules |

### Frameworks & Libraries

| Package | Version | Role |
|---|---|---|
| `xUnit` | 2.9.2 | Test framework |
| `NSubstitute` | 5.3.0 | Mocking library |
| `FluentAssertions` | 7.0.0 / 7.2.0 | Assertion library |
| `Testcontainers.MongoDb` | 4.9.0 | MongoDB test containers |
| `Testcontainers.PostgreSql` | 4.7.0 | PostgreSQL test containers (component tests) |
| `WireMock.Net` | 1.5.47 | HTTP mock server (component tests) |
| `Microsoft.AspNetCore.Mvc.Testing` | 9.0.11 | `WebApplicationFactory` (component tests) |
| `EF InMemory` | 9.0.9 | In-memory EF Core provider (unit tests) |
| `NetArchTest.Rules` | 1.3.2 | Architecture rule assertions |
| `coverlet.collector` | 6.0.2 | Code coverage |
| `GitHubActionsTestLogger` | 2.4.1 | CI test result formatting |

### Mocking Strategy

- **NSubstitute** for all mock creation in unit tests
- **Component tests** use `CustomWebApplicationFactory<Program>` which:
  - Replaces EF DbContext with InMemory provider
  - Initializes MongoDB via Testcontainers
  - Creates WireMock server for external HTTP dependencies
  - Substitutes `IAmlService`, `IHumoService`, `IUzcardService`, `IEventBus`, `ISuperCache`
  - Replaces `IFeatureToggle` with `FeatureToggleMockClient`
  - Overrides auth handler to always authorize
  - Recreates `ITmxClient` pointed at WireMock address

### Test Fixtures

**Unit Tests**:
- `InMemoryDbContextFixture` — shared EF Core InMemory DbContext
- `MongoDbFixture` — shared MongoDB Testcontainer
- `MapperFixture` — shared mapper instance
- `LocalizerFixture` — shared string localizer
- `SharedFixtureCollection` — xUnit collection fixture combining all above

**Component Tests**:
- `ThreatDetectionDbFixture` — PostgreSQL Testcontainer
- `AntiFraudLogMongoDbFixture` — MongoDB Testcontainer for archive DB
- `WireMockServerFixture` — WireMock server lifecycle
- `SharedFixtureCollection` — combines all component test fixtures

### Test Naming Convention

```
MethodName_Condition_ExpectedResult
```

### Architecture Tests (Key Rules)

| Rule | Enforces |
|---|---|
| Controllers must not depend on Persistence/Domain/Infrastructure | Layer isolation |
| Controllers must depend on MediatR | CQRS pattern |
| Controllers must inherit `ApiControllerBase` | Consistency |
| Controller names end with `Controller` | Naming convention |
| Domain must not depend on any layer | Domain independence |
| Application must not depend on Persistence/Infrastructure | Clean Architecture |
| API must not depend on Domain | Prevents tight coupling |
| `IRequest<>` implementations end with `Command` or `Query` | CQRS naming |
| `RequestHandlerBase<,>` descendants end with `CommandHandler`/`QueryHandler` | CQRS naming |
| Repository interfaces/implementations end with `Repository` | Consistency |
| `[ConsumeEvent]` classes end with `Command` | Event naming |
| `[ProduceEvent]` classes end with `Event` | Event naming |

---

## 11. DevOps & Deployment

### Dockerfile Analysis

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0       # Runtime-only base image
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt          # Custom CA cert
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt  # Kafka CA cert
RUN update-ca-certificates --verbose            # Trust custom CAs
COPY app/publish .                              # Pre-built publish output
ENV ASPNETCORE_HTTP_PORTS=80                    # Listen on port 80
ENTRYPOINT ["dotnet", "Space.Service.ThreatDetection.Api.dll"]
```

**Note**: This is a simple single-stage Dockerfile. The build happens externally (CI pipeline) and only the publish output is copied.  Custom CA certificates are installed for Kafka and internal service communication.

### CI/CD Pipelines

Referenced in README badges:
- **`ci-cd.yaml`** — combined CI/CD pipeline (GitHub Actions)
- **`cd.yaml`** — deployment-only pipeline

Pipeline files are not in the repository (likely in `.github/workflows/` managed separately or at org level).

### Tools Directory

| Tool | Path | Purpose |
|---|---|---|
| Local setup | `tools/localDevSetup.sh` | Install Trivy, configure git hooks, chmod scripts |
| Code coverage (local) | `tools/codeCoverage/run-tests-with-coverage-local.sh` | Run tests with coverlet |
| Code coverage (precommit) | `tools/codeCoverage/coverage-precommit.sh` | Pre-commit coverage gate |
| Git hooks | `tools/hooks/commit-msg` | Commit message format validation |
| SonarQube | `tools/sonarqube/run-sonar-scan.sh` | Static analysis scan |
| Stryker (mutation) | `tools/stryker/run-stryker.sh`, `run-stryker-full.sh`, `stryker-precommit.sh` | Mutation testing |
| Trivy (secrets) | `tools/trivy/run-trivy-secret-scan.sh`, `secret-rules.yaml` | Secret scanning |
| ZAP | `tools/zap/rules.tsv` | DAST scan rules |

### Docker Compose

No `docker-compose.yml` found in the repository. Local infrastructure (Postgres, MongoDB, Redis) is likely managed via external shared docker-compose or cloud dev environments.

### Environment-Specific Configuration

| Environment | Configuration |
|---|---|
| Local | `appsettings.Local.json` + User Secrets |
| Production | Environment variables + secret management |
| Kestrel | Ports configured via `ASPNETCORE_HTTP_PORTS=80` (Docker) or `launchSettings.json` (local: 5141/7141) |

---

## 12. External Service Dependencies

### HTTP Clients

All HTTP clients use RestEase interfaces registered via `AddRestClient<T>()` from `Space.Service.Common.RestClient`.

| Client Interface | External Service | Key Operations | Conditional |
|---|---|---|---|
| `ITmxClient` | ThreatMetrix (TMX) | `POST api/session-query` (check), `POST api/update` (unblock) | No |
| `IAcuityClient` | Acuity (AML screening) | OAuth token, import screening | Yes |
| `IFormicaClient` | Formica (anti-fraud engine) | `POST transaction/v1` (check, check with auth) | Yes |
| `IFormicaAuthClient` | Formica Keycloak | OAuth token exchange (per-tenant) | Yes |
| `ICbuAntiFraudClient` | CBU Anti-Fraud API | `POST query` (card/phone check) | No |
| `IHumoClient` | Humo Card Network | PINFL lookup, card details | Yes |
| `IUzcardClient` | Uzcard Card Network | Card details by number | Yes |
| `IGenesysClient` | Genesys Call Center | `GET /api/v1/call/{phone}` (active call check) | Yes |
| `ICustomerDataCollectorClient` | Internal Data Collector | App restrictions blacklist, installed apps by user | No |
| `GetCustomerAndProductsPortType` (SOAP) | TIBCO AML Service | Customer gov restrictions, AML scores, accounts, deposits | Yes |

### Client Configuration

- Typed HTTP clients via RestEase with options pattern (e.g., `TmxClientOptions`, `AcuityClientOptions`)
- Base URLs configured per-environment in appsettings
- `EnableRetries` flag per client
- Conditional registration — clients only registered if their config section exists
- `ISuperCache` used for token caching (Acuity, Formica auth)
- SOAP client generated via `svcutil` from WSDL (`SPB_GetCustomerAndProducts(typed).wsdl`)

### Resilience for Outgoing Calls

- Retry policies via `EnableRetries` configuration flag (handled by RestClient library)
- Timeout control via `X-RestClient-TryTimeoutInMilliseconds` header (CBU client)
- Token caching prevents redundant auth calls (Acuity, Formica)

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Table

| Pattern | Where Used | Why |
|---|---|---|
| Clean Architecture | Solution structure (5 layers) | Enforce dependency rules, testability |
| CQRS | `Application/Features/` with Command/Handler pairs | Separate read/write concerns, single responsibility handlers |
| MediatR | All controller→handler dispatch | Decouple API from business logic, enable pipeline behaviors |
| Repository Pattern | `Application/Repositories/` (interfaces) ↔ `Persistence/Repositories/` (impl) | Abstract data access, support dual DB (Postgres + MongoDB) |
| Feature-based Organization | `Features/{Domain}/Commands/` | Group related code by business capability |
| Event-Driven Architecture | `ProduceEvent`/`ConsumeEvent` attributes, `IEventBus` | Async communication with other services |
| Options Pattern | 25+ options classes in `Application/Options/` | Strongly-typed, validated configuration |
| Conditional Service Registration | `Infrastructure/InfrastructureExtensions.cs` | Tenant-specific features, optional integrations |
| Background Workers (Cron) | `Infrastructure/Workers/` (5 workers) | Scheduled log archival and reporting |
| Architecture Tests | `ArchitectureTests` project (NetArchTest) | Prevent architecture erosion at build time |
| Sensitive Data Masking | `[SensitiveData]` attribute throughout | PII protection in logs |
| Multi-tenancy | `RequestMetadata.Tenant`, `Space.Service.Common.Factory` | Support multiple tenant contexts (TbcUz primary) |
| Dual Database | PostgreSQL (relational) + MongoDB (documents) | Relational for customers, documents for flexible fraud logs |
| Token Caching | `ISuperCache` for Acuity/Formica tokens | Reduce external auth calls |

### Notable Deviations

| Observation | Detail |
|---|---|
| All operations are Commands | No Query classes exist despite CQRS naming — even read operations (blacklist checks) are modeled as Commands. This is consistent since most "reads" trigger side effects (logging, event publishing). |
| Anemic Domain | The Domain layer contains only data entities and enums — all business logic is in Application handlers and Infrastructure services. No domain events, value objects, or aggregate roots. |
| Mixed PostgreSQL + MongoDB | `Customers` entity has both EF Core configuration and a MongoDB repository, suggesting a transition or dual-write pattern. |
| Some workers are no-ops | `DeleteOldLogsWorker` and `CheckTransferCbuReportWorker` have empty `Execute` methods — possibly feature-flagged or in-progress. |
| `Customers` entity naming (plural) | Entity classes like `Customers`, `SuspiciosCards` use plural names — deviates from typical C# singular naming convention. |
| `SuspiciosCards` typo | "Suspicous" is misspelled as "Suspiciosm" throughout entity, repository, and enum names. |
| Deprecated endpoint | `blacklist-check/card-details/anonymous` is marked `[Obsolete]` but still present. |

### Technical Debt & Improvement Opportunities

| Area | Observation |
|---|---|
| **No-op workers** | `DeleteOldLogsWorker` and `CheckTransferCbuReportWorker` execute nothing — should be completed or removed |
| **Missing Queries** | True read-only operations could benefit from separate Query classes for cleaner CQRS separation |
| **Naming inconsistencies** | Plural entity names (`Customers`, `SuspiciosCards`), typo in `Suspiciosm` |
| **Dockerfile optimization** | Single-stage Dockerfile — a multi-stage build would be more secure and reduce image size |
| **Hardcoded tenant** | Workers hardcode `"TbcUz"` as tenant — could be configurable |
| **No circuit breaker** | No explicit circuit breaker policy for external service calls (Acuity, TMX, Formica) |
| **Empty Exceptions folder** | `Domain/Exceptions/` contains only `.gitkeep` — custom exceptions could improve error handling |
| **Empty seeder** | `Seeder.cs` methods return `Task.CompletedTask` — no active seed data |
| **Deprecated endpoint still active** | `CheckCardInBlacklistAnonymous` should be removed or migration plan documented |
| **Large controller** | `AntiFraudController` has 30+ endpoints — could benefit from splitting into smaller controllers |

---

*Generated from full codebase analysis of the `Space.Service.ThreatDetection` repository.*
