# Space.Service.KYC — Comprehensive Service Analysis

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

**Space.Service.KYC** is a Know Your Customer (KYC) microservice responsible for managing the customer identity verification workflow during the onboarding process for a digital banking platform (Space/TBC). It solves the core regulatory compliance problem of collecting, validating, and persisting customer identity verification data before granting access to financial products.

### Domain Context

This service represents the **KYC Bounded Context** within the bank's onboarding domain. It is owned by the **onboarding-baas** team and sits at the intersection of customer onboarding and regulatory compliance. The service operates for the `tbc_uz` tenant (TBC Uzbekistan), evidenced by the CI/CD environment names (`dev-uz`, `qa-uz`, `preprod-uz`, `prod-uz`) and the `scripts/tbc_uz/` migration script directories.

### Key Entities and Domain Models

| Entity | Base Class | Description |
|--------|-----------|-------------|
| `Question` | `SoftDeletedEntityBase<int>` | V1 KYC questionnaire definition — stores question key, label, type (`KycType`), component type, page/order, visibility, parent-child relationships, and audience targeting |
| `Answer` | `SoftDeletedEntityBase<int>` | V1 customer answer record — stores serialized JSON answer data, a `HasKyc` completion flag, and the current KYC type reached |
| `KycQuestion` | `SoftDeletedEntityBase<int>` | V2 dynamic KYC question with i18n titles (`jsonb`), typed options (select, text input, list), answer validation rules, and event triggers |
| `KycAnswer` | `SoftDeletedEntityBase<int>` | V2 customer answer record — stores the full serialized JSON answer payload per customer |

Supporting domain models (nested within `KycQuestion`):

- `TranslationModel` — language-code/translation pair for i18n
- `KycQuestionOptionsModel` — container for `TextInputOption`, `SelectOption`, `ListOption`
- `SelectOption` — includes exacting (regex validation) and branching (`NextQuestionId`)
- `KycEventModel` / `FlowTypeModel` — event triggers per audience type

### Key Enums

| Enum | Purpose |
|------|---------|
| `KycType` | Flags: `Personal`, `Financial`, `PEP` — progressive KYC stages |
| `AudienceType` | Flags: `Resident`, `NonResident` — question targeting |
| `KycQuestionType` | `SingleSelect`, `MultiSelect`, `AllFieldsRequired`, `AtLeastOneFieldRequired` |
| `ComponentType` | `Checkbox`, `TextField`, `Select`, `MultiSelect` — UI component hint |
| `CatalogCode` | Flags enum for 30+ data catalog sources (Countries, Cities, Banks, etc.) |
| `OnboardingFlowType` | `OpenAccount`, `CreateCard` |
| `KycErrorCode` | `KYC_QUESTIONS_EMPTY`, `KYC_ALREADY_EXISTS` |

### Main Use Cases & Workflows

1. **Retrieve KYC Questions (V1)** — Returns localized questionnaire filtered by `AudienceType` with label translation via `.resx` resource files
2. **Retrieve KYC Questions (V2)** — Returns dynamic question set with typed options, validation rules, i18n support, and event metadata
3. **Submit KYC Answers (V1)** — Validates answers against questions, creates/updates the answer record, determines if KYC is fully completed (`HasKyc`), and upon completion publishes events and calls the onboarding service
4. **Submit KYC Answers (V2)** — Validates answers using `KycAnswerValidatorService` (regex, required fields, follow-up questions), persists the answer, publishes events (`kyc-created`, `dynamic-kyc-created`, `check-customer-anti-fraud`, `async-onboarding-started`), and calls the onboarding service
5. **Check KYC Status** — Returns whether a given customer has completed KYC (checks both V1 and V2 answer repositories)

---

## 2. Architecture

### Architectural Pattern

The service follows **Clean Architecture** with **CQRS** (Command Query Responsibility Segregation) pattern, as explicitly defined in the project's architecture guidelines and validated by the architecture tests in `ArchitectureTests.cs`.

**Evidence from the codebase:**

- **Dependency inversion**: `Application` layer defines repository interfaces (`IQuestionRepository`, `IAnswerRepository`); `Persistence` layer provides implementations (`QuestionRepository`, `AnswerRepository`)
- **CQRS separation**: Commands (`CreateAnswerCommand`, `CreateAnswerV2Command`) and Queries (`GetQuestionsQuery`, `GetQuestionsV2Query`, `HasKycQuery`) are separate classes with dedicated handlers
- **MediatR orchestration**: Controllers dispatch via `IMediator.Send()`, handlers inherit from `RequestHandlerBase<TRequest, TResponse>`
- **Architecture tests enforce boundaries**: `Application_ShouldNotDependOnPersistence`, `Domain_ShouldNotDependOnAnyLayer`, `Controllers_ShouldNotDependOnPersistence`, etc.

### Architecture Flow

```
Controller → IMediator → Command/Query Handler → Repository/Service → DbContext
                                                → IEventBus (for events)
                                                → IOnboardingClient (for HTTP)
```

### Project Structure Breakdown

```
Space.Service.KYC/
├── Space.Service.KYC.Api/              # Presentation layer
│   ├── Controllers/                    # KycController, ApiControllerBase
│   ├── ApiExtensions.cs                # API DI registration (auth, swagger, versioning)
│   ├── Program.cs                      # Application entry point, host configuration
│   └── Dockerfile                      # Container image definition
│
├── Space.Service.KYC.Application/      # Business logic layer (core)
│   ├── Features/Kyc/                   # CQRS feature organization
│   │   ├── Commands/CreateAnswer/V1/   # V1 answer creation command, handler, validator
│   │   ├── Commands/CreateAnswer/V2/   # V2 answer creation command, handler, validator
│   │   ├── Queries/HasKyc/            # KYC status query
│   │   ├── Queries/Question/V1/       # V1 question retrieval
│   │   ├── Queries/Question/V2/       # V2 question retrieval
│   │   └── Events/                    # Event definitions (Kyc, AntiFraud, Onboarding)
│   ├── Dtos/                          # Shared DTOs (KycQuestionDto, KycQuestionOptionsDto)
│   ├── HttpClients/Onboarding/        # RestEase interface for onboarding service
│   ├── Options/                       # Configuration POCOs (KYCEncryptionOptions)
│   ├── Repositories/                  # Repository interfaces (IRepositoryBase<T,TId>)
│   ├── Resources/                     # Localization .resx files (en-US, ru-RU, ka-GE, uz-Latn-UZ)
│   ├── Services/                      # Business services (IDatetimeService, IKycAnswerValidatorService)
│   └── ApplicationExtensions.cs       # Application DI registration
│
├── Space.Service.KYC.Domain/          # Domain layer (entities, enums)
│   ├── Entities/                      # Question, Answer, KycQuestion, KycAnswer
│   ├── Enums/                         # KycType, AudienceType, ComponentType, etc.
│   └── Constants/                     # (empty, placeholder)
│
├── Space.Service.KYC.Infrastructure/  # Infrastructure layer
│   ├── Services/                      # DatetimeService implementation
│   ├── Workers/                       # (empty, placeholder)
│   └── InfrastructureExtensions.cs    # Infrastructure DI (HttpClients, EventBus, cache)
│
├── Space.Service.KYC.Persistence/     # Data access layer
│   ├── Configurations/                # EF Core entity configurations (Fluent API)
│   ├── Repositories/                  # Repository implementations
│   ├── Migrations/                    # EF Core migrations (8 migrations, Oct 2023 – Oct 2025)
│   ├── KYCDbContext.cs                # DbContext with 4 DbSets
│   ├── PersistenceExtensions.cs       # Persistence DI registration
│   └── Seeder.cs                      # Data seeding (empty implementation)
│
├── Space.Service.KYC.UnitTests/       # Unit test project
├── Space.Service.KYC.ComponentTests/  # Component/integration test project
├── Space.Service.KYC.ArchitectureTests/ # Architecture rule enforcement
├── Space.Service.KYC.CITools/         # CI utility project
├── scripts/                           # SQL migration scripts per tenant/environment
└── tools/                             # Developer tooling (hooks, coverage, stryker, trivy, sonar)
```

### Dependency Flow Direction

```
Domain ← Application ← Infrastructure
                     ← Persistence
                     ← Api
```

- **Domain** has zero project references (only `Space.Service.Common.Persistence` for base classes)
- **Application** references only **Domain**
- **Infrastructure** references **Application** + **Persistence**
- **Persistence** references **Application** (for repository interfaces)
- **Api** references **Application** + **Infrastructure** + **Persistence**

### CQRS Details

| Aspect | Implementation |
|--------|---------------|
| Mediator library | MediatR (via `Space.Service.Common.Mediator`) |
| Command base class | `RequestHandlerBase<TCommand, TResponse>` and `RequestHandlerBase<TCommand>` (void) |
| Query base class | `RequestHandlerBase<TQuery, TResponse>` |
| Handler organization | `Features/Kyc/Commands/` and `Features/Kyc/Queries/` |
| Pipeline behaviors | `LoggingBehavior<,>`, `ValidationBehavior<,>` (registered in `ApplicationExtensions.cs`) |

### DDD Patterns

This service uses a lightweight DDD approach:

- **Entities**: Present (`Question`, `Answer`, `KycQuestion`, `KycAnswer`) — all inherit from common base classes with ID, timestamps, and soft-delete
- **Aggregates**: Not explicitly defined; entities operate independently
- **Value Objects**: Not used; rich value semantics are captured in nested models (`TranslationModel`, `KycQuestionOptionsModel`)
- **Domain Events**: Not used in the DDD sense; events are published via `IEventBus` in the Application layer
- **Repository pattern**: Full abstraction — interfaces in Application, implementations in Persistence

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Aspect | Value |
|--------|-------|
| Runtime | .NET 9.0 |
| Language | C# (latest features) |
| Target framework | `net9.0` (all projects) |

### Primary Frameworks

| Package | Version | Role |
|---------|---------|------|
| `Microsoft.NET.Sdk.Web` | 9.0 | ASP.NET Core Web API framework |
| `Microsoft.EntityFrameworkCore` | 9.0.9 | ORM |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | (via `UseNpgsql`) | PostgreSQL provider |

### Significant NuGet Packages

| Package | Version | Role |
|---------|---------|------|
| `Space.Service.Common.Mediator` | 2.9.8 | MediatR wrapper with `RequestHandlerBase`, `LoggingBehavior`, `ValidationBehavior` |
| `Space.Service.Common.EventBus` | 2.9.36.7-beta | Event bus abstraction (Kafka-based, evidenced by Kafka CA cert in Dockerfile) |
| `Space.Service.Common.RestClient` | 2.9.23 | RestEase-based typed HTTP client factory |
| `Space.Service.Common.Auth` | 2.9.9 | IdentityServer authentication |
| `Space.Service.Common.Middlewares` | 2.9.12.7-beta | Common middleware pipeline |
| `Space.Service.Common.Swagger` | 2.9.13 | Swagger/OpenAPI configuration |
| `Space.Service.Common.HealthChecks` | 2.9.10 | Health check endpoints |
| `Space.Service.Common.Persistence` | 2.9.14.7-beta | Base entity classes, `DbContextBase`, `IUnitOfWork` |
| `Space.Service.Common.Mapping` | 2.9.2 | AutoMapper configuration |
| `Space.Service.Common.Logging` | 2.9.9 | Serilog integration, `[SensitiveData]` attribute |
| `Space.Service.Common.FeatureToggle` | 2.9.16 | GrowthBook-based feature flags |
| `Space.Service.Common.Misc` | 2.9.64.7-beta | Shared utilities, `RequestMetadata`, `IEncryptionService` |
| `Space.Service.Common.Caching` | 2.9.15 | Caching abstractions (`ISuperCache`) |
| `Space.Service.Common.Factory` | 2.9.9 | Tenant-specific service factory |
| `Space.Service.Common.Exceptions` | 2.9.9 | Custom exception types (`AppException`) |
| `FluentValidation` | (transitive) | Request validation |
| `AutoMapper` | (transitive) | Object mapping |
| `Asp.Versioning` | (transitive) | API versioning |
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus metrics |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |
| `Space.Service.Common.CodeAnalyzers` | 2.9.6 | Custom code analyzers (sensitive data, etc.) |
| `Microsoft.EntityFrameworkCore.Tools` | 9.0.9 | EF Core CLI tools |

### Database

- **Type**: PostgreSQL (Npgsql)
- **ORM**: Entity Framework Core 9.0.9

### Caching

- **In-memory cache**: Registered via `services.AddMemoryCache()` in `InfrastructureExtensions.cs`
- **`ISuperCache`**: Available via `Space.Service.Common.Caching` (mocked in component tests)

### Logging & Observability

- **Serilog**: Structured logging via `UseSerilog()` in `Program.cs`
- **`[SensitiveData]` attribute**: PII masking for log serialization
- **Prometheus metrics**: `prometheus-net.AspNetCore` with `UseHttpMetrics()` and `/metrics` endpoint
- **APM**: Registered via `AddApm(builder.Configuration)` in `Program.cs`

---

## 4. API Layer & Communication

### API Style

**REST** over HTTP/HTTPS with JSON payloads. API versioning via URL path segments (`/api/v{version}/`).

### Endpoints

All endpoints are under `KycController` at route `api/v{version:apiVersion}/[controller]`:

| Version | Method | Route | Auth | Description |
|---------|--------|-------|------|-------------|
| v1.0 | `GET` | `/api/v1/kyc` | Anonymous | Get KYC questions (V1) — filtered by `AudienceType` query param |
| v2.0 | `GET` | `/api/v2/kyc` | Anonymous | Get KYC questions (V2) — dynamic questions with typed options |
| v1.0 | `POST` | `/api/v1/kyc` | Authorized | Submit KYC answers (V1) — progressive multi-type answers |
| v2.0 | `POST` | `/api/v2/kyc` | Authorized | Submit KYC answers (V2) — validated dynamic answers |
| v1.0 | `GET` | `/api/v1/kyc/has-kyc` | Authorized | Check if customer has completed KYC |

### Request/Response Patterns

- **DTOs**: `GetQuestionsResponse`, `GetQuestionsV2Response`, `CreateAnswerResponse`, `HasKycResponse`, `KycQuestionDto`, `KycQuestionOptionsDto`
- **Commands/Queries as request objects**: `CreateAnswerCommand`, `CreateAnswerV2Command`, `GetQuestionsQuery`, `GetQuestionsV2Query`, `HasKycQuery`
- **Result wrapping**: `OkResult()` and `CreatedResult()` helpers in `ApiControllerBase` return `ObjectResult` with explicit status codes
- **No envelope/pagination pattern**: Responses are direct DTOs

### API Versioning Strategy

- Uses `Asp.Versioning` with URL path segment versioning: `[ApiVersion("1.0")]`, `[ApiVersion(2.0)]`
- Default version: 1.0
- V2 adds dynamic question types with richer validation and event support

### Authentication & Authorization

- **IdentityServer authentication**: Configured via `services.AddIdentityServerAuthentication(configuration)` in `ApiExtensions.cs`
- **Default policy**: All controllers require authorization (`[Authorize]` on `ApiControllerBase`)
- **Anonymous endpoints**: Question retrieval endpoints are marked `[AllowAnonymous]`
- **Request metadata**: `RequestMetadata` (from `Space.Service.Common.Misc`) provides `UserId`, `CustomerId`, `BankingPlatformCustomerId`, `BankingPlatformCustomerKey` extracted from auth context

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

Registered in `ApiExtensions.ConfigureAPI()`, in order:

```csharp
app.UsePathBase(pathBase);          // Base path: "/kyc"
app.UseLocalization();              // Accept-Language header → CultureInfo
app.UseHttpsRedirection();          // HTTP → HTTPS redirect
app.UseRouting();                   // Endpoint routing
app.UseHttpMetrics();               // Prometheus HTTP metrics
app.UseAuthentication();            // IdentityServer JWT validation
app.UseStaticFiles();               // Static file serving (swagger-ui)
app.UseAuthorization();             // Authorization policies
app.UseMiddlewares();               // Common middlewares (from Space.Service.Common.Middlewares)
app.UseHealthCheckMiddleware(env);  // Health check endpoints
app.UseEventEndpoints();            // Event bus consumer endpoints
app.UseVersionEndpoint(config);     // Version info endpoint
endpoints.MapControllers();         // Controller routing
endpoints.MapMetrics();             // Prometheus /metrics endpoint
app.UseSwagger(env, provider, pathBase); // Swagger UI
```

### MediatR Pipeline Behaviors

Registered in `ApplicationExtensions.cs`, in execution order:

1. **`LoggingBehavior<,>`** — Logs request/response with sensitive data masking
2. **`ValidationBehavior<,>`** — Runs FluentValidation validators before handler execution

### Global Exception/Error Handling

- **`AppException`**: Custom exception from `Space.Service.Common.Exceptions` used throughout handlers for business rule violations (e.g., `KYC_QUESTIONS_EMPTY`, `KYC_ALREADY_EXISTS`, "Invalid answer", "Required question not answered")
- **Common middlewares** (`UseMiddlewares()`): Provides global exception handling, correlation ID propagation, and request/response logging (from `Space.Service.Common.Middlewares`)

### Request Validation

- **FluentValidation**: Validators registered from assembly in `ApplicationExtensions.cs`
- **`CreateAnswerCommandValidator`**: Validates `Answers` is not null
- **`CreateAnswerV2CommandValidator`**: Validates `AudienceType`, `PhoneNumber`, `Answers`, `RefreshToken` are not empty
- **`SuppressModelStateInvalidFilter = true`**: Built-in model validation is suppressed in favor of FluentValidation pipeline
- **Runtime validation**: `KycAnswerValidatorService.ValidateAll()` performs deep answer validation (question existence, required answers, follow-up questions, regex patterns, option validity, quantity checks per question type)

### Correlation ID / Request Tracing

- Handled by `Space.Service.Common.Middlewares` (correlation ID propagation)
- `RequestMetadata` carries `BankingPlatformCorrelationId` through the request lifecycle

---

## 6. Data Layer

### Database Type & Provider

- **Database**: PostgreSQL
- **Provider**: Npgsql via `UseNpgsql()` in `PersistenceExtensions.cs`
- **Connection string key**: `"NpgSql"` from `configuration.GetConnectionString("NpgSql")`

### ORM Configuration

**DbContext**: `KycDbContext` extends `DbContextBase` (from `Space.Service.Common.Persistence`):

```csharp
public DbSet<Question> Questions { get; set; }
public DbSet<Answer> Answers { get; set; }
public DbSet<KycQuestion> KycQuestions { get; set; }
public DbSet<KycAnswer> KycAnswers { get; set; }
```

- Configurations applied via `modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly())`
- Lifetime: **Scoped** (default EF Core)

### Entity Configurations

| Entity | Table | Notable Configuration |
|--------|-------|----------------------|
| `Question` | `Questions` | Unique index on `Key`; `Type`, `ComponentType`, `DataSource` stored as strings (`EnumToStringConverter`); `Data` as `jsonb` |
| `Answer` | `Answers` | Unique index on `CustomerId`; `CurrentType` as string; `Data` as `jsonb` (required) |
| `KycQuestion` | `KycQuestions` | Unique index on `Key` and `Page`; `KycQuestionType` as string; `Title`, `Options`, `Event` as `jsonb` with JSON serialization converters; `AnswerRequired` default `false` |
| `KycAnswer` | `KycAnswers` | Unique index on `CustomerId`; `Answer` as `jsonb` (required) |

### Migration Strategy

- **EF Core Migrations** in `Space.Service.KYC.Persistence/Migrations/`
- 8 migrations spanning Oct 2023 – Oct 2025:
  1. `20231018133419_InitMigration` — Initial schema
  2. `20250324155646_AddAudience` — Audience type support
  3. `20250717125556_AddKycQuestionsTable` — V2 KycQuestions table
  4. `20250717135319_ChangeTitleToJsonb` — Title column to jsonb
  5. `20250721104908_FixTitleToJsonb` — jsonb fix
  6. `20250725163410_AddKycAnswer` — V2 KycAnswers table
  7. `20250807095252_AddAnswerRequiredKycQuestions` — AnswerRequired flag
  8. `20251016140257_AddKycQuestionEvent` — Event column on KycQuestions
- Auto-migration on startup: `db.Database.Create().Wait(); db.Database.Migrate();` in `PersistenceExtensions.ConfigurePersistence()`
- Manual SQL scripts in `scripts/{tenant}/{environment}/` for ad-hoc migrations with custom history table `__MigrationsHistory`

### Repository Pattern

Full repository abstraction:

- **`IRepositoryBase<TEntity, TEntityId>`** — Generic CRUD interface in `Application/Repositories/`
- **`RepositoryBase<TEntity, TEntityId>`** — Generic implementation in `Persistence/Repositories/` using `KycDbContext`
- Each `SaveChangesAsync()` call is in the repository methods themselves
- **`IUnitOfWork`** from `Space.Service.Common.Persistence` — Used for transactions spanning multiple operations (answer creation + event publishing)

### Read/Write Separation

- Queries use `AsNoTracking()` for read operations
- Write operations use the change tracker normally
- No separate read database or CQRS read store

### Connection Resilience

- Configured at the Npgsql level via standard EF Core configuration (no explicit retry policies visible in the codebase)

---

## 7. Messaging & Event Handling

### Message Broker

**Apache Kafka** — evidenced by:
- Kafka CA certificate (`ca_cert_kafka.pem`) copied in the Dockerfile
- `Space.Service.Common.EventBus` library with `IEventBus.Produce()` method
- `[ProduceEvent]` / `[ConsumeEvent]` attributes
- `app.UseEventEndpoints()` in the middleware pipeline
- Registration: `services.AddEventBus(configuration, typeof(KycDbContext))` in `InfrastructureExtensions.cs`

### Published Events

| Event Class | Topic | Routing Key | Trigger |
|-------------|-------|-------------|---------|
| `CreateKycAnswerEvent` | `kyc` | `kyc-created` | KYC answers submitted (V1 with `HasKyc=true`, V2 always) |
| `CreateDynamicKycAnswerEvent` | `kyc` | `dynamic-kyc-created` | V2 KYC answers submitted |
| `CheckCustomerAntiFraudEvent` | `kyc` | `check-customer-anti-fraud` | KYC completion triggers anti-fraud check (V1 when async toggle on, V2 always) |
| `StartAsyncOnboardingEvent` | `kyc` | `async-onboarding-started` | Triggers async onboarding flow after KYC (V1 when async toggle on, V2 always) |

### Published Event Details

**`CreateKycAnswerEvent`** contains:
- Customer/user identifiers, banking platform correlation data
- `HasKyc` flag, onboarding flow type/checkpoint
- `KycAnswerEventModel` with mapped answer data (green card, activity field, income source, etc.)
- `OnboardedFrom: "TBCApp"`, `IsDigitallyOnboarded: true`

**`CreateDynamicKycAnswerEvent`** contains:
- Customer ID, correlation data, audience type
- Raw `List<KycAnswer>` answers

**`CheckCustomerAntiFraudEvent`** contains:
- Customer/user IDs, session IDs (TMX, Formica)
- Encrypted `AccessToken` (refresh token + user access token encrypted with AES)
- IP address, platform, phone number

**`StartAsyncOnboardingEvent`** contains:
- Customer ID, onboarding flow type, mapped KYC answer data

### Consumed Events

No consumed events are present — this service is a **producer-only** for events. It does not subscribe to any Kafka topics. The `UseEventEndpoints()` middleware enables the event bus infrastructure but no `[ConsumeEvent]` attributes exist in the codebase.

### Event Handling Patterns

- **Transactional outbox** (implied): Events are published within a `IUnitOfWork` transaction — `BeginTransactionAsync()` → write to DB → `Produce()` events → `CommitAsync()`
- The `AddEventBus(configuration, typeof(KycDbContext))` registration links the event bus to the DbContext, suggesting the common library implements outbox pattern internally

---

## 8. Background Jobs & Scheduled Tasks

This service has **no background jobs or scheduled tasks**. The `Infrastructure/Workers/` directory contains only a `.gitkeep` placeholder file. The infrastructure supports `PeriodicBackgroundServiceBase` and `CronBackgroundServiceBase` from `Space.Service.Common.Workers` but none are implemented.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Serilog**: Configured via `builder.Host.UseSerilog()` in `Program.cs`
- **Structured logging**: Standard Serilog structured log format
- **Sensitive data masking**: `[SensitiveData]` attribute on properties causes values to be masked as `"*** HIDDEN ***"` in logs, applied to: `Key`, `Title` (on questions), `PhoneNumber`, `RefreshToken`, `Email`, `IpAddress`, `AccessToken`, and answer data
- **`LoggingBehavior<,>`**: MediatR pipeline behavior logs every request/response

### Health Checks

- Registered via `services.AddHealthChecks(configuration)` from `Space.Service.Common.HealthChecks`
- Exposed via `app.UseHealthCheckMiddleware(env)`

### Rate Limiting

Not configured in this service.

### Resilience Patterns

- **`IUnitOfWork` transactions**: `await using IDbContextTransaction` provides automatic rollback on failure
- No explicit Polly circuit breaker, retry, or timeout policies visible in the codebase
- External HTTP calls via RestEase may inherit resilience from `Space.Service.Common.RestClient`

### Configuration Management

- **Local**: `appsettings.Local.json` + User Secrets
- **Deployed environments**: External JSON files mounted at:
  - `/settings/globalsettings.json`
  - `/settings/appsettings.json`
  - `/settings/dbsettings.json`
- **Configuration watch**: `builder.Configuration.Watch(settingsFilePaths)` for dynamic reload
- **Options pattern**: `KYCEncryptionOptions` bound via `.BindConfiguration().ValidateDataAnnotations().ValidateOnStart()`
- **Feature flags**: GrowthBook via `services.AddFeatureToggle(configuration)` — toggle `"onboarding-corebanking-create-customer"` controls V1 async onboarding behavior
- **Encryption**: `IEncryptionService` for AES-CBC/AES-GCM encryption of tokens before event publishing, configured via `EncryptionOptions` section

### Localization

- **4 language files**: `SharedResources.en-US.resx`, `SharedResources.ru-RU.resx`, `SharedResources.ka-GE.resx`, `SharedResources.uz-Latn-UZ.resx`
- V1 uses `IStringLocalizer<SharedResources>` for question/answer label translation
- V2 uses `CultureInfo.CurrentCulture.Name` to select translations from `jsonb` `TranslationModel` arrays

---

## 10. Testing

### Test Projects

| Project | Type | Framework |
|---------|------|-----------|
| `Space.Service.KYC.UnitTests` | Unit tests | xUnit 2.9.2 |
| `Space.Service.KYC.ComponentTests` | Integration/component tests | xUnit 2.9.2 + `WebApplicationFactory` |
| `Space.Service.KYC.ArchitectureTests` | Architecture rule tests | xUnit 2.9.2 + NetArchTest |

### Testing Frameworks & Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| xUnit | 2.9.2 | Test framework |
| FluentAssertions | 7.2.0 | Fluent assertion syntax |
| NSubstitute | 5.3.0 | Mocking library |
| AutoFixture | 4.18.1 | Test data generation |
| Microsoft.EntityFrameworkCore.InMemory | 9.0.9 | In-memory database for tests |
| Microsoft.AspNetCore.Mvc.Testing | 9.0.11 | `WebApplicationFactory` for component tests |
| WireMock.Net | 1.5.47 | HTTP mock server for external service simulation |
| coverlet | 6.0.2 | Code coverage collection |
| Space.Service.Common.Tests | 2.9.8 | Shared test utilities (`TestsUtils.Equivalent`) |
| GitHubActionsTestLogger | 2.4.1 | CI test output formatting |

### Mocking Strategy

- **NSubstitute** for all dependency mocking (`IMediator`, `IQuestionRepository`, `IEventBus`, `IOnboardingClient`, `IFeatureToggle`, `IUnitOfWork`, etc.)
- **In-memory EF Core** for repository tests and component tests
- **WireMock.Net** for external HTTP service mocking in component tests
- **`AnonymousAuthorizationHandler`** bypasses auth in component tests
- **`ISuperCache`** and **`IEventBus`** are replaced with NSubstitute mocks in `CustomWebApplicationFactory`

### Notable Test Patterns & Fixtures

**Unit Tests:**
- `InMemoryDbContextFixture` — Creates in-memory `KycDbContext` with seeded data, shared via xUnit collection fixtures
- `MapperFixture` — Provides AutoMapper `IMapper` instance
- `LocalizerFixture` — Provides `IStringLocalizer<SharedResources>`
- `SharedFixtureCollection` — xUnit `[CollectionDefinition]` combining all fixtures
- `KycDbInitializer` — Seeds questions, answers, and KYC answers for tests

**Component Tests:**
- `CustomWebApplicationFactory<Program>` — Full ASP.NET Core test server with in-memory DB, mocked event bus, mocked cache, anonymous auth, and custom configuration
- `WireMockServerFixture` — Standalone WireMock server on port 5980
- Snapshot testing: `TestsUtils.Equivalent()` compares responses to JSON files (`Responses/KycQuestions.json`, `Responses/KycAnswer.json`)

**Architecture Tests:**
- 14 architecture rules enforced via `NetArchTest.Rules`:
  - Layer dependency rules (Domain → nothing, Application → no Persistence/Infrastructure, Controllers → no Persistence/Domain/Infrastructure)
  - Naming conventions (Controllers end with "Controller", Handlers end with "CommandHandler"/"QueryHandler", Repositories end with "Repository")
  - Pattern enforcement (Controllers inherit `ApiControllerBase`, Controllers depend on MediatR, Produced events end with "Event", Consumed events end with "Command")

### Test Coverage Enforcement

- Pre-commit hook runs tests with coverage collection
- **90% combined (line + branch) coverage threshold** enforced before push
- Reports generated via `dotnet-reportgenerator-globaltool`

### Mutation Testing

- **Stryker.NET** via `space.tools.stryker` custom tool
- **80% mutation score threshold** enforced in pre-push hook
- `// Stryker disable once` comments used to suppress specific mutations
- Results stored in `.stryker/` directory and compared with remote scores

---

## 11. DevOps & Deployment

### Dockerfile Analysis

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0           # Runtime-only base image (not SDK)
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt       # TLS CA cert
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt  # Kafka CA cert
RUN update-ca-certificates --verbose                # Trust custom CAs
COPY app/publish  .                                 # Pre-built publish output
ENV ASPNETCORE_HTTP_PORTS=80
ENTRYPOINT ["dotnet", "Space.Service.KYC.Api.dll"]
```

**Notes:**
- Single-stage (no build stage) — build happens externally in CI/CD
- Slim runtime image (`aspnet:9.0`)
- Custom CA certificates for internal TLS and Kafka SSL
- Port 80 only (HTTPS termination assumed at load balancer/ingress)

### CI/CD Pipeline

All pipelines use **GitHub Actions** with reusable workflows from `SpaceBank/Space.Service.Workflows`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-cd.yaml` | Push to `master` | Full CI/CD: build, test, Docker build, deploy to `dev-uz` → `automation-uz` → `qa-uz` → `preprod-uz` → `prod-uz` |
| `cd.yaml` | Manual dispatch | Deploy to specific environment |
| `pull-request.yaml` | Pull request | PR checks: build, test, Pact contract verification |
| `stryker.yaml` | Daily cron + manual | Mutation testing |
| `zaproxy.yaml` | Weekly cron (Sunday) + manual | OWASP ZAP security scanning |
| `update-packages.yaml` | Manual | Automated NuGet package upgrades |
| `generate-readme.yaml` | Weekly cron (Friday) + manual | README auto-generation |
| `notify.yaml` | Manual (called by other workflows) | Slack deployment notifications |
| `dora.yaml` | Manual (called by other workflows) | DORA metrics tracking |
| `create-kibana-alert-rules.yaml` | Manual | Kibana alerting setup |
| `assign-copilot.yaml` | Issue events | GitHub Copilot issue assignment |
| `sync-copilot-configs.yaml` | Manual | Sync Copilot configuration |

**CI/CD Features:**
- **Pact contract testing**: Provider and consumer contracts published, can-i-deploy checks, deployment recording
- **Sanity checks**: Enabled for deployments
- **ArgoCD**: Deployment via ArgoCD app `space-service-kyc`
- **Docker image**: `space-service-kyc`

### Orchestration

- **ArgoCD** for Kubernetes deployments (referenced in CI/CD workflows)
- No Docker Compose file present

### Environment-Specific Configurations

- SQL scripts in `scripts/tbc_uz/{dev,automation,qa,preprod,prod}/`
- Runtime config from mounted JSON files: `/settings/globalsettings.json`, `/settings/appsettings.json`, `/settings/dbsettings.json`

### Developer Tooling

| Tool | Script | Purpose |
|------|--------|---------|
| Local setup | `tools/localDevSetup.sh` | Installs Trivy, copies git hooks, sets script permissions |
| Commit message hook | `tools/hooks/commit-msg` | Enforces format: `<ABBR-123> \| message \| <author>` |
| Code coverage | `tools/codeCoverage/coverage-precommit.sh` | Pre-push 90% coverage gate |
| Coverage report | `tools/codeCoverage/run-tests-with-coverage-local.sh` | Local HTML coverage report |
| Mutation testing | `tools/stryker/stryker-precommit.sh` | Pre-push 80% mutation score gate |
| Stryker run | `tools/stryker/run-stryker.sh` | Local Stryker execution |
| Secret scanning | `tools/trivy/run-trivy-secret-scan.sh` | Trivy secret detection |
| SonarQube | `tools/sonarqube/run-sonar-scan.sh` | Local SonarQube scan |
| ZAP rules | `tools/zap/rules.tsv` | OWASP ZAP scan rule configuration |

---

## 12. External Service Dependencies

### HTTP Clients

| Client Interface | Base URL Config | Method | Purpose |
|-----------------|----------------|--------|---------|
| `IOnboardingClient` | `OnboardingOptions` | `POST api/customer/kyc` | Creates KYC record in the onboarding service after answer submission |

### Client Configuration

- Registered via `services.AddRestClient<IOnboardingClient>(configuration, "OnboardingOptions")` in `InfrastructureExtensions.cs`
- Uses **RestEase** via `Space.Service.Common.RestClient` — typed HTTP client with `[ExternalApiClient]` attribute
- Base URL resolved from `OnboardingOptions` configuration section

### Request Details

```csharp
[Post("api/customer/kyc")]
Task CreateKyc([Body] CreateKycRequest request);
```

`CreateKycRequest` includes:
- `BankingPlatformCorrelationId`, `UserId`
- `OnboardingFlowStart` (enum)
- `IsAsyncModenrizationToggleOn` (feature flag state)
- `Data` → `KycAnswersRequest` with `GreenCard`, `ActivityField`, `IncomeSource`, `RelationPurposes`

### Resilience Policies

No explicit Polly policies are configured for outgoing HTTP calls in this service. Resilience may be provided by the `Space.Service.Common.RestClient` library internally.

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Summary Table

| Pattern | Where Used | Why |
|---------|-----------|-----|
| Clean Architecture | Project structure (5 layers) | Dependency inversion, testability, layer isolation |
| CQRS | `Features/Kyc/Commands/` + `Queries/` | Separates read/write paths, simplifies handlers |
| MediatR | Controllers → Handlers | Decouples controllers from business logic |
| Repository Pattern | `Application/Repositories/` (interfaces), `Persistence/Repositories/` (implementations) | Database abstraction, testability |
| Unit of Work | `IUnitOfWork` in command handlers | Transactional consistency across DB writes + event publishing |
| Feature Toggles | `IFeatureToggle.IsOn()` in V1 handler | Runtime feature control without redeployment (GrowthBook) |
| API Versioning | `[ApiVersion]` on controller actions | V1/V2 coexistence for backward compatibility |
| Soft Delete | `SoftDeletedEntityBase<T>` on all entities | Data retention compliance, logical deletion |
| Fluent Validation | `AbstractValidator<T>` classes | Declarative input validation in MediatR pipeline |
| Event-Driven Architecture | `IEventBus.Produce()` with 4 event types | Asynchronous integration with downstream services |
| Outbox Pattern | Transaction wrapping DB writes + event production | Eventual consistency guarantee |
| Sensitive Data Masking | `[SensitiveData]` attribute | PII protection in logs |
| Localization | `.resx` files (V1) + `jsonb` translations (V2) | Multi-language support (en-US, ru-RU, ka-GE, uz-Latn-UZ) |
| Architecture Tests | `NetArchTest.Rules` in `ArchitectureTests` | Automated enforcement of layer boundaries and naming conventions |
| Mutation Testing | Stryker.NET with 80% threshold | Test quality assurance |
| Contract Testing | Pact (provider + consumer) in CI/CD | API compatibility verification |

### Notable Deviations from Conventions

1. **V1/V2 coexistence**: The service maintains two parallel systems for questions and answers (`Question`/`Answer` vs `KycQuestion`/`KycAnswer`), each with different data models. V1 uses flat questions with string-based data (`jsonb`), while V2 uses typed option models. This creates duplication in repositories, handlers, and the database schema.

2. **Feature toggle controlling event flow in V1**: The V1 `CreateAnswerCommandHandler` uses `featureToggle.IsOn("onboarding-corebanking-create-customer")` to conditionally publish anti-fraud and async onboarding events. The V2 handler always publishes these events, suggesting V1 is on a deprecation path.

3. **Mixed automation strategies for IncomeSource → ActivityField**: V1 handler contains a hardcoded dictionary-like `switch` statement mapping income sources to activity fields. V2 does not replicate this logic, relying on the upstream consumer to handle mapping.

4. **CityOfResidence/AddressOfResidence duplication**: V1 handler explicitly creates `*Lat` suffixed copies of certain answer fields — a workaround likely for downstream system requirements.

5. **Empty Workers and Constants directories**: The `Infrastructure/Workers/` and `Domain/Constants/` directories contain only `.gitkeep` files, suggesting planned but unimplemented functionality.

### Technical Debt & Improvement Opportunities

| Area | Observation |
|------|-------------|
| **V1 deprecation** | V1 commands/queries/handlers/entities could be removed once all clients migrate to V2, reducing code duplication significantly |
| **Seeder empty** | `Seeder.cs` is a no-op (`Task.CompletedTask`) — seed data is managed via SQL scripts, but the seeder hook remains unused |
| **No explicit resilience policies** | No Polly configuration for HTTP client calls or database connections |
| **Regex timeout** | V2 answer validation uses `TimeSpan.FromMilliseconds(300)` for regex matching — appropriate, but the V1 handler has no such protection |
| **Typo in code** | `IsAsyncModenrizationToggleOn` — "Modernization" is misspelled throughout (command, handler, event properties) |
| **`ExcludeFromCodeCoverage`** on handlers | V1 and V2 command handlers are marked `[ExcludeFromCodeCoverage]` despite having complex business logic — these should be tested directly |
| **No consumed events** | Service is event producer only — no event consumption implemented despite the event bus infrastructure being registered |
| **Encryption key management** | Encryption keys appear in test configuration as plaintext strings — production key management strategy is not visible in the codebase |
| **GC configuration** | `Directory.Build.props` enables server GC with `GarbageCollectionAdaptationMode=1` — appropriate for server workloads but should be validated with load testing |
