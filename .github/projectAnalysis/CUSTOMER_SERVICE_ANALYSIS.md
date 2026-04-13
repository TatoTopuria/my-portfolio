# Space.Service.Customer — Service Analysis

> **Generated:** 2026-04-02  
> **Codebase:** [SpaceBank/Space.Service.Customer](https://github.com/SpaceBank/Space.Service.Customer)  
> **Owner team:** onboarding-baas

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

**Space.Service.Customer** is a microservice responsible for customer onboarding and lifecycle management within the SpaceBank digital banking platform operating in Uzbekistan (TBC UZ). It handles the full customer journey from identity verification and account creation through to ongoing profile management.

### Domain Context

This service represents the **Customer** bounded context. It is the system of record for:

- Customer identity and personal information
- Identity document storage and validation
- Address data (including Mahalla/village codes specific to Uzbekistan)
- Customer verification status
- Agreements and KYC data
- Delivery information for physical document delivery

### Key Entities

| Entity | File | Description |
|--------|------|-------------|
| `Customer` | `Domain/Entities/Customer.cs` | Root aggregate — holds correlation IDs to IABS, Mambu, MFO, and Processing Center |
| `PersonalInfo` | `Domain/Entities/PersonalInfo.cs` | Name, PINFL, gender, birth data, citizenship, residency |
| `IdentityDocument` | `Domain/Entities/IdentityDocument.cs` | Passport/ID card data, image keys, expiration tracking |
| `Address` | `Domain/Entities/Address.cs` | Permanent/temporary address with Mahalla (MaxallaId) codes |
| `User` | `Domain/Entities/User.cs` | Phone number, status, language preference |
| `Agreement` | `Domain/Entities/Agreement/Agreement.cs` | General agreement linked to templates |
| `AgreementTemplate` | `Domain/Entities/Agreement/AgreementTemplate.cs` | Versioned agreement templates with translations |
| `KycData` | `Domain/Entities/KycData.cs` | KYC fields — activity, income source, relation purposes |
| `DeliveryInfo` | `Domain/Entities/Delivery/DeliveryInfo.cs` | Delivery address for products (e.g. agreement documents) |
| `DeliveryMapping` | `Domain/Entities/Delivery/DeliveryMapping.cs` | Region/city mappings per delivery product type |
| `PersonalInformation` | `Domain/Entities/PersonalInformation.cs` | Contact details, workplace, salary, profile image |
| `DocumentCheckLog` | `Domain/Entities/DocumentCheckLog.cs` | Rate-limiting log for document check attempts |
| `DuplicatedCustomer` | `Domain/Entities/DuplicatedCustomer.cs` | Tracks duplicate customer detections |
| `TaxPayerInfo` | `Domain/Entities/TaxPayerInfo.cs` | Tax payer type and active date range |

### Main Use Cases

1. **Customer Onboarding (Resident)** — Verify identity via National Registry + Verification service, create customer in local DB, IABS (core banking), Mambu (banking platform), Processing Center, and MFO.
2. **Customer Onboarding (Non-Resident)** — Separate flow with physical verification at POS.
3. **Re-onboarding** — CRM-driven re-creation of core banking customer, general agreement, and verification.
4. **Profile Management** — View/update profile, profile image, avatar parameters, passport info.
5. **Agreement Management** — List, retrieve, and regenerate customer agreements with multi-language PDF generation.
6. **Duplicate Detection** — Check if a customer already exists by document data.
7. **Document Renewal** — Renew expired identity documents.
8. **Delivery** — Manage delivery regions/cities and create delivery information for physical document shipments.
9. **Data Sync** — Synchronize customer data across IABS, MFO, and Processing Center (including Mahalla recovery).
10. **KYC Data Collection** — Receive and store KYC data from upstream services.

---

## 2. Architecture

### Architectural Pattern

**Clean Architecture with CQRS** — justified by:

- **Strict layer separation** enforced by architecture tests in `ArchitectureTests.cs` using `NetArchTest.Rules`:
  - Domain depends on no other layer
  - Application does not depend on Persistence or Infrastructure
  - Controllers do not depend on Domain, Persistence, or Infrastructure
  - Controllers depend only on MediatR and Application layer commands/queries
- **CQRS via MediatR** — every controller action dispatches a `Command` or `Query` through `IMediator`
- **Handler naming conventions** enforced: `*CommandHandler` or `*QueryHandler` must inherit `RequestHandlerBase<,>`

### Project Structure

```
Space.Service.Customer/
├── Space.Service.Customer.Api/              # Presentation layer
│   ├── Controllers/                         # REST controllers (thin, delegate to MediatR)
│   ├── Program.cs                           # Host builder, middleware pipeline
│   ├── ApiExtensions.cs                     # Service + middleware registration
│   └── Properties/launchSettings.json       # Dev profiles
│
├── Space.Service.Customer.Application/      # Application layer (use cases)
│   ├── Features/                            # CQRS: Commands, Queries, Events per feature
│   │   ├── Customer/Commands/               # ~40 command handlers
│   │   ├── Customer/Queries/                # ~15 query handlers
│   │   ├── Customer/Events/                 # Produced events (outgoing messages)
│   │   ├── Customer/Legacy/                 # Legacy onboarding/CoreApi event handlers
│   │   ├── Agreement/                       # Agreement commands and queries
│   │   ├── Delivery/                        # Delivery commands and queries
│   │   ├── User/                            # User lifecycle event handlers
│   │   └── KycData/                         # KYC data command handler
│   ├── HttpClients/                         # Typed HTTP client interfaces (RestEase)
│   ├── Services/                            # Domain service interfaces + TbcUz implementations
│   ├── Repositories/                        # Repository interfaces
│   ├── Dtos/                                # Data transfer objects
│   ├── Options/                             # Configuration option classes
│   ├── Extensions/                          # String/Language extension methods
│   └── Resources/                           # Localization .resx files (en-US, ru-RU, uz-Latn-UZ, ka-GE)
│
├── Space.Service.Customer.Domain/           # Domain layer (entities, enums)
│   ├── Entities/                            # Entity classes inheriting EntityBase<T>
│   ├── Enums/                               # ~20 enumerations
│   └── Cache/                               # Cache key definitions
│
├── Space.Service.Customer.Persistence/      # Data access layer
│   ├── CustomerDbContext.cs                 # EF Core DbContext (PostgreSQL)
│   ├── Configurations/                      # 19 EF entity type configurations
│   ├── Repositories/                        # 16 repository implementations
│   ├── Migrations/                          # 115 EF migrations (2023-06 to 2026-03)
│   ├── IOracleConnectionFactory.cs          # Oracle connection for IABS direct queries
│   └── Seeder.cs                            # Database seed (currently empty)
│
├── Space.Service.Customer.Infrastructure/   # Infrastructure layer
│   ├── InfrastructureExtensions.cs          # HTTP clients, event bus, cache, workers
│   └── Workers/                             # 3 background workers
│
├── Space.Service.Customer.UnitTests/        # Unit tests (~100 test files)
├── Space.Service.Customer.ComponentTests/   # Component/integration tests
├── Space.Service.Customer.ArchitectureTests/# Architecture constraint tests
└── Space.Service.Customer.CITools/          # CI helper tooling
```

### Dependency Flow

```
Api → Application → Domain
Api → Infrastructure → Application → Domain
Api → Persistence → Application → Domain
```

The `Api` project references `Application`, `Infrastructure`, and `Persistence`. `Application` references only `Domain`. `Infrastructure` and `Persistence` reference `Application` (for interfaces) — implementations flow inward via DI.

### CQRS Details

- **Mediator**: MediatR registered in `ApplicationExtensions.cs` via `RegisterServicesFromAssembly`
- **Commands**: Implement `IRequest` or `IRequest<T>`, named `*Command`
- **Queries**: Implement `IRequest<T>`, named `*Query`
- **Handlers**: Inherit `RequestHandlerBase<TRequest, TResponse>` from `Space.Service.Common.Mediator`
- **Pipeline behaviors** (in order):
  1. `LoggingBehavior<,>` — logs request/response
  2. `ValidationBehavior<,>` — runs FluentValidation validators
- **Feature organization**: Each command/query has its own folder with Command/Query, Handler, Validator (optional), and Response classes

### DDD Patterns

- **Entities** inherit from `EntityBase<T>` (from `Space.Service.Common.Persistence`) with an `Id` property and audit fields (`CreatedAt`, `UpdatedAt`)
- **Repository pattern** with interfaces in Application, implementations in Persistence
- **No explicit Aggregate Roots** formal marker. `Customer` acts as the implicit aggregate root (all related entities reference it)
- **No Domain Events** in the DDD sense — events are application-level message bus events (`[ProduceEvent]`/`[ConsumeEvent]`)
- **Value Objects** are not used; address, personal info etc. are entities with their own IDs

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Item | Version |
|------|---------|
| .NET | 9.0 |
| C# | Latest (C# 13 features enabled via `net9.0` TFM) |
| Target Framework | `net9.0` |

### Primary Frameworks

| Package | Version | Role |
|---------|---------|------|
| ASP.NET Core 9.0 | 9.0 | Web framework |
| Entity Framework Core | 9.0.0 / 9.0.1 | ORM |
| MediatR | via `Space.Service.Common.Mediator` 2.9.8 | CQRS mediator |
| FluentValidation | via `Space.Service.Common.Mediator` | Request validation |
| AutoMapper | via `Space.Service.Common.Mapping` 2.9.2 | Object mapping |
| RestEase | via `Space.Service.Common.RestClient` 2.9.23 | Typed HTTP clients |

### Internal Common Packages (`Space.Service.Common.*`)

| Package | Version | Purpose |
|---------|---------|---------|
| `Common.Auth` | 2.9.9 | IdentityServer + Microsoft Entra ID authentication |
| `Common.Caching` | 2.9.15 | Distributed caching ("SuperCache") |
| `Common.EventBus` | 2.9.35 | Message bus (produce/consume events) |
| `Common.Exceptions` | 2.9.9 | `AppException`, `EnsureNotNull` extensions |
| `Common.Factory` | 2.9.9 | `[IService]` attribute for auto DI registration |
| `Common.FeatureToggle` | 2.9.16 | Feature flag management |
| `Common.HealthChecks` | 2.9.10 | Health check endpoints |
| `Common.Logging` | 2.9.9 | Serilog-based structured logging, `[SensitiveData]` masking |
| `Common.Mediator` | 2.9.8 | `RequestHandlerBase`, `LoggingBehavior`, `ValidationBehavior` |
| `Common.Middlewares` | 2.9.11 | Shared HTTP middleware pipeline |
| `Common.Misc` | 2.9.56 | Utilities (`RequestMetadata`, `TenantIds`, `NonProduction`, etc.) |
| `Common.Persistence` | 2.9.13 | `EntityBase<T>`, `DbContextBase`, `UnitOfWork` |
| `Common.RestClient` | 2.9.23 | `AddRestClient<T>()`, `[InternalApiClient]`, `[ExternalApiClient]` |
| `Common.Storage` | 2.9.3 | Object storage (S3-compatible) |
| `Common.Swagger` | 2.9.13 | Swagger/OpenAPI generation |
| `Common.Tests` | 2.9.8 | Test utilities |
| `Common.Workers` | 2.9.13 | `CronBackgroundServiceBase`, worker trigger endpoints |
| `Common.CodeAnalyzers` | 2.9.6 | Custom Roslyn analyzers |

### Third-Party NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `Npgsql.EntityFrameworkCore.PostgreSQL` | (transitive) | PostgreSQL EF provider |
| `Oracle.ManagedDataAccess.Core` | 23.8.0 | Oracle database access for IABS direct queries |
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus metrics endpoint |
| `Asp.Versioning` | (transitive) | API versioning |
| `QRCoder` | 1.6.0 | QR code generation (agreements) |
| `System.Drawing.Common` | 10.0.0-preview.3 | Image processing |
| `DistributedLock.Postgres` (Medallion.Threading) | (transitive) | Distributed locking via PostgreSQL |
| `Cronos` | (transitive) | Cron expression parsing for workers |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |
| `NetArchTest.Rules` | 1.3.2 | Architecture constraint tests |

### Databases

| Database | Purpose |
|----------|---------|
| **PostgreSQL** | Primary data store — EF Core via Npgsql |
| **Oracle (IABS)** | Core banking system — read-only direct queries via `OracleConnection` |

### Caching

- **In-memory cache**: `Microsoft.Extensions.Caching.Memory` (9.0.9)
- **Distributed cache**: `Space.Service.Common.Caching` ("SuperCache") — registered via `AddSuperCache(configuration)` in `InfrastructureExtensions.cs`

### Logging & Observability

- **Serilog** via `Space.Service.Common.Logging` — structured logging with `UseSerilog()`
- **Prometheus** — metrics via `prometheus-net.AspNetCore` with `UseHttpMetrics()` and `MapMetrics()`
- **Sensitive data masking** — `[SensitiveData]` attribute on entity/DTO properties, respected by logging infrastructure
- **Elastic APM** — `AddApm(configuration)` in `Program.cs`

---

## 4. API Layer & Communication

### API Style

**REST** with JSON responses. API versioning via `Asp.Versioning` (URL segment: `api/v{version}/[controller]`).

### Base Controller

All controllers inherit from `ApiControllerBase` which:
- Is decorated with `[Authorize]`, `[ApiController]`, `[Produces("application/json")]`
- Accepts `IMediator` via constructor
- Provides `CreatedResult()` and `OkResult()` helpers

### Endpoints by Controller

#### CustomerController (`api/v1/customer`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `POST` | `/` | Create customer (resident or non-resident) | Bearer |
| `POST` | `/non-resident` | Create non-resident customer | Bearer |
| `POST` | `/check-customer` | Check customer by document | Anonymous |
| `DELETE` | `/` | Delete customer (non-production only) | Anonymous + `[NonProduction]` |
| `PATCH` | `/IdentityDocument` | Manual update identity document type | Anonymous + `[NonProduction]` |
| `PATCH` | `/Address` | Manual update address | Anonymous + `[NonProduction]` |
| `PATCH` | `/Passport` | Manual update identity document | Anonymous + `[NonProduction]` |
| `POST` | `/check-duplicate-customer` | Check for duplicate customer | Bearer |
| `GET` | `/validate-profile-number-change` | Validate liveness limits & document expiration | Bearer |
| `GET` | `/onboarding-flow-type` | Get customer onboarding flow type | Bearer |
| `POST` | `/document-renew` | Renew customer document | Bearer |
| `POST` | `/reonboard-create-corebanking-customer` | Re-onboard: create core banking customer | Entra ID + `[ApiKey("CRM")]` |
| `POST` | `/reonboard-create-general-agreement` | Re-onboard: create general agreement | Entra ID + `[ApiKey("CRM")]` |
| `POST` | `/reonboard-verify-customer` | Re-onboard: verify customer | Entra ID + `[ApiKey("CRM")]` |
| `GET` | `/profile` | Get customer profile | Bearer |
| `PATCH` | `/profile` | Update customer profile | Bearer |
| `POST` | `/update-profile-image` | Upload profile image (multipart) | Bearer |
| `POST` | `/Sync-Customers` | Sync customers across systems | Anonymous |
| `POST` | `/customer-info` | Get customer info for CBU | Anonymous |
| `POST` | `/customer-precheck` | Pre-check before customer creation | Bearer |
| `PATCH` | `/tax-payer` | Set IsTaxPayer flag | Entra ID + `[ApiKey("CRM")]` |
| `GET` | `/verification-status` | Get verification status (manual) | Anonymous |
| `POST` | `/non-resident-physical-verification` (v1) | Physical verification for non-resident | `[ApiKey("PosSystem")]` |
| `POST` | `/non-resident-missing-data` | Update non-resident missing data | `[ApiKey("PosSystem")]` |
| `POST` | `/non-resident-physical-verification` (v2) | Physical verification v2 | `[ApiKey("PosSystem")]` |
| `GET` | `/is-resident` | Check residency status | Bearer |
| `GET` | `/customer-flags` | Get onboarding flow type + residency | Bearer |
| `POST` | `/create-processing-center-customer` | Create in Processing Center | Anonymous |
| `POST` | `/get-processing-center-customer` | Get from Processing Center | Anonymous + `[NonProduction]` |
| `POST` | `/create-mfo-corebanking-customer` | Create in MFO core banking | Anonymous |
| `POST` | `/get-mfo-corebanking-customer` | Get MFO phys client | Anonymous |
| `POST` | `/update-mfo-corebanking-customer` | Update in MFO core banking | Anonymous |
| `POST` | `/reonboard-mfo-corebanking-customer` | Re-onboard MFO customer | Entra ID + `[ApiKey("CRM")]` |
| `GET` | `/profile-image` | Get customer profile image | Bearer |
| `GET` | `/avatar-parameters` | Get avatar URL and initials | Bearer |
| `GET` | `/onboarding-image-key` | Get onboarding image key | `[ApiKey("CRM")]` |
| `GET` | `/customer-info-genesys` | Get customer info for Genesys | Anonymous |
| `GET` | `/get-userid-by-personalnumber` | Get userId by PINFL | `[ApiKey("AmlMonitoring", "PosSystem")]` |
| `POST` | `/sync-customer-data` | Sync customer data (CRM) | Entra ID + `[ApiKey("CRM")]` |
| `POST` | `/mahalla-recovery` | Mahalla recovery across systems | Anonymous |
| `GET` | `/get-customer-info-for-support` | Full customer info for support | Anonymous |
| `GET` | `/passport-info` | Get passport data | Bearer |

#### AgreementController (`api/v1/agreement`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/list` | Get customer agreements | Bearer |
| `POST` | `/regenerate` | Regenerate customer agreement | Entra ID + `[ApiKey("CRM")]` |
| `GET` | `/` | Get customer agreement | Entra ID + `[ApiKey("CRM")]` |

#### DeliveryController (`api/v1/delivery`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/{deliveryProductType}` | Get regions for delivery | Bearer |
| `GET` | `/{deliveryProductType}/{regionCode}` | Get cities for delivery | Bearer |
| `POST` | `/save-mapping` | Save delivery mapping | `[ApiKey("CRM")]` |
| `POST` | `/` | Create delivery info | Bearer |

#### CityController (`api/v1/city`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/` | Get cities by region ID | Bearer |

#### RegionController (`api/v1/region`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/` | Get all regions | Bearer |

### Request/Response Patterns

- **Commands** return `void` (returning `Task`) or typed responses (e.g., `CreateCustomerResponse`, `OnboardingOperationStatusResponse`)
- **Queries** return typed response DTOs
- **Swagger annotations** via `[ApiOperation]`, `[ApiSuccessResponse]`, `[ApiErrorResponse]`

### API Versioning

- **URL segment versioning**: `api/v{version:apiVersion}/[controller]`
- Default version: `1.0` (via `[ApiVersion("1.0")]` on `CustomerController`)
- Version `2.0` used for `VerifyNonResidentCustomerPhysicallyV2`

### Authentication & Authorization

| Mechanism | Usage |
|-----------|-------|
| **IdentityServer (Bearer)** | Default via `[Authorize]` on `ApiControllerBase` |
| **Microsoft Entra ID** | CRM endpoints: `[Authorize(AuthenticationSchemes = AuthenticationSchemes.MicrosoftEntraId)]` |
| **API Key** | Machine-to-machine via `[ApiKey("CRM")]`, `[ApiKey("PosSystem")]`, `[ApiKey("AmlMonitoring", "PosSystem")]` |
| **Anonymous** | Selected endpoints via `[AllowAnonymous]` |
| **NonProduction** | Dev/test-only endpoints via `[NonProduction]` attribute |

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

Registered in `ApiExtensions.ConfigureAPI()` in this order:

```csharp
app.UsePathBase(pathBase);           // 1. Path base ("/customer")
app.UseLocalization();               // 2. Request culture
app.UseHttpsRedirection();           // 3. HTTPS redirect
app.UseRouting();                    // 4. Routing
app.UseHttpMetrics();                // 5. Prometheus HTTP metrics
app.UseAuthentication();             // 6. Authentication
app.UseStaticFiles();                // 7. Static files (wwwroot)
app.UseAuthorization();              // 8. Authorization
app.UseMiddlewares();                // 9. Common middleware (correlation ID, exception handling, etc.)
app.UseHealthCheckMiddleware(env);   // 10. Health checks
app.UseEventEndpoints();             // 11. Event bus consumer endpoints
app.UseVersionEndpoint(configuration);// 12. Version info endpoint
endpoints.MapControllers();          // 13. Controller routing
endpoints.MapMetrics();              // 14. Prometheus /metrics endpoint
app.UseWorkerTriggerEndpoints();     // 15. Manual worker trigger endpoints
app.UseSwagger(env, provider, pathBase); // 16. Swagger UI
```

### MediatR Pipeline Behaviors

Registered in `ApplicationExtensions.AddApplication()`:

1. **`LoggingBehavior<TRequest, TResponse>`** — Logs request entry/exit with timing
2. **`ValidationBehavior<TRequest, TResponse>`** — Runs all registered `IValidator<TRequest>` validators; throws on failure

### Global Exception Handling

Handled by `Space.Service.Common.Middlewares` (`UseMiddlewares()`) — provides standardized error responses. Application code uses `AppException` from `Common.Exceptions`.

### Request Validation

- **FluentValidation** — Validators registered via `AddValidatorsFromAssembly(Assembly.GetExecutingAssembly())`
- **Camel case display names**: `ValidatorOptions.Global.DisplayNameResolver = (type, member, expression) => member?.Name.ToCamelCase()`
- **Model state validation suppressed**: `options.SuppressModelStateInvalidFilter = true` — validation is handled by MediatR pipeline instead
- Example validators: `CreateCustomerCommandValidator`, `CheckDuplicateCustomerCommandValidator`, `DeliveryRegionsQueryValidator`, etc.

### Correlation ID / Request Tracing

- `RequestMetadata` (scoped) carries `UserId`, `TenantId`, and other per-request context
- Correlation ID propagation handled by `Space.Service.Common.Middlewares`

---

## 6. Data Layer

### Database Type & Provider

- **Primary**: PostgreSQL via `Npgsql.EntityFrameworkCore.PostgreSQL`
- **Secondary**: Oracle (IABS core banking) via `Oracle.ManagedDataAccess.Core` 23.8.0

### ORM Configuration

**DbContext**: `CustomerDbContext` extends `DbContextBase` (from `Common.Persistence`)

```csharp
public class CustomerDbContext : DbContextBase
{
    public DbSet<Customer> Customers { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<PersonalInfo> PersonalInfos { get; set; }
    public DbSet<IdentityDocument> IdentityDocuments { get; set; }
    public DbSet<Address> Addresses { get; set; }
    public DbSet<DocumentCheckLog> DocumentCheckLogs { get; set; }
    public DbSet<DuplicatedCustomer> DuplicatedCustomers { get; set; }
    public DbSet<Agreement> Agreements { get; set; }
    public DbSet<AgreementTemplate> AgreementTemplates { get; set; }
    public DbSet<Language> AgreementLanguages { get; set; }
    public DbSet<Translation> Translations { get; set; }
    public DbSet<Region> Regions { get; set; }
    public DbSet<City> Cities { get; set; }
    public DbSet<PersonalInformation> PersonalInformations { get; set; }
    public DbSet<KycData> KycDatas { get; set; }
    public DbSet<DeliveryInfo> DeliveryInfos { get; set; }
    public DbSet<DeliveryMapping> DeliveryMappings { get; set; }
    public DbSet<TaxPayerInfo> TaxPayerInfos { get; set; }
}
```

**Entity configurations**: 19 `IEntityTypeConfiguration<T>` classes in `Persistence/Configurations/` — covering all entities with table mappings, relationships, and indexes.

### Migration Strategy

- **EF Core Migrations** — 115 migration files spanning 2023-06-28 (`Init`) to 2026-03-11 (`MakePersonalInformationSalaryNullable`)
- Applied automatically on startup: `db.Database.Create().Wait(); db.Database.Migrate();`
- Migrations assembly specified: `npgsqlOptions.MigrationsAssembly(Assembly.GetExecutingAssembly().FullName)`

### Repository Pattern

**Interface-based repository pattern**:
- 16 repository interfaces in `Application/Repositories/` (e.g., `ICustomerRepository`, `IUserRepository`)
- 16 implementations in `Persistence/Repositories/` inheriting from `RepositoryBase<TEntity, TId>`
- `RepositoryBase<T, TId>` provides `GetById()`, `Add()`, `Update()`, `Delete()` — interfaces extend `IRepositoryBase<T, TId>`
- Custom query methods added per repository (e.g., `GetByPersonalNumber`, `GetVerifiedWithoutProcessingCenterAsync`)

### Oracle Access

`IabsRepository` uses `IOracleConnectionFactory` to execute a stored procedure (`TBCTECH.non_resident_onboarding_tmp_proc`) for IABS sync of non-resident customers. This bypasses EF Core.

### Unit of Work

Registered via `services.AddUnitOfWork(typeof(CustomerDbContext))` — provided by `Common.Persistence`.

### Connection Configuration

```csharp
services.AddDbContext<CustomerDbContext>(options =>
    options.UseNpgsql(configuration.GetConnectionString("NpgSql"), ...));
```

Distributed lock also uses the NpgSql connection string:
```csharp
services.AddSingleton<IDistributedLockProvider>(_ =>
    new PostgresDistributedSynchronizationProvider(npgsqlConnectionString));
```

---

## 7. Messaging & Event Handling

The service uses `Space.Service.Common.EventBus` for asynchronous messaging, registered via `services.AddEventBus(configuration, typeof(CustomerDbContext))`.

### Consumed Events (22)

| Event Name | Command Class | Purpose |
|------------|---------------|---------|
| `user-created` | `CreateUserCommand` | Create local User record |
| `user-updated` | `UpdateUserCommand` | Update phone number, sync across systems |
| `user-status-changed` | `UserStatusChangedCommand` | Update user status |
| `user-status-updated` | `UserStatusUpdatedCommand` | Update user status (alternate event) |
| `user-changed-language` | `UserLanguageChangeCommand` | Update user language preference |
| `kyc-created` | `CreateKycDataCommand` | Store KYC data |
| `customer-selfie-updated` | `UpdateCustomerSelfieCommand` | Update customer selfie image |
| `current-account-validated` | `VerifyCustomerCommand` | Mark customer as verified |
| `current-account-created` | `CreateGeneralAgreementCommand` | Create general agreement |
| `async-onboarding-started` | `CreateCoreBankingCustomerCommand` | Create core banking customer in IABS |
| `create-mfo-core-banking-customer` | `CreateMfoCustomerCommand` | Create MFO core banking customer |
| `corebank-customer-created` | `CoreBankCustomerCreatedCommand` | Store core banking correlation ID |
| `document-validated` | `UpdateDocumentValidationCommand` | Update document validation date |
| `national-registry-person-info-updated` | `UpdatePersonalInfoCommand` | Update personal info from National Registry |
| `customer-details-requested` | `CustomerDetailsRequestedCommand` | Provide customer details to requester |
| `check-customer-command` | `CheckNasiyaCustomerCommand` | Check Nasiya customer eligibility |
| `customer-sync-village-info` | `SyncVillageInfoCommand` | Sync village/mahalla info to IABS/MFO |
| `onboarding-customer-created` | `OnboardingCreateCustomerCommand` | Legacy: create customer from onboarding |
| `onboarding-customer-updated` | `OnboardingUpdateCustomerCommand` | Legacy: update customer from onboarding |
| `customer-profile-image-updated-legacy` | `UpdateCustomerProfileImageCommand` | Legacy: update profile image |
| `customer-profile-updated-legacy` | `UpdateCustomerProfileLegacyCommand` | Legacy: update profile data |

### Produced Events (30)

| Target Topic | Event Name | Event Class | Purpose |
|-------------|------------|-------------|---------|
| `customer` | `customer-created` | `CustomerCreatedEvent` | New customer created |
| `customer` | `customer-updated` | `CustomerUpdatedEvent` | Customer data updated |
| `customer` | `customer-updated-for-onboarding` | `CustomerUpdateFroOnboardingEvent` | Customer updated (onboarding context) |
| `customer` | `customer-deactivated` | `CustomerDeactivatedEvent` | Customer deactivated |
| `customer` | `customer-verified` | `CustomerVerifiedEvent` | Customer verified |
| `customer` | `general-agreement-created` | `GeneralAgreementCreatedEvent` | General agreement created |
| `customer` | `customer-selfie-image-updated` | `UpdateOnboardingCustomerSelfieEvent` | Selfie image updated |
| `customer` | `customer-profile-updated` | `UpdateCustomerProfileEvent` | Profile updated |
| `customer` | `customer-profile-image-updated` | `UpdateProfileImageEvent` | Profile image updated |
| `customer` | `customer-details-provided` | `CustomerDetailsProvidedEvent` | Customer details response |
| `customer` | `customer-duplicated` | `DuplicateCustomerEvent` | Duplicate customer detected |
| `customer` | `corebanking-customer-created` | `CoreBankingCustomerCreatedEvent` | Core banking customer created |
| `customer` | `mfo-core-banking-customer-created` | `MfoCustomerCreatedEvent` | MFO customer created |
| `customer` | `processingcenter-customer-created` | `ProcessingCenterCustomerCreatedEvent` | Processing Center customer created |
| `customer` | `nasiya-customer-check-passed` | `NasiyaCustomerCheckPassedEvent` | Nasiya check passed |
| `customer` | `nasiya-customer-check-failed` | `NasiyaCustomerCheckFailedEvent` | Nasiya check failed |
| `customer` | `national-registry-failed` | `NationalRegistryFailedEvent` | National registry call failed |
| `customer` | `nr-nonresident-failed` | `NationalRegistryNonResidentFailedEvent` | NR non-resident failed |
| `customer` | `national_registry_nonresident_client_blocked_in_oneid` | `NationalRegistryNonResidentClientBlockedInOneIdEvent` | Client blocked in OneID |
| `customer` | `initiate-document-delivery` | `GeneralAgreementDeliveryInitiationEvent` | Initiate document delivery |
| `customer` | `create-crm-case-anonymous` | `CaseCreatedEvent` | Create CRM case |
| `customercase` | `create-automatic-case` | `CreateAutomaticCaseEvent` | Create automatic case |
| `delivery` | `initiate-delivery` | `InitiateDeliveryEvent` | Initiate delivery |
| `notification` | `send-email` | `SendEmailEvent` | Send email notification |
| `notification` | `send-simple-push-notification` | `SendSimplePushNotificationEvent` | Send push notification |
| `identity` | `phone-number-inconsistency` | `PhoneNumberChangeFailedInconsistencyEvent` | Phone number change failed |
| `identity` | `increment-recover-passcode-failed-count` | `UpdateRecoverPassCodeFailedCountEvent` | Increment passcode fail count |
| `coreapi` | `onBoarding-points-accumulated` | `OnBoardingPointsAccumulatedEvent` | Onboarding points accumulated |
| `asynconboarding` | `customer-verified-legacy` | `CustomerVerifiedLegacyEvent` | Legacy customer verified |
| `asynconboarding` | `corebanking-customer-created-legacy` | `CoreBankingCustomerCreatedLegacyEvent` | Legacy core banking created |

### Event Handling Patterns

- Events are dispatched via the common `EventBus` library backed by a message broker (configured externally)
- **Transactional outbox**: `AddEventBus(configuration, typeof(CustomerDbContext))` — passing the DbContext type suggests outbox pattern integration
- Commands with `messageType: MessageType.Command` indicate RPC-style commands (e.g., case creation, notification sending)

---

## 8. Background Jobs & Scheduled Tasks

Three cron-based background workers registered as hosted services via `CronBackgroundServiceBase`:

### 1. `DeleteExpiredCustomerDocumentChecksWorker`

- **File**: `Infrastructure/Workers/DeleteExpiredCustomerDocumentChecksWorker.cs`
- **Schedule**: Cron expression from `DeleteExpiredCustomerDocumentChecksWorkerOptions`
- **Purpose**: Deletes expired `DocumentCheckLog` entries (rate-limiting records) older than `OlderThanInHours`

### 2. `SyncProcessingCenterCustomersWorker`

- **File**: `Infrastructure/Workers/SyncProcessingCenterCustomersWorker.cs`
- **Schedule**: Cron expression from `SyncProcessingCenterCustomersWorkerOptions`
- **Purpose**: Finds verified customers without a `ProcessingCenterId` and creates them in the Processing Center
- **Parallelism**: Controlled by `ProcessingCenterOptions.MaxDegreeOfParallelism`
- **Pattern**: Each customer processed in its own DI scope with dedicated `RequestMetadata`

### 3. `MahallaRecoveryWorker`

- **File**: `Infrastructure/Workers/MahallaRecoveryWorker.cs`
- **Schedule**: Cron expression from `MahallaRecoveryWorkerOptions`
- **Purpose**: Temporary worker to recover missed Mahalla codes — updates addresses with Mahalla IDs via raw SQL, then syncs to IABS and MFO
- **Guard**: Only runs in Production with feature toggle `onboarding_temporary_mahalla_codes_update` enabled
- **MFO sync**: Gated by additional toggle `onboarding-sync-village-mfo-update`
- **Note**: Marked as temporary — "Will be deleted after 2026.02.22"

All workers can also be triggered manually via `UseWorkerTriggerEndpoints()`.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Serilog** — structured logging configured via `UseSerilog(builder.Services, builder.Configuration)`
- **Sensitive data masking**: `[SensitiveData]` attribute on entity properties (e.g., `PersonalNumber`, `PhoneNumber`, `FirstName`) — masked in logs
- **Request/response logging**: `LoggingBehavior<,>` in MediatR pipeline
- **Per-handler logging**: Handlers inject `ILogger<T>` for domain-specific log entries

### Health Checks

- Registered via `services.AddHealthChecks(configuration)` from `Common.HealthChecks`
- Middleware: `app.UseHealthCheckMiddleware(env)`

### Rate Limiting / Throttling

- **Document check rate limiting**: `DocumentCheckLog` entity tracks failed attempts per user/device
- `CheckDocumentLimitOptions` and `ValidationFailedCounterServiceOptions` control limits
- Not HTTP-level rate limiting; application-level business logic rate limiting

### Resilience Patterns

- **Distributed locking**: `PostgresDistributedSynchronizationProvider` (Medallion.Threading) prevents concurrent operations
- HTTP client resilience is handled by `Space.Service.Common.RestClient` (configurable per client)
- Best-effort patterns in workers: try/catch with logging for IABS and MFO calls in `MahallaRecoveryWorker`

### Configuration Management

- **Local development**: Standard `appsettings.json` + user secrets
- **Deployed environments**: External config files mounted at `/settings/`:
  - `/settings/globalsettings.json`
  - `/settings/appsettings.json`
  - `/settings/dbsettings.json`
- **Hot reload**: `builder.Configuration.Watch(settingsFilePaths)`
- **Options pattern**: 19 strongly-typed options classes bound via `AddOptions<T>().BindConfiguration().ValidateDataAnnotations().ValidateOnStart()`
- **Feature flags**: `IFeatureToggle` from `Common.FeatureToggle` — used for toggles like `onboarding-nonresident-customer-create`, `onboarding_temporary_mahalla_codes_update`

### Localization

- 4 resource files: `en-US`, `ru-RU`, `uz-Latn-UZ`, `ka-GE`
- `IStringLocalizer<SharedResources>` used for error messages
- `app.UseLocalization()` in pipeline

### Kestrel Configuration

```csharp
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MinRequestBodyDataRate =
        new MinDataRate(bytesPerSecond: 50, gracePeriod: TimeSpan.FromSeconds(15));
});
```

### Thread Pool

```csharp
ThreadPool.SetMinThreads(100, 100);
```

### GC Configuration (`Directory.Build.props`)

```xml
<ServerGarbageCollection>true</ServerGarbageCollection>
<GarbageCollectionAdaptationMode>1</GarbageCollectionAdaptationMode>
```

---

## 10. Testing

### Test Projects

| Project | Type | Framework |
|---------|------|-----------|
| `Space.Service.Customer.UnitTests` | Unit | xUnit 2.9.2 |
| `Space.Service.Customer.ComponentTests` | Component/Integration | xUnit 2.9.2 + `WebApplicationFactory` |
| `Space.Service.Customer.ArchitectureTests` | Architecture constraints | xUnit 2.9.2 + `NetArchTest.Rules` 1.3.2 |

### Testing Frameworks & Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| xUnit | 2.9.2 | Test framework |
| NSubstitute | 5.3.0 | Mocking |
| FluentAssertions | 7.2.0 | Assertion library |
| AutoFixture | 4.18.1 | Test data generation |
| Microsoft.EntityFrameworkCore.InMemory | 9.0.0 | In-memory database for repository tests |
| Microsoft.AspNetCore.Mvc.Testing | 9.0.0 | `WebApplicationFactory` for component tests |
| WireMock.Net | 1.8.4 | HTTP mock server for component tests |
| Microsoft.Extensions.TimeProvider.Testing | 9.0.0 | Time provider mocking |
| Serilog.Sinks.TestCorrelator | 4.0.0 | Log capture in tests |
| coverlet.msbuild / coverlet.collector | 6.0.2 | Code coverage collection |
| XunitXml.TestLogger | 6.1.0 | XML test output |
| GitHubActionsTestLogger | 2.4.1 | GitHub Actions test output |

### Test Organization

**Unit Tests** (~100 test files):
- `Api/Controllers/` — Controller tests (5 files)
- `Application/Features/Customer/` — Handler tests (~50 files)
- `Application/Features/User/` — User handler tests (~8 files)
- `Application/Features/Delivery/` — Delivery handler tests (~8 files)
- `Application/Features/GeneralAgreement/` — Agreement handler tests
- `Application/Features/KycData/` — KYC handler tests
- `Application/Services/TbcUz/` — Service tests (~7 files)
- `Persistence/Repositories/` — Repository tests (~15 files)

**Component Tests**:
- `CustomWebApplicationFactory` — Custom `WebApplicationFactory<Program>` with in-memory DB and WireMock
- `WireMockServerFixture` — Shared WireMock server for external API simulation
- JSON mock files in `Mocks/` for Verification, Onboarding, CoreApiFacade, MambuClient
- Tests: `CustomerControllerTests`, `CustomerControllerSupportTests`

**Architecture Tests** (`ArchitectureTests.cs`):
- 14 architectural constraint tests verifying layer dependencies, naming conventions, and inheritance

### Test Fixtures

- `InMemoryDbContextFixture` — Shared in-memory `CustomerDbContext`
- `MapperFixture` — AutoMapper configuration
- `LocalizerFixture` — String localizer setup
- `SharedFixtureCollection` — xUnit collection fixture tying all three together

### Naming Convention

`Handle_Condition_ExpectedResult` (AAA pattern)

---

## 11. DevOps & Deployment

### Dockerfile

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt
RUN update-ca-certificates --verbose
COPY app/publish  .
ENV ASPNETCORE_HTTP_PORTS=80
ENTRYPOINT ["dotnet", "Space.Service.Customer.Api.dll"]
```

**Observations:**
- Single-stage Dockerfile (build happens externally in CI)
- Based on `mcr.microsoft.com/dotnet/aspnet:9.0` (runtime-only image)
- Installs custom CA certificates for internal services and Kafka
- Exposes port 80 (HTTP only; HTTPS termination is upstream)

### CI/CD

- **GitHub Actions** — evidenced by:
  - CI/CD badge: `actions/workflows/ci-cd.yaml`
  - CD badge: `actions/workflows/cd.yaml`
  - `GitHubActionsTestLogger` in test projects
  - Pipeline YAML files not present in workspace (likely in `.github/workflows/` not checked out)

### Build Scripts

- `tools/localDevSetup.sh` — executed as PreBuild event in Debug configuration
- `Space.Service.Customer.CITools/Program.cs` — CI helper tool project

### Environment Configuration

- **Local**: `ASPNETCORE_ENVIRONMENT=Local`, `PATH_BASE=/customer`, ports `7144` (HTTPS) / `5144` (HTTP)
- **Docker**: Published ports with SSL
- **Non-local**: Config from mounted JSON files at `/settings/`

### Static Analysis

- **StyleCop.Analyzers** (1.1.118) — enforced across all projects
- **Space.Service.Common.CodeAnalyzers** (2.9.6) — custom analyzers
- **SonarQube** — test projects marked with `<SonarQubeTestProject>true</SonarQubeTestProject>`

### Security Scanning

- `trivy-secret-config.json` — Trivy secret scanning configuration in repository root
- Tools directory contains:
  - `tools/trivy/` — Container vulnerability scanning
  - `tools/talisman/` — Pre-commit secret detection
  - `tools/zap/` — OWASP ZAP dynamic security testing
  - `tools/sonarqube/` — Static analysis
  - `tools/stryker/` — Mutation testing

---

## 12. External Service Dependencies

### HTTP Clients

All typed HTTP clients are registered via `InfrastructureExtensions.AddHttpClients()`:

| Client Interface | Config Key | Type | External Service |
|-----------------|------------|------|------------------|
| `IVerificationClient` | `VerificationOptions` | Internal | Space.Service.Verification — identity document and liveness verification |
| `ICoreApiFacadeClient` | `CoreApiFacadeOptions` | Internal | Space.Service.CoreApiFacade — legacy user/customer lookup |
| `IOnboardingClient` | `OnboardingClientOptions` | External | Onboarding service — customer creation |
| `INationalRegistryClient` | `NationalRegistryClientOptions` | Internal | Space.Service.NationalRegistry — PINFL lookup, document validation |
| `IFileConverterClient` | `FileConverterOptions` | Internal | Space.Service.FileConverter — HTML-to-PDF conversion (agreements) |
| `IThreatDetectionClient` | `ThreatDetectionServiceOptions` | Internal | Space.Service.ThreatDetection — anti-fraud account creation checks |
| `ICatalogClient` | `CatalogClientOptions` | Internal | Space.Service.Catalog — regions, cities, address data |
| `ICoreBankingForwardProxyClient` | `CoreBankingForwardProxyOptions` | External | IABS Core Banking (forward proxy) — customer CRUD, Shina API |
| `IBankingPlatformForwardProxyClient` | `BankingPlatformForwardProxyOptions` | External | Mambu Banking Platform (forward proxy) — client creation |
| `IMfoClient` | `MfoBankingOptions` | External | MFO Core Banking — customer create/update/get |
| `IProcessingCenterClient` | `ProcessingCenterClientOptions` | External | TBC UZ Processing Center — card processing (SOAP/XML, Basic Auth) |

### Client Configuration

- **Internal clients** (marked `[InternalApiClient]`): Registered via `services.AddRestClient<T>(configuration, configKey)` — uses RestEase with configured base URLs
- **External clients** (marked `[ExternalApiClient]`): Same registration pattern
- **Processing Center**: Manual `HttpClient` setup with Basic authentication and `text/xml` content type
- **IABS Authorization**: Bearer token passed via `IabsOptions.Authorization` header
- **MFO Authentication**: Token-based auth (`GetTokenAsync` / `RefreshTokenAsync`)

### Oracle Direct Access

- `IabsRepository` connects directly to Oracle IABS database via `OracleConnection`
- Executes stored procedure `TBCTECH.non_resident_onboarding_tmp_proc` for non-resident sync
- Connection string from `IabsDbOptions.ConnectionString`

---

## 13. Key Technical Decisions & Patterns Summary

| Pattern | Where Used | Why |
|---------|-----------|-----|
| Clean Architecture | Solution structure (5 layers) | Enforced separation of concerns, testability |
| CQRS | `Features/` folder — Commands + Queries via MediatR | Separate read/write models, clear handler responsibilities |
| Repository Pattern | Application interfaces → Persistence implementations | Decouple data access, enable unit testing with mocks |
| Event-Driven Architecture | 22 consumed + 30 produced events | Async communication with other microservices |
| Feature Toggles | `IFeatureToggle` checks in handlers/workers | Progressive rollout, kill switches |
| Outbox Pattern | `AddEventBus(config, typeof(CustomerDbContext))` | Transactional event publishing |
| Typed HTTP Clients | RestEase interfaces + `AddRestClient<T>` | Declarative API contracts, centralized config |
| Background Workers | 3 `CronBackgroundServiceBase` workers | Async batch processing (PC sync, cleanup, recovery) |
| Distributed Locking | `PostgresDistributedSynchronizationProvider` | Prevent concurrent operations on same customer |
| Options Pattern | 19 options classes with validation | Strongly-typed, validated configuration |
| Sensitive Data Masking | `[SensitiveData]` attribute on properties | PII protection in logs |
| Architecture Tests | `NetArchTest.Rules` in ArchitectureTests project | Enforce architectural constraints at compile time |
| Unit of Work | `AddUnitOfWork(typeof(CustomerDbContext))` | Transactional consistency |
| Multi-tenant Support | `RequestMetadata.TenantId` (TenantIds.TbcUz) | Single service supporting tenant context |

### Notable Deviations

1. **Oracle + PostgreSQL dual database**: IABS Oracle access alongside the primary PostgreSQL store adds operational complexity but is necessitated by core banking system constraints
2. **Processing Center SOAP/XML**: `ProcessingCenterClient` uses SOAP-over-HTTP while all other clients use REST — legacy system integration
3. **Legacy event handlers**: `Features/Customer/Legacy/` folder contains handlers for old event formats from the previous onboarding system, still consumed alongside modernized flows
4. **Raw SQL in repository**: `UpdateAddressesWithMahallaIdsAsync` uses `SqlQueryRaw` for complex batch Mahalla updates — necessary for performance with JOIN and LATERAL subqueries

### Technical Debt & Improvement Opportunities

| Area | Observation |
|------|-------------|
| **Temporary worker** | `MahallaRecoveryWorker` marked "Will be deleted after 2026.02.22" — overdue for removal |
| **Anonymous endpoints** | Multiple endpoints marked `[AllowAnonymous]` that handle sensitive operations (e.g., `create-mfo-corebanking-customer`, `mahalla-recovery`) — may need auth hardening |
| **`[ExcludeFromCodeCoverage]`** | Heavily used on controllers, factories, and some handlers — reduces coverage visibility |
| **Legacy handlers** | 5+ legacy event handlers coexist with modernized versions — migration path should be tracked |
| **Non-production endpoints** | Operations like `DeleteCustomer` and manual update endpoints rely on `[NonProduction]` attribute — ensure infrastructure blocks access in production |
| **Mixed versioning** | IABS API uses `v0.6` and Shina `v1.0.0` — multiple IABS API generations coexist |
| **Preview package** | `System.Drawing.Common` version `10.0.0-preview.3.25173.2` — should be updated to stable |
