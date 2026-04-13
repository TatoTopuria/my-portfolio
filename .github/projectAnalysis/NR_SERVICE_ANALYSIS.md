# Space.Service.NationalRegistry — Comprehensive Service Analysis

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

**Space.Service.NationalRegistry** is a .NET 9 microservice owned by the **onboarding-baas** team. It serves as the central integration gateway for national identity registry systems in Uzbekistan — specifically **MyID** (biometric identity verification) and **E-Gov** (government electronic services) — to fetch, validate, and persist personal, document, address, and license data.

### Core Business Problem

The service solves the problem of **digital identity verification and KYC (Know Your Customer)** for a banking platform operating in Uzbekistan. It abstracts away the complexity of communicating with multiple government APIs (MyID, E-Gov, fake/staging E-Gov variants) and provides a unified interface for downstream services to retrieve verified citizen and non-resident identity data.

### Domain Context — Bounded Context

This service represents the **Identity & National Registry** bounded context within the onboarding domain. It owns the lifecycle of national registry data retrieval, archival, and propagation to other bounded contexts (e.g., customer onboarding, verification) via events.

### Key Entities & Domain Models

| Entity | Location | Description |
|--------|----------|-------------|
| `NationalRegistryArchive` | `Domain/Entities/NationalRegistryArchive.cs` | Archived personal identity data (name, birth, document, address, tax info) retrieved from MyID/E-Gov, with `SourceType` tracking |
| `PersonData` | `Domain/Entities/PersonData.cs` | Persistent person identity record with full document details, address, liveness status, validation date, and operation type |
| `NonResidentData` | `Domain/Entities/NonResidentData.cs` | Non-resident identity record with proposal period, living address, and data source (QR or E-Gov) |
| `Customer` | `Domain/Entities/Customer.cs` | Lightweight customer record with personal number, region/area codes, mahalla ID, and verification status |
| `MahallaReference` | `Domain/Entities/MahallaReference.cs` | Address mapping reference table (mahalla ID → mahalla ID CAD, region ID, district ID) |
| `MahallaIdMapping` | `Domain/Entities/MahallaIdMapping.cs` | Legacy mahalla ID mapping (deprecated, replaced by `MahallaReference`) |

### Main Use Cases & Workflows

1. **Identity Retrieval (Residents)** — Fetch personal data from MyID via biometric verification or from E-Gov by personal number/passport, with fallback from E-Gov → MyID.
2. **Document Validation** — Validate passport/ID card status and expiry against E-Gov, check if document data is valid.
3. **Personal Number Lookup** — Resolve personal numbers (PINFL) from E-Gov for a given birth date.
4. **Person Data Persistence** — Persist validated person data with document status tracking, deduplication, and event publishing.
5. **Non-Resident Management** — Validate non-resident documents via E-Gov OVIR data, scrape QR codes from `emehmon.uz`, persist non-resident records.
6. **License Lookup** — Retrieve business licenses for legal entities (by TIN) and individual entrepreneurs (by PINFL) from E-Gov.
7. **Address Resolution** — Fetch and normalize address data from E-Gov with mahalla ID mapping and fallback logic.
8. **Customer Data Sync** — Consume `customer-created` and `customer-updated` events to maintain local customer records.
9. **Archive Cleanup** — Scheduled deletion of old `NationalRegistryArchive` records.

---

## 2. Architecture

### Architectural Pattern

The service follows **Clean Architecture** with **CQRS** (Command Query Responsibility Segregation) via MediatR. This is confirmed by:

- **Folder structure**: Separate projects for `Api`, `Application`, `Domain`, `Infrastructure`, and `Persistence`, each with clear responsibilities.
- **Dependency direction**: Domain has zero dependencies on other layers; Application depends only on Domain; Infrastructure and Persistence depend on Application; API depends on all.
- **CQRS handlers**: All business operations are modeled as `Command` or `Query` classes handled by `RequestHandlerBase<TRequest, TResponse>` derivatives.
- **Architecture tests**: `ArchitectureTests.cs` enforces these boundaries at compile time via `NetArchTest.Rules`.

### Project Structure Breakdown

```
Space.Service.NationalRegistry.sln
├── Space.Service.NationalRegistry.Api/              # Presentation layer
│   ├── Controllers/                                  # HTTP controllers (NationalRegistryController, LicenseController)
│   ├── ApiExtensions.cs                              # DI registration for API concerns
│   ├── Program.cs                                    # Application entry point
│   └── Dockerfile                                    # Container build definition
│
├── Space.Service.NationalRegistry.Application/       # Business logic layer (THE core)
│   ├── Features/                                     # CQRS commands & queries organized by feature
│   │   ├── Customer/                                 # CreateCustomer, UpdateCustomer (event consumers)
│   │   ├── Document/                                 # CheckPassportData, DocumentData queries
│   │   ├── License/                                  # IndividualEntrepreneurLicenses, LegalEntityLicenses
│   │   └── Person/                                   # 15+ queries and commands for person data
│   ├── HttpClients/                                  # RestEase interfaces for MyID and E-Gov
│   ├── Options/                                      # Strongly-typed configuration classes
│   ├── Repositories/                                 # Repository interfaces (abstractions)
│   ├── Services/                                     # Service interfaces & some implementations
│   ├── Dtos/                                         # Shared DTOs (AddressType, CustomerDtos)
│   ├── StorageClient/                                # S3 storage client interface
│   └── Resources/                                    # Localization files (.resx)
│
├── Space.Service.NationalRegistry.Domain/            # Domain model layer
│   ├── Entities/                                     # 6 entity classes
│   ├── Enums/                                        # 10 enum types (error codes, source types, etc.)
│   ├── Attributes/                                   # Custom attributes (IgnoreNullCheckAttribute)
│   ├── Constants/                                    # (empty — reserved)
│   └── Exceptions/                                   # (empty — uses Space.Service.Common.Exceptions)
│
├── Space.Service.NationalRegistry.Infrastructure/    # External integration implementations
│   ├── Services/TbcUz/                               # Tenant-specific service implementations
│   │   ├── NationalRegistryService.cs                # Core MyID/E-Gov integration (~1200 lines)
│   │   ├── NonResidentService.cs                     # Non-resident E-Gov integration
│   │   ├── NonResidentQrService.cs                   # QR code scraping from emehmon.uz
│   │   ├── PersonDataService.cs                      # Person data persistence orchestration
│   │   ├── MediaProcessingService.cs                 # S3 file upload/download
│   │   └── Events/                                   # Produced event definitions
│   └── Workers/                                      # Background workers
│
├── Space.Service.NationalRegistry.Persistence/       # Data access layer
│   ├── NationalRegistryDbContext.cs                  # EF Core DbContext
│   ├── PersistenceExtensions.cs                      # DI registration
│   ├── Configurations/                               # EF Core entity configurations
│   ├── Repositories/                                 # Repository implementations
│   ├── Migrations/                                   # EF Core migrations
│   └── Seeder.cs                                     # Data seeding (empty)
│
├── Space.Service.NationalRegistry.UnitTests/         # Unit test project
├── Space.Service.NationalRegistry.ComponentTests/    # Integration/component test project
├── Space.Service.NationalRegistry.ArchitectureTests/ # Architecture enforcement tests
├── Space.Service.NationalRegistry.CITools/           # CI tooling (event schema & contract generation)
└── tools/                                            # Dev scripts, security scanning, code coverage
```

### Dependency Flow Direction

```
Domain ← Application ← Infrastructure
                     ← Persistence
                     ← Api (references Application, Infrastructure, Persistence)
```

- **Domain** → no project references; only `Space.Service.Common.Persistence` and `Space.Service.Common.Logging` packages.
- **Application** → references only Domain.
- **Persistence** → references Application (for repository interfaces).
- **Infrastructure** → references Application and Persistence.
- **Api** → references Application, Infrastructure, and Persistence (for DI registration at composition root).

### CQRS Organization

| Aspect | Detail |
|--------|--------|
| **Mediator** | MediatR via `Space.Service.Common.Mediator` package |
| **Base class** | Handlers extend `RequestHandlerBase<TRequest, TResponse>` |
| **Commands** | `CreateCustomerCommand`, `UpdateCustomerCommand`, `PersistNonResidentDocumentDetailsCommand` |
| **Queries** | 19 query types across Person, Document, and License features |
| **Validators** | FluentValidation validators co-located with their command/query |
| **Pipeline** | `LoggingBehavior<,>` → `ValidationBehavior<,>` → Handler |

### DDD Patterns

The service uses a **lightweight DDD** approach:

- **Entities**: All derive from `EntityBase<TEntityId>` (from `Space.Service.Common.Persistence`), which provides `Id`, `Timestamp`, and `UpdateTimestamp`.
- **Repository pattern**: Interfaces in Application layer, implementations in Persistence layer.
- **No Aggregates**: An `Aggregates/` folder exists in Domain but is explicitly excluded from compilation (`<Compile Remove="Aggregates\**" />`).
- **No Domain Events**: Events are produced at the infrastructure/application level, not from domain entities.
- **Value Objects**: Not explicitly used; address data is modeled as DTOs.

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Item | Version |
|------|---------|
| Runtime | .NET 9.0 |
| Language | C# (latest features, file-scoped namespaces) |
| Target Framework | `net9.0` |

### Primary Frameworks

| Framework | Version | Role |
|-----------|---------|------|
| ASP.NET Core | 9.0 | Web API framework |
| Entity Framework Core | 9.0.1 | ORM / data access |
| MediatR | via `Space.Service.Common.Mediator 2.9.8` | CQRS mediator |
| FluentValidation | via `Space.Service.Common.Mediator` | Request validation |
| AutoMapper | via `Space.Service.Common.Mapping 2.9.2` | Object mapping |

### Significant NuGet Packages

| Package | Version | Role |
|---------|---------|------|
| `Space.Service.Common.Auth` | 2.9.9 | IdentityServer authentication |
| `Space.Service.Common.HealthChecks` | 2.9.10 | Health check endpoints |
| `Space.Service.Common.Middlewares` | 2.9.11 | Standard middleware pipeline |
| `Space.Service.Common.Swagger` | 2.9.13 | Swagger/OpenAPI documentation |
| `Space.Service.Common.Misc` | 2.9.67 | Shared utilities (country codes, region mapping, etc.) |
| `Space.Service.Common.Logging` | 2.9.9 | Serilog-based structured logging, `[SensitiveData]` attribute |
| `Space.Service.Common.Caching` | 2.9.15 | `ISuperCache` — distributed caching abstraction |
| `Space.Service.Common.EventBus` | 2.9.35 | Event bus for producing/consuming messages |
| `Space.Service.Common.RestClient` | 2.9.23 | RestEase-based typed HTTP client registration |
| `Space.Service.Common.Persistence` | 2.9.13 | `EntityBase`, `DbContextBase`, `IUnitOfWork` |
| `Space.Service.Common.Factory` | 2.9.9 | Tenant-specific service resolution (`[Service]`, `[IService]`) |
| `Space.Service.Common.FeatureToggle` | 2.9.16 | GrowthBook-based feature flags |
| `Space.Service.Common.Storage` | 2.9.3 | S3-compatible object storage client |
| `Space.Service.Common.Workers` | 2.9.13 | Background service base classes (`CronBackgroundServiceBase`) |
| `Space.Service.Common.Exceptions` | 2.9.9 | Structured exception types (`AppException`, `ObjectNotFoundException`) |
| `Space.Service.Common.Soap` | 2.9.8 | SOAP client support |
| `Space.Service.Common.CodeAnalyzers` | 2.9.6 | Custom Roslyn analyzers (sensitive data, etc.) |
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus metrics exposure |
| `HtmlAgilityPack` | 1.11.74 | HTML parsing for QR code scraping |
| `ISO3166` | 1.0.4 | Country code resolution |
| `Asp.Versioning` | (transitive) | API versioning |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |
| `System.ServiceModel.*` | 6.0–8.1 | WCF/SOAP client support |

### Database

| Item | Detail |
|------|--------|
| Database | **PostgreSQL** |
| Provider | `Npgsql.EntityFrameworkCore.PostgreSQL` (via `UseNpgsql()`) |
| ORM | Entity Framework Core 9.0 |

### Caching Layer

- **In-memory cache**: `services.AddMemoryCache()` registered in `InfrastructureExtensions.cs`.
- **Distributed cache**: `ISuperCache` (from `Space.Service.Common.Caching`) used for caching MyID and E-Gov access tokens with TTL-based expiry.

### Logging & Observability

| Tool | Role |
|------|------|
| **Serilog** | Structured logging via `UseSerilog()` in `Program.cs` |
| **Prometheus** | Metrics via `prometheus-net.AspNetCore`, exposed at `/metrics` |
| **APM** | `AddApm(configuration)` in `Program.cs` (Application Performance Monitoring) |
| **`[SensitiveData]` attribute** | PII masking in logs for names, birth dates, documents, etc. |

---

## 4. API Layer & Communication

### API Style

**REST** — JSON over HTTP with API versioning.

### API Versioning Strategy

- URL-based versioning: `api/v{version:apiVersion}/[controller]`
- Default version: `1.0`
- Version `2.0` available for `person-data-without-passport` endpoint
- Versioning registered via `services.AddVersioning()` from `Space.Service.Common.Swagger`

### Authentication & Authorization

- **IdentityServer authentication** registered via `services.AddIdentityServerAuthentication(configuration)`.
- Base controller `ApiControllerBase` is decorated with `[Authorize]`.
- Individual endpoints selectively use `[AllowAnonymous]` for service-to-service calls.
- Some endpoints marked `[NonProduction]` to restrict access in production environments.

### Endpoints — NationalRegistryController

Route prefix: `api/v{version:apiVersion}/nationalregistry`

| HTTP Method | Route | Handler | Auth | Description |
|-------------|-------|---------|------|-------------|
| POST | `get-personal-information` | `PersonalInformationFromMyIdQuery` | Anonymous | Get personal data from MyID or archive |
| POST | `getuserdata` *(obsolete)* | `DataQuery` | Authorized | Get data from MyID (legacy) |
| POST | `person-data` | `DataQuery` | Authorized | Get data from MyID |
| POST | `person-data-without-passport` (v1) | `DataWithoutPassportQuery` | Anonymous | Get data without passport from MyID |
| POST | `person-data-without-passport` (v2) | `DataWithoutPassportV2Query` | Anonymous | Get data without passport using photo path |
| POST | `personal-number` | `PersonalNumberQuery` | Authorized | Get personal number from archive or E-Gov |
| POST | `person-data-by-personalnumber` *(obsolete)* | `DataWithPersonalNumberQuery` | Anonymous | Get data by personal number (legacy) |
| POST | `person-data-with-personal-number` | `DataWithPersonalNumberQuery` | Anonymous | Get data with personal number from E-Gov |
| POST | `customerdatafordocumentvalidation` *(obsolete)* | `DocumentDataQuery` | Anonymous | Get document data (legacy) |
| POST | `document-data` | `DocumentDataQuery` | Authorized | Get document data from E-Gov |
| POST | `check-passport-data` | `CheckPassportDataQuery` | Authorized | Validate passport data with E-Gov |
| POST | `get-person-data-by-personalnumber` | `PersonInfoByPersonalNumberQuery` | Anonymous | Get person data with active document |
| POST | `get-person-details-by-personalnumber` | `PersonDetailsByPersonalNumberQuery` | Anonymous | Get person details with active document |
| POST | `non-resident-QR` | `ScrapePersonalInfoWithQrQuery` | Anonymous | Get non-resident info from QR code |
| POST | `non-resident/validate-document` | `ValidateNonResidentDocumentQuery` | Anonymous | Validate non-resident document |
| POST | `non-resident/persist-document-details` | `PersistNonResidentDocumentDetailsCommand` | Authorized | Persist non-resident document details |
| POST | `non-resident/source-by-personal-number` | `NonResidentSourceByPersonalNumberQuery` | Anonymous | Get non-resident source from DB |
| POST | `personal-numbers` | `GetPersonalNumbersQuery` | Anonymous | Get personal numbers from E-Gov |
| POST | `get-data-from-egov` | `EgovPersonDataQuery` | Anonymous, NonProd | Get raw data from E-Gov |
| POST | `get-address-from-egov` | `EgovAddressDataQuery` | Anonymous, NonProd | Get raw address from E-Gov |
| POST | `non-resident/get-non-resident-details` | `NonResidentDetailsQuery` | Anonymous | Get non-resident details |

### Endpoints — LicenseController

Route prefix: `api/v{version:apiVersion}/license`

| HTTP Method | Route | Handler | Auth | Description |
|-------------|-------|---------|------|-------------|
| POST | `legal-entity` | `LegalEntityLicensesQuery` | Anonymous | Get licenses for legal entity by TIN |
| POST | `individual-entrepreneur` | `IndividualEntrepreneurLicensesQuery` | Anonymous | Get licenses for individual entrepreneur by PINFL |

### Request/Response Patterns

- All requests are **POST** with JSON body (command/query objects).
- Responses wrapped via `OkResult()` helper returning `ObjectResult` with status 200.
- Each query/command defines its own strongly-typed response class (e.g., `PersonalInformationFromMyIdResponse`, `DataResponse`).
- Swagger documentation via `[ApiOperation]`, `[ApiSuccessResponse]`, and `[ApiErrorResponse]` custom attributes.

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

Registered in `ApiExtensions.ConfigureAPI()` in the following order:

```csharp
app.UsePathBase(pathBase);              // 1. Path base (/nationalregistry)
app.UseLocalization();                   // 2. Request localization
app.UseHttpsRedirection();               // 3. HTTPS redirect
app.UseRouting();                        // 4. Routing
app.UseHttpMetrics();                    // 5. Prometheus HTTP metrics
app.UseAuthentication();                 // 6. IdentityServer authentication
app.UseStaticFiles();                    // 7. Static files (wwwroot)
app.UseAuthorization();                  // 8. Authorization policies
app.UseMiddlewares();                    // 9. Common middlewares (from Space.Service.Common.Middlewares)
app.UseHealthCheckMiddleware(env);       // 10. Health check endpoints
app.UseEventEndpoints();                 // 11. Event bus consumer endpoints
app.UseVersionEndpoint(configuration);   // 12. Version info endpoint
endpoints.MapControllers();              // 13. Controller routing
endpoints.MapMetrics();                  // 14. Prometheus /metrics endpoint
app.UseWorkerTriggerEndpoints();         // 15. Manual worker trigger endpoints
app.UseSwagger(env, provider, pathBase); // 16. Swagger UI
```

### MediatR Pipeline Behaviors

Registered in `ApplicationExtensions.cs`:

```csharp
cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));     // 1. Logs request/response
cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));  // 2. Runs FluentValidation
// → Handler execution                                // 3. Business logic
```

### Global Exception/Error Handling

- Handled by `Space.Service.Common.Middlewares` (registered via `app.UseMiddlewares()`).
- Domain exceptions use `AppException` with localized messages and enum-based error codes.
- `ObjectNotFoundException` for missing entities.
- API behavior: `SuppressModelStateInvalidFilter = true` — model state errors are not auto-returned; validation is handled by `ValidationBehavior`.

### Request Validation

- **FluentValidation** validators registered from assembly scan in `ApplicationExtensions.cs`.
- Validators exist for: `DataQuery`, `GetPersonalNumbersQuery`, `NonResidentDetailsQuery`, `PersonalInformationFromMyIdQuery`, `PersonalNumberQuery`, `ValidateNonResidentDocumentQuery`.
- `ValidationBehavior<,>` runs all matching validators before the handler executes.
- Display names configured via `ValidatorOptions.Global.DisplayNameResolver` to use camelCase property names.

### Correlation ID / Request Tracing

- Managed by `Space.Service.Common.Middlewares` which propagates correlation IDs through the request pipeline.
- APM (Application Performance Monitoring) registered via `AddApm(configuration)`.

---

## 6. Data Layer

### Database Type & Provider

| Item | Detail |
|------|--------|
| Database | PostgreSQL |
| EF Core Provider | `Npgsql.EntityFrameworkCore.PostgreSQL` |
| Connection string key | `"NpgSql"` |

### ORM Configuration

**DbContext**: `NationalRegistryDbContext` extends `DbContextBase` (from `Space.Service.Common.Persistence`), which provides automatic `Timestamp`/`UpdateTimestamp` tracking.

**DbSets**:

```csharp
public DbSet<NationalRegistryArchive> NationalRegistryArchives { get; set; }
public DbSet<PersonData> PersonDatas { get; set; }
public DbSet<NonResidentData> NonResidentData { get; set; }
public DbSet<MahallaIdMapping> MahallaIdMapping { get; set; }
public DbSet<MahallaReference> MahallaReferences { get; set; }
public DbSet<Customer> Customers { get; set; }
```

**Indexes** (defined in `OnModelCreating`):

| Entity | Index | Name |
|--------|-------|------|
| `PersonData` | `PINFL` | `IX_PersonData_PINFL` |
| `MahallaIdMapping` | `MahallaId` | `IX_MahallaIdMapping_MahallaId` |
| `MahallaReference` | `MahallaId` | `IX_MahallaReference_MahallaId` |
| `NationalRegistryArchive` | `(DocumentSeries, DocumentId, BirthDate)` | Composite (configuration) |
| `NonResidentData` | `PersonalNumber` | (configuration) |
| `Customer` | `PersonalNumber` | (configuration) |

**Entity Configurations** (in `Persistence/Configurations/`):

- `CustomerConfiguration` — table `Customers`, index on `PersonalNumber`.
- `NationalRegistryArchiveConfiguration` — table `NationalRegistryArchives`, `PermanentAddress` and `TempAddress` as `jsonb` columns, composite index.
- `NonResidentDataConfiguration` — table `NonResidentData`, index on `PersonalNumber`.

### Migration Strategy

- **EF Core Code-First Migrations** in `Persistence/Migrations/`.
- Migrations assembly set to `Space.Service.NationalRegistry.Persistence`.
- On startup: `db.Database.Create().Wait()` then `db.Database.Migrate()` (auto-migration on deployment).

### Repository Pattern

All repositories follow the same pattern:

1. **Interface** defined in `Application/Repositories/` (e.g., `IPersonDataRepository`).
2. **Implementation** in `Persistence/Repositories/` (e.g., `PersonDataRepository`).
3. **Base class**: `RepositoryBase<TEntity, TEntityId>` provides standard CRUD operations.
4. Each repository adds domain-specific query methods.
5. Registered as **scoped** in `PersistenceExtensions.cs`.

| Repository | Specialization |
|------------|----------------|
| `NationalRegistryArchiveRepository` | `GetArchiveByDocument()`, `DeleteOldRecords()` |
| `PersonDataRepository` | `GetPersonDatasByPersonalNumber()`, `UpdateValidationDateLatestRecord()`, `UpdateDocumentsStatus()` (bulk update via `ExecuteUpdateAsync`) |
| `NonResidentRepository` | `GetByDocument()`, `GetByPersonalNumber()` |
| `CustomerRepository` | `GetVerifiedCustomerByPersonalNumberAsync()` |
| `MahallaReferenceRepository` | `GetMahallaIdCadByMahallaId()`, `GetDefaultMahallaIdCadByDistrict()`, `GetDistrictIdByMahallaIdCad()`, `GetRegionIdByMahallaIdCad()` |
| `MahallaIdMappingRepository` | `GetMahallaIdCadByMahallaId()` *(deprecated)* |

### Unit of Work

`IUnitOfWork` from `Space.Service.Common.Persistence` is registered in `PersistenceExtensions.cs` and used in `PersonDataService` for transactional operations spanning multiple repository writes + event publishing.

### Connection Resilience

- Kestrel configured with `MinRequestBodyDataRate` (50 bytes/sec, 15s grace period).
- `ThreadPool.SetMinThreads(100, 100)` for I/O-heavy workloads.
- Server GC enabled via `Directory.Build.props`.

---

## 7. Messaging & Event Handling

### Message Broker

The service uses **`Space.Service.Common.EventBus`** (version 2.9.35), which is registered via:

```csharp
services.AddEventBus(configuration, typeof(NationalRegistryDbContext));
```

The underlying broker is configured externally (likely Kafka, given `ca_cert_kafka.pem` in the Dockerfile).

### Published Events

| Event Class | Topic | Event Name | Purpose |
|-------------|-------|------------|---------|
| `NationalRegistryValidatedEvent` | `national-registry` | `national-registry-validated` | Published when person data is validated from MyID and archived |
| `PersonInfoUpdatedEvent` | `national-registry` | `national-registry-person-info-updated` | Published when person data is persisted/updated with full identity + address details |
| `CustomerDataRetrievedEvent` | `national-registry` | `customer-data-retrieved` | Published when document data is retrieved from E-Gov (for liveness check) |
| `NationalRegistryCalledEvent` | `national-registry` | `national-registry-called` | Audit event tracking every call to MyID or E-Gov (with source name + residency type) |

### Consumed Events

| Event Class | Event Name | Triggered Action |
|-------------|------------|------------------|
| `CreateCustomerCommand` | `customer-created` | Creates a local Customer record when a customer is created in another service |
| `UpdateCustomerCommand` | `customer-updated` | Updates the local Customer record when customer data changes |

### Event Patterns

- **Event-driven integration**: The service produces events to notify downstream services (e.g., customer onboarding) about identity data changes.
- **Outbox pattern**: Implied by `AddEventBus(configuration, typeof(NationalRegistryDbContext))` — the DbContext type is passed to enable transactional outbox.
- **Unit of Work + Event Bus**: `PersonDataService` wraps repository writes and event publishing in a single transaction via `IUnitOfWork`.

### Retry & Error Handling

- Retry and dead-letter policies are managed by the `Space.Service.Common.EventBus` package configuration (not explicitly defined in service code).
- Consumer endpoints exposed via `app.UseEventEndpoints()`.

---

## 8. Background Jobs & Scheduled Tasks

### Workers

| Worker | Base Class | Schedule | Purpose |
|--------|-----------|----------|---------|
| `DeleteOldNationalRegistryArchiveRecordsWorker` | `CronBackgroundServiceBase` | Cron expression from `DeleteOldNationalRegistryArchiveWorkerOptions.Cron` (configurable, supports seconds) | Deletes `NationalRegistryArchive` records older than `OlderThanInMonths` (configurable) |

The worker:

- Registered via `services.AddWorkersLibrary(configuration)` in `PersistenceExtensions.cs`.
- Can be triggered manually via `app.UseWorkerTriggerEndpoints()`.
- Uses `Cronos.CronExpression` for cron parsing with UTC timezone mode.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Serilog** configured via `builder.Host.UseSerilog(builder.Services, builder.Configuration)`.
- **Structured logging**: Log properties include `PassportHash` (SHA256), `MahallaId`, `DistrictId`, `CustomerId`.
- **PII protection**: `[SensitiveData]` attribute on entity/DTO properties masks values in logs.
- **Log levels**: `Information` for normal operations and non-critical failures, `Warning` for rate limits and mapping failures, `Error` for integration failures.
- **Pipeline behavior**: `LoggingBehavior<,>` logs every MediatR request/response.

### Health Checks

- Registered via `services.AddHealthChecks(configuration)` from `Space.Service.Common.HealthChecks`.
- Middleware: `app.UseHealthCheckMiddleware(env)`.

### Rate Limiting

- No explicit rate limiting configured in the service. However, the service handles HTTP 429 (Too Many Requests) responses from MyID gracefully, throwing `MyIdErrorCode.TOO_MANY_REQUEST`.

### Resilience Patterns

| Pattern | Implementation |
|---------|----------------|
| **Token caching** | `ISuperCache.GetOrAdd()` caches MyID and E-Gov access tokens with TTL = `ExpiresIn - 10` seconds |
| **Polling with timeout** | `PollAuthenticationStatus()` polls MyID job status with 500ms intervals, 30-second timeout |
| **Fallback** | E-Gov → MyID fallback in `FetchPersonDataFromExternalSources()` |
| **Feature-flagged fake services** | Fake E-Gov clients (`IFakeEgovClient`) for non-production testing |
| **Address fallback chain** | MyID address → E-Gov address → verified customer address → mahalla defaults |

### Configuration Management

| Method | Detail |
|--------|--------|
| **appsettings.json** | Standard JSON config |
| **External config files** | `/settings/globalsettings.json`, `/settings/appsettings.json`, `/settings/dbsettings.json` (in non-local environments) |
| **Config watching** | `builder.Configuration.Watch(settingsFilePaths)` for hot-reload |
| **User Secrets** | `UserSecretsId` configured for local development |
| **Options pattern** | 14 strongly-typed options classes bound via `IOptions<T>` / `IOptionsSnapshot<T>` with `ValidateDataAnnotations().ValidateOnStart()` |
| **Environment variables** | `PATH_BASE`, `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_HTTP_PORTS` |

**Options classes** (all in `Application/Options/`):

| Class | Purpose |
|-------|---------|
| `MyIdClientOptions` | MyID API credentials and client configuration |
| `EgovClientOptions` | E-Gov API configuration |
| `EgovTokenClientOptions` | E-Gov token endpoint configuration |
| `EgovGetUserDocumentOptions` | E-Gov document request parameters (language, consent, photo flag, document type regex mapping) |
| `EgovResponseMapping` | Country/region/city code mapping dictionaries |
| `FakeEgovClientOptions` | Fake E-Gov API configuration (for testing) |
| `FakeEgovTokenClientOptions` | Fake E-Gov token configuration |
| `NationalRegistryArchiveOptions` | Archive behavior configuration |
| `DeleteOldNationalRegistryArchiveWorkerOptions` | Worker schedule (cron) and retention period |
| `PersonInfoDateValidationOptions` | Date validation rules |
| `VerificationStorageOptions` | S3 bucket configuration for media storage |
| `CitizenshipWhitelistOptions` | Allowed citizenship MVD IDs for non-residents |
| `NonResidentQrOptions` | QR validation rules (registration period days, expiration proximity days, document validity months) |
| `EmployeeWhitelistOptions` | Whitelisted personal numbers for bypassing certain validations |

### Feature Toggles

GrowthBook-based feature flags used extensively:

| Toggle Name | Purpose |
|-------------|---------|
| `onboarding-mocked-egov` | Use fake E-Gov client in non-production |
| `onboarding-birthdate-from-request` | Use birth date from request instead of extracting from personal number |
| `onboarding-updated-address-merging` | Enable updated address merging logic |
| `onboarding-egov-selfie-retrieve` | Enable selfie retrieval from E-Gov |
| `onboarding-myId-response-mapping` | Use manual MyID response mapping instead of AutoMapper |
| `onboarding-myId-get-address-fallback` | Enable separate address fetch from MyID when primary is empty |
| `onboarding-mahalla-refactored-mapping` | Use `MahallaReference` instead of legacy `MahallaIdMapping` |
| `onboarding-mahalla-default-value-from-district` | Fall back to default mahalla when mapping fails |
| `onboarding_optimized_mahalla_mapping` | Enable optimized mahalla resolution chain |
| `onboarding-verified-customer-mahalla-optimization` | Fall back to verified customer's mahalla data |

---

## 10. Testing

### Test Projects

| Project | Type | Purpose |
|---------|------|---------|
| `Space.Service.NationalRegistry.UnitTests` | Unit Tests | Test handlers, services, and domain logic with mocked dependencies |
| `Space.Service.NationalRegistry.ComponentTests` | Component/Integration Tests | Test full HTTP pipeline with `WebApplicationFactory` and in-memory DB |
| `Space.Service.NationalRegistry.ArchitectureTests` | Architecture Tests | Enforce layer dependency rules and naming conventions |

### Testing Frameworks & Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **xUnit** | 2.9.2 | Test framework |
| **FluentAssertions** | 7.2.0 | Assertion library |
| **NSubstitute** | 5.3.0 | Mocking library |
| **AutoFixture** | 4.18.1 | Test data generation |
| **Microsoft.EntityFrameworkCore.InMemory** | 9.0 | In-memory database for testing |
| **Microsoft.AspNetCore.Mvc.Testing** | 9.0 | `WebApplicationFactory` for component tests |
| **WireMock.Net** | 1.8.4 | HTTP mock server for component tests |
| **NetArchTest.Rules** | 1.3.2 | Architecture enforcement |
| **coverlet** | 6.0.2 | Code coverage collection |
| **Microsoft.Extensions.TimeProvider.Testing** | 9.0 | `TimeProvider` faking |
| **Serilog.Sinks.TestCorrelator** | 4.0.0 | Log assertion in tests |
| **Space.Service.Common.Tests** | 2.9.8 | Common test utilities |

### Test Patterns & Fixtures

- **Naming convention**: `MethodName_Condition_ExpectedResult`.
- **AAA pattern**: Arrange / Act / Assert with explicit comments.
- **`CustomWebApplicationFactory<Program>`**: Replaces real DB with `InMemoryDatabase`, mocks `IEventBus` and `ISuperCache`, bypasses authorization with `TestAllowAnonymous`.
- **`NationalRegistryDbInitializer`**: Seeds test data (e.g., `NonResidentData`) for component tests.
- **Mock payloads**: JSON/XML files under `ComponentTests/Mocks/` for MyID and E-Gov response mocking.
- **WireMock.Net**: Used to mock external HTTP endpoints in component tests.
- **Test result loggers**: `GitHubActionsTestLogger` and `XunitXml.TestLogger` for CI output formatting.

### Architecture Test Coverage

The `ArchitectureTests.cs` enforces 15+ rules including:

- Controllers must not depend on Persistence, Domain, or Infrastructure.
- Domain must not depend on any other layer.
- Application must not depend on Persistence or Infrastructure.
- All requests must end with `Command` or `Query`.
- All handlers must end with `CommandHandler` or `QueryHandler`.
- All produced events must end with `Event`.
- All consumed events must end with `Command`.
- All repositories must end with `Repository`.
- Controllers must inherit from `ApiControllerBase` and end with `Controller`.

---

## 11. DevOps & Deployment

### Dockerfile Analysis

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0     # Runtime-only base image (no SDK)
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt      # Custom CA cert
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt  # Kafka CA cert
RUN update-ca-certificates --verbose          # Register custom CAs
COPY app/publish  .                           # Pre-built publish output
ENV ASPNETCORE_HTTP_PORTS=80                  # HTTP port
ENTRYPOINT ["dotnet", "Space.Service.NationalRegistry.Api.dll"]
```

**Notes**:

- The Dockerfile assumes the application is **pre-built externally** (no multi-stage build within the Dockerfile).
- Custom CA certificates are installed for TLS communication with internal services and Kafka.
- Runs on port 80 (HTTP only; HTTPS termination handled by infrastructure/ingress).

### CI/CD Pipeline

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci-cd.yaml` | Push to `master` | Full CI/CD pipeline: build, test, Docker image, deploy to `dev-uz` → `automation-uz` → `qa-uz` → `preprod-uz` → `prod-uz` |
| `cd.yaml` | Manual | Continuous deployment workflow |
| `pull-request.yaml` | Pull request | PR checks: build, test, Pact contract verification |
| `stryker.yaml` | Manual/scheduled | Mutation testing |
| `zaproxy.yaml` | Manual/scheduled | OWASP ZAP security scanning |
| `update-packages.yaml` | Scheduled | NuGet package update automation |
| `notify.yaml` | Pipeline events | Notification dispatch |
| `dora.yaml` | Deployment events | DORA metrics tracking |
| `generate-readme.yaml` | Manual | Auto-generate README |
| `create-kibana-alert-rules.yaml` | Manual | Create Kibana alerting rules |
| `sync-copilot-configs.yaml` | Manual | Sync Copilot configuration files |
| `assign-copilot.yaml` | PR events | Auto-assign Copilot for code review |

**CI/CD Key Features**:

- Uses shared workflows from `SpaceBank/Space.Service.Workflows`.
- **Pact**: Provider and consumer contract publishing + `can-i-deploy` verification.
- **Sanity check**: Enabled for deployment verification.
- **ArgoCD**: Deployment via ArgoCD (`argocd_app_name: space-service-nationalregistry`).
- **Docker image**: Published as `space-service-nationalregistry`.

### Environment-Specific Configurations

| Environment | Config Source |
|-------------|--------------|
| Local | `appsettings.Local.json`, User Secrets, environment variables |
| Non-local (deployed) | `/settings/globalsettings.json`, `/settings/appsettings.json`, `/settings/dbsettings.json` (mounted ConfigMaps/Secrets) |

Deployment environments: `dev-uz`, `automation-uz`, `qa-uz`, `preprod-uz`, `prod-uz`.

### Tooling

| Tool | Location | Purpose |
|------|----------|---------|
| `tools/localDevSetup.sh` | Pre-build script (Debug) | Local development setup (Git hooks, etc.) |
| `tools/codeCoverage/` | Coverage scripts | Code coverage reporting |
| `tools/sonarqube/` | SonarQube config | Static analysis |
| `tools/stryker/` | Stryker config | Mutation testing |
| `tools/trivy/` | Trivy config + secret rules | Container vulnerability scanning |
| `tools/zap/` | ZAP config | OWASP ZAP security testing |
| `tools/hooks/` | Git hooks | Pre-commit/pre-push hooks |
| `trivy-secret-config.json` | Root | Trivy secret scanning configuration |

### CITools Project

`Space.Service.NationalRegistry.CITools` is a console application for CI pipelines:

- `generate-events-schema`: Generates JSON schema for all produced/consumed events.
- `generate-contracts`: Generates API contracts for Pact verification.

---

## 12. External Service Dependencies

### HTTP Clients

All HTTP clients use **RestEase** interfaces registered via `Space.Service.Common.RestClient.AddRestClient<T>()`.

| Client Interface | External Service | Purpose |
|------------------|-----------------|---------|
| `IMyIdClient` | **MyID** (Uzbekistan biometric identity) | Request authentication, poll job status, get access token, fetch address |
| `IEgovClient` | **E-Gov** (government electronic services) | Get document details, address details, non-resident documents, business licenses |
| `IEgovTokenClient` | **E-Gov Token Service** | Obtain OAuth2 access tokens for E-Gov API |
| `IFakeEgovClient` | **Fake E-Gov** (staging/test) | Same as `IEgovClient` but pointing to a mock/staging environment |
| `IFakeEgovTokenClient` | **Fake E-Gov Token Service** | Same as `IEgovTokenClient` for mock environment |
| `INationalRegistryStorageClient` | **S3-compatible storage** (MinIO/AWS S3) | Upload/download verification media (selfie photos) |

### Client Configuration

- Base URLs and credentials configured via `IOptionsSnapshot<T>` for each client (e.g., `MyIdClientOptions`, `EgovClientOptions`).
- Clients conditionally registered based on configuration section existence:

```csharp
if (configuration.GetSection(nameof(MyIdClientOptions)).Exists())
{
    services.AddRestClient<IMyIdClient>(configuration, nameof(MyIdClientOptions));
}
```

### Resilience Policies on Outgoing Calls

| Concern | Implementation |
|---------|----------------|
| **Token caching** | Access tokens for MyID and E-Gov cached via `ISuperCache` with TTL = `ExpiresIn - 10` seconds |
| **Rate limit handling** | 429 responses from MyID caught and converted to `MyIdErrorCode.TOO_MANY_REQUEST` |
| **Locked service handling** | 423 responses from E-Gov caught and converted to `EgovErrorCode.EGOV_SERVICE_LOCKED` |
| **Polling timeout** | MyID job polling has 30-second overall timeout |
| **Feature-flagged routing** | `onboarding-mocked-egov` toggle switches between real and fake E-Gov clients |
| **Fallback chain** | E-Gov failure → MyID fallback in `FetchPersonDataFromExternalSources()` |

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Usage Table

| Pattern | Where Used | Why |
|---------|-----------|-----|
| Clean Architecture | Project structure (5 layers) | Enforced dependency boundaries, testability, separation of concerns |
| CQRS | `Application/Features/` — Commands & Queries | Break monolithic services into focused, single-responsibility handlers |
| MediatR | Controllers → Handlers pipeline | Decouple request handling from controller logic, enable pipeline behaviors |
| Repository Pattern | `Application/Repositories/` interfaces, `Persistence/Repositories/` implementations | Abstract data access, enable mocking in tests |
| Unit of Work | `PersonDataService` transaction handling | Ensure atomicity for multi-write + event-publish operations |
| Options Pattern | 14 options classes in `Application/Options/` | Strongly-typed, validated configuration with hot-reload support |
| Feature Toggles | 10+ GrowthBook toggles in `NationalRegistryService` | Gradual rollout, A/B testing, environment-specific behavior |
| Tenant-Specific Services | `[Service(TenantIds.TbcUz)]`, `[IService]` (Factory pattern) | Support multi-tenant deployment with different service implementations |
| Sensitive Data Masking | `[SensitiveData]` attribute on 50+ properties | PII protection in structured logs |
| Event-Driven Architecture | 4 produced events, 2 consumed events | Async communication between bounded contexts |
| RestEase HTTP Clients | 5 typed HTTP client interfaces | Declarative, testable HTTP integrations |
| Architecture Tests | `NetArchTest.Rules` in `ArchitectureTests` | Automated enforcement of dependency rules and naming conventions |
| AutoMapper Profiles | `IMap` interface on DTOs/response classes | Centralized, convention-based object mapping |

### Notable Deviations from Conventions

| Observation | Detail |
|-------------|--------|
| **All endpoints are POST** | Even pure read operations (queries) use POST instead of GET. This is likely intentional for consistency and to support complex request bodies, but deviates from REST conventions. |
| **Empty Domain folders** | `Domain/Exceptions/` and `Domain/Constants/` are empty (`.gitkeep`). Exceptions use `Space.Service.Common.Exceptions` instead of domain-specific types. |
| **No Aggregate Roots** | `Domain/Aggregates/` folder exists but is excluded from compilation. Entities are flat without aggregate boundaries. |
| **Infrastructure layer references Persistence** | `Infrastructure.csproj` references `Persistence.csproj`, which breaks strict Clean Architecture (Infrastructure should only reference Application). This is for `AddEventBus` registration requiring the `DbContext` type. |
| **Legacy deprecated code** | Three controller endpoints marked `[Obsolete]`, and `MahallaIdMappingRepository` is deprecated in favor of `MahallaReferenceRepository`. |
| **Enum-based error codes** | 5 separate error code enums across enums folder (fragmented error taxonomy). |
| **`ValidateScopes = false`** | Disabled in DI container — needed for MediatR resolution but reduces DI safety. |

### Technical Debt & Improvement Opportunities

| Area | Observation |
|------|-------------|
| **`NationalRegistryService` size** | ~1200+ lines in a single class with 20+ methods. Could benefit from decomposition into smaller, focused services. |
| **`[ExcludeFromCodeCoverage]`** | Applied extensively across infrastructure services, reducing testable surface. Critical business logic in `NationalRegistryService` is largely untestable. |
| **Hardcoded magic strings** | Feature toggle names are string constants spread across service classes rather than centralized in a `FeatureToggles.cs` constants file. |
| **`HttpClient` in QR service** | `NonResidentQrService.GetHtmlAsync()` creates `new HttpClient()` directly instead of using `IHttpClientFactory`, which can lead to socket exhaustion. |
| **DateTime handling** | Mix of `DateTime.UtcNow`, `DateTime.SpecifyKind`, and culture-specific parsing. Could benefit from consistent `DateTimeOffset` or `TimeProvider` usage. |
| **Duplicate E-Gov token logic** | `GetEgovAccessToken()` method is duplicated across `NationalRegistryService` and `NonResidentService` with nearly identical code. |
| **No Polly policies** | No explicit retry, circuit breaker, or timeout policies on HTTP clients. Resilience relies on token caching and manual fallback logic. |
| **Pre-built Dockerfile** | No multi-stage build — relies on external build pipeline. Adding a multi-stage build would make the Dockerfile self-contained. |
| **Obsolete endpoints** | Three deprecated endpoints should be removed once consumers have migrated. |
