# Space.Service.CoreApiFacade — Service Analysis

> **Generated:** 2026-04-02  
> **Repository:** `SpaceBank/Space.Service.CoreApiFacade`  
> **Owner Team:** platform-team-software-architects

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

**Space.Service.CoreApiFacade** is a **Facade API** that acts as a gateway between internal microservices and the core banking system ("CoreApi"). It does not own or persist domain data itself; instead, it translates and proxies operations to a downstream Core API, abstracting its protocol details from the rest of the platform.

### Domain Context

This service sits in the **Core Banking Integration** bounded context. It shields upstream consumers (mobile apps, other internal services) from the specifics of the legacy/core banking API surface, providing a clean, consistent interface.

### Key Entities & Domain Models

Because this is a facade, it does not own persistent entities. The primary **data models** flowing through the service are:

| Model | Description |
|---|---|
| `CreateUserCommand` / `CreateUserResponse` | User lifecycle data (identity-service user creation) |
| `CreateCustomerCommand` / `CreateCustomerRequest` | Customer profile creation payload |
| `CreateTransferFavoriteCommand` / `CreateTransferFavoriteResponse` | Transfer favorite records |
| `CreateTransferPreCalculatedDataRequest` | Pre-calculated transfer data |
| `FreezeCurrencyRateCommand` / `FreezeCurrencyRateResponse` | Frozen exchange rate records |
| `GetPFMCardsQuery` / `GetPFMCardsResponse` | PFM card data |
| `GetCustomerProductInfoResponse` | Product order information |
| `GetTaxCommiteeReceiptResponse` / `GetTaxCommitteeReceiptResponse` | Tax committee receipt data |
| `GetUserSavingsResponse` | Savings standing orders |

### Main Use Cases

- **User Management** — Create identity users, check if a user exists, look up user IDs by phone number.
- **Customer Profiles** — Create customers and set temporary contract IDs.
- **Card Operations** — Retrieve PFM cards and user cards for transaction history.
- **Product Orders** — Create, query, and update card product order info.
- **Transfer Workflows** — Create/sync/update pre-calculated transfer data; manage transfer favorites (CRUD + image upload).
- **Currency Rate Freezing** — Freeze exchange rates for a customer.
- **Tax Receipts** — Generate tax committee receipts (legacy and new paths).
- **File Uploads** — Upload files via the core API.
- **Savings Insights** — Retrieve upcoming savings standing orders.
- **Action Records** — Create and update generic "action" records.

---

## 2. Architecture

### Architectural Pattern

**Clean Architecture with CQRS** — justified by:

1. **Layer separation**: The solution has distinct `Api`, `Application`, and `Infrastructure` projects with dependency arrows pointing inward (Api → Application ← Infrastructure).
2. **CQRS via MediatR**: Every operation is modelled as either a `Command` or `Query` implementing `IRequest<T>`, dispatched through MediatR. Handlers inherit from `RequestHandlerBase<TRequest, TResponse>` (from `Space.Service.Common.Mediator`).
3. **Feature folders**: The `Application/Features/` directory groups code by business feature, each containing `Commands/` and/or `Queries/` sub-folders.

**Architecture Flow:**

```
Controller → IMediator → Command/Query Handler → ICoreApiClient (RestEase) → Core Banking API
```

> **Important deviation from typical Clean Architecture**: This service has **no Domain layer, no Persistence layer, and no Repository layer**. This is expected because it is a pure facade — it does not own any persistent state.

### Project Structure Breakdown

| Project | Responsibility |
|---|---|
| `Space.Service.CoreApiFacade.Api` | ASP.NET Core Web API host. Controllers, DI registration (`ApiExtensions.cs`), middleware pipeline configuration, Dockerfile. |
| `Space.Service.CoreApiFacade.Application` | All business logic. Feature folders with Commands/Queries/Handlers/Validators/Responses, RestEase HTTP client interfaces, enums, configuration options, localization resources. |
| `Space.Service.CoreApiFacade.Infrastructure` | External integration wiring. Registers the `ICoreApiClient` RestEase HTTP client and `TimeProvider`. |
| `Space.Service.CoreApiFacade.UnitTests` | Unit tests for controllers and command/query handlers. |
| `Space.Service.CoreApiFacade.ComponentTests` | Integration/component tests using `WebApplicationFactory` and WireMock. |
| `Space.Service.CoreApiFacade.ArchitectureTests` | Architectural fitness tests using `NetArchTest.Rules`. |
| `Space.Service.CoreApiFacade.CITools` | CI utility — generates event schemas and API contracts. |

### Dependency Flow

```
Api ──────► Application ◄────── Infrastructure
 │                                    │
 └──► Infrastructure                  └──► Application
```

- `Application` references **no other project** — it is the core with zero outward dependencies.
- `Infrastructure` references `Application` (to implement its interfaces).
- `Api` references both `Application` and `Infrastructure`.

This is enforced by architecture tests in `ArchitectureTests.cs`:

```csharp
[Fact]
public void Application_ShouldNotDependOnInfrastructure()
{
    TestResult result = ShouldNotDependOn(ApplicationLayer, InfrastructureLayer);
    Assert.True(result.IsSuccessful, result.GetFailingTypeNames());
}
```

### CQRS Details

- **Commands** represent state-changing operations (e.g., `CreateUserCommand`, `FreezeCurrencyRateCommand`, `UpdateActionCommand`).
- **Queries** represent read operations (e.g., `GetPFMCardsQuery`, `GetUserSavingsQuery`, `GetCardProductOrderInfoQuery`).
- All handlers derive from `RequestHandlerBase<TRequest, TResponse>` and receive `RequestMetadata`, `IMapper`, `IMediator`, plus the `ICoreApiClient`.
- **No event sourcing** or domain events are produced within this service.

### DDD Patterns

Not applicable. This is a facade with no Aggregates, Value Objects, Domain Events, or Repositories of its own. The `Application/Enums/` and feature-level `Enums/` directories contain simple enums (`CardStatus`, `TransferType`, `ActionType`, etc.), not rich domain objects.

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Item | Value |
|---|---|
| Runtime | .NET 9.0 |
| Language | C# (latest features, file-scoped namespaces, pattern matching) |
| Target | `net9.0` (all projects) |

### Primary Frameworks

| Framework | Version | Role |
|---|---|---|
| ASP.NET Core | 9.0 | Web API host |
| MediatR | via `Space.Service.Common.Mediator 2.9.8` | CQRS mediator / pipeline |
| FluentValidation | via `Space.Service.Common.Mediator` + direct | Request validation |
| AutoMapper | via `Space.Service.Common.Mapping 2.9.2` | DTO ↔ model mapping |
| RestEase | via `Space.Service.Common.RestClient 2.9.23` | Typed HTTP client for Core API |

### All Significant NuGet Packages

| Package | Version | Role |
|---|---|---|
| `Space.Service.Common.Auth` | 2.9.9 | IdentityServer authentication |
| `Space.Service.Common.HealthChecks` | 2.9.10 | Health/readiness probes |
| `Space.Service.Common.Middlewares` | 2.9.11 | Common middleware pipeline (exception handling, correlation IDs, etc.) |
| `Space.Service.Common.Misc` | 2.9.56 | Shared utilities (`RequestMetadata`, `CountryCodes`, `CurrencyCode`, etc.) |
| `Space.Service.Common.Swagger` | 2.9.13 | Swagger/OpenAPI generation |
| `Space.Service.Common.Logging` | 2.9.9 | Structured logging, `[SensitiveData]` attribute |
| `Space.Service.Common.Caching` | 2.9.15 | Caching abstractions |
| `Space.Service.Common.Mapping` | 2.9.2 | AutoMapper registration |
| `Space.Service.Common.Mediator` | 2.9.8 | MediatR + `RequestHandlerBase`, `LoggingBehavior`, `ValidationBehavior` |
| `Space.Service.Common.RestClient` | 2.9.23 | RestEase HTTP client factory |
| `Space.Service.Common.EventBus` | 2.9.35 | Event bus abstractions (`[ProduceEvent]`, `[ConsumeEvent]` attributes) |
| `Space.Service.Common.Exceptions` | 2.9.9 | Custom exception types (`AppException`, etc.) |
| `Space.Service.Common.CodeAnalyzers` | 2.9.6 | Custom Roslyn analyzers (SensitiveData, etc.) |
| `Space.Service.Common.ContractsGenerator` | 2.9.7 | API contract generation (CITools) |
| `Space.Service.Common.EventSchemaGenerator` | 2.9.12 | Event schema generation (CITools) |
| `Space.Service.Common.Tests` | 2.9.8 | Test utilities |
| `Microsoft.EntityFrameworkCore.Design` | 9.0.10 | EF Core design-time tools (for migrations tooling, not used at runtime) |
| `Microsoft.Extensions.Caching.Memory` | 9.0.10 | In-memory caching |
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus metrics endpoint |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |
| `Asp.Versioning` | (transitive) | API versioning |

### Database

**None.** This service has no database, no `DbContext`, no migrations, and no persistence layer. It is a stateless facade that proxies all data operations to the downstream Core API.

### Caching

`Space.Service.Common.Caching 2.9.15` and `Microsoft.Extensions.Caching.Memory 9.0.10` are referenced in the Infrastructure project, providing in-memory caching capabilities. No Redis or distributed cache is configured.

### Logging & Observability

| Concern | Implementation |
|---|---|
| Structured Logging | Serilog (registered via `builder.Host.UseSerilog(...)`) |
| APM | `services.AddApm(builder.Configuration)` (via `Space.Service.Common.Misc`) |
| Metrics | Prometheus (`prometheus-net.AspNetCore 8.2.1`), exposed via `endpoints.MapMetrics()` |
| Sensitive Data Masking | `[SensitiveData]` attribute (from `Space.Service.Common.Logging.SensitiveData`) |

---

## 4. API Layer & Communication

### API Style

**REST** over HTTP/JSON. All controllers produce `application/json`.

### API Versioning

URL-segment versioning: `api/v{version:apiVersion}/[controller]`. Registered via `services.AddVersioning()`. Version discovery endpoint exposed via `app.UseVersionEndpoint(configuration)`.

### Path Base

All routes are prefixed with `/coreapifacade` in non-local environments (configured via `PATH_BASE` environment variable).

### Endpoints by Controller

#### `ActionController` — `/api/v{v}/action`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `POST` | `/` | Create a new Action | Anonymous |
| `POST` | `/update` | Update an Action | Anonymous |

#### `CardController` — `/api/v{v}/card`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `GET` | `/pfm/cards` | Get PFM cards | Anonymous |
| `GET` | `/user/cards` | Get user cards for transaction history | Anonymous |

#### `CommonController` — `/api/v{v}/common`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `POST` | `/upload-file` | Upload a file | Anonymous |

#### `CurrencyController` — `/api/v{v}/currency`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `POST` | `/freeze` | Freeze currency rate for a customer | Authorized |

#### `CustomerController` — `/api/v{v}/customer`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `POST` | `/` | Create a new customer | Authorized |
| `PUT` | `/temporary-contract` | Set temporary contract ID | Authorized |

#### `ProductOrderController` — `/api/v{v}/productorder`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `GET` | `/` | Get card product order info | Authorized |
| `POST` | `/` | Create card product order info | Authorized |
| `PATCH` | `/` | Update card product order status | Authorized |

#### `TaxCommitteeController` — `/api/v{v}/taxcommittee`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `POST` | `/` | Create tax committee receipt (legacy) | Anonymous |
| `POST` | `/new` | Create tax committee receipt (new) | Anonymous |

#### `TransferController` — `/api/v{v}/transfer`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `POST` | `/` | Create transfer pre-calculated data | Authorized |
| `PUT` | `/` | Update transfer pre-calculated data user input | Authorized |
| `PUT` | `/sync/precalculated/data` | Sync transfer pre-calculated data | Anonymous |
| `POST` | `/sync/favorite` | Create transfer favorite | Anonymous |
| `DELETE` | `/favorites` | Delete transfer favorite | Anonymous |
| `PUT` | `/favorite` | Update transfer favorite | Anonymous |
| `PATCH` | `/sync/favorite/image` | Update transfer favorite image | Anonymous |

#### `UpcomingExpenseController` — `/api/v{v}/upcomingexpense`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `GET` | `/savings` | Get user savings standing orders | Authorized |

#### `UserController` — `/api/v{v}/user`

| Method | Route | Operation | Auth |
|---|---|---|---|
| `POST` | `/` | Create a new user | Anonymous |
| `GET` | `/` | Get user ID by phone number | Anonymous |
| `POST` | `/check` | Check if user is registered | Anonymous |

### Request/Response Patterns

- Commands and queries are **MediatR request objects** passed directly as `[FromBody]` or `[FromQuery]` parameters.
- Responses are plain DTOs (e.g., `CreateUserResponse`, `GetPFMCardsResponse`).
- The Core API uses a generic envelope: `CoreApiResponseBase<T>` with `Data` and `Status` (code, type, message).
- Swagger documentation uses custom attributes: `[ApiOperation]`, `[ApiSuccessResponse]`, `[ApiErrorResponse]`.

### Authentication & Authorization

- **IdentityServer** authentication registered via `services.AddIdentityServerAuthentication(configuration)`.
- Base controller is decorated with `[Authorize]`.
- Individual endpoints override with `[AllowAnonymous]` where inter-service communication doesn't require auth tokens.
- Data protection configured via `services.AddDataProtection(configuration)`.

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

Registered in `ApiExtensions.ConfigureAPI()` in this order:

```csharp
app.UsePathBase(pathBase);           // 1. Set path base (/coreapifacade)
app.UseLocalization();               // 2. Request culture/localization
app.UseHttpsRedirection();           // 3. HTTPS redirect
app.UseRouting();                    // 4. Routing
app.UseHttpMetrics();                // 5. Prometheus HTTP metrics
app.UseAuthentication();             // 6. IdentityServer authentication
app.UseAuthorization();              // 7. Authorization
app.UseMiddlewares(statusCodes);     // 8. Common middlewares (exception handling, correlation ID, logging, etc.)
app.UseHealthCheckMiddleware(env);   // 9. Health check endpoints
app.UseVersionEndpoint(configuration); // 10. Version endpoint
// Endpoints: MapControllers + MapMetrics
app.UseSwagger(env, provider, pathBase); // 11. Swagger UI
```

### MediatR Pipeline Behaviors

Registered in `ApplicationExtensions.AddApplication()` in this order:

| # | Behavior | Purpose |
|---|---|---|
| 1 | `LoggingBehavior<,>` | Logs request/response with sensitive data masking |
| 2 | `ValidationBehavior<,>` | Runs FluentValidation validators before the handler executes |

### Global Exception Handling

Handled by `app.UseMiddlewares()` from `Space.Service.Common.Middlewares 2.9.11`. This provides a global exception handler that catches exceptions and returns standardized error responses.

Handlers also throw `AppException` (from `Space.Service.Common.Exceptions`) for business rule violations, e.g.:

```csharp
if (response.Status.Code != 1)
{
    throw new AppException(response.Status.Message);
}
```

### Request Validation

- **FluentValidation** — validators are auto-registered via `services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly())`.
- Model state validation is **suppressed** at the controller level: `options.SuppressModelStateInvalidFilter = true`. This is because validation is handled by the `ValidationBehavior` in the MediatR pipeline instead.
- Validator display names use camelCase: `ValidatorOptions.Global.DisplayNameResolver = (type, member, expression) => member?.Name.ToCamelCase()`.
- Example validator (`FreezeCurrencyRateCommandValidator`):

```csharp
public class FreezeCurrencyRateCommandValidator : AbstractValidator<FreezeCurrencyRateCommand>
{
    public FreezeCurrencyRateCommandValidator()
    {
        RuleFor(i => i.CurrencyFrom).IsInEnum();
        RuleFor(i => i.CurrencyTo).IsInEnum();
        RuleFor(i => i.CurrencyFrom).NotEqual(i => i.CurrencyTo);
        RuleFor(i => i.BuyingRate).GreaterThan(0);
        RuleFor(i => i.SellingRate).GreaterThan(0);
    }
}
```

### Correlation ID / Request Tracing

Handled by `Space.Service.Common.Middlewares` (via `app.UseMiddlewares()`). Correlation ID propagation is built into the common middleware stack. `RequestMetadata` (from `Space.Service.Common.Misc`) is registered as scoped and carries per-request context including `CountryCode`, `UserId`, `CustomerId`, `TenantId`, etc.

---

## 6. Data Layer

**Not applicable.** This service has no database. Despite referencing `Microsoft.EntityFrameworkCore.Design 9.0.10` in the API project (for design-time tooling only — marked `PrivateAssets=all`), there is:

- No `DbContext` class
- No `Persistence` project
- No migrations
- No repositories
- No connection strings

All data operations are delegated to the downstream Core API via `ICoreApiClient`.

---

## 7. Messaging & Event Handling

### Architecture Test Support

The `ArchitectureTests` verify naming conventions for events:

```csharp
[Fact]
public void ConsumedEvents_ShouldHaveNameEndingWithCommand()
{
    // Types with [ConsumeEventAttribute] should end with "Command"
}

[Fact]
public void ProducedEvents_ShouldHaveNameEndingWithEvent()
{
    // Types with [ProduceEventAttribute] should end with "Event"
}
```

### Current State

The `Space.Service.Common.EventBus 2.9.35` package is referenced in the Application project, and the `CITools` project generates event schemas via `EventsSchemaGenerator`. However, **no concrete event producers or consumers are currently implemented** in the codebase — no classes are decorated with `[ProduceEvent]` or `[ConsumeEvent]` attributes.

The infrastructure is wired for event-driven communication (the Dockerfile copies Kafka CA certificates), but the facade itself currently operates in a pure request-response paradigm.

---

## 8. Background Jobs & Scheduled Tasks

**Not applicable.** No `IHostedService`, `BackgroundService`, `PeriodicBackgroundServiceBase`, `CronBackgroundServiceBase`, Hangfire, or Quartz implementations exist. The service processes only incoming HTTP requests.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

| Aspect | Implementation |
|---|---|
| Framework | **Serilog** — registered via `builder.Host.UseSerilog(builder.Services, builder.Configuration)` |
| Pipeline Logging | `LoggingBehavior<,>` in MediatR pipeline logs all requests/responses |
| Sensitive Data | `[SensitiveData]` attribute masks PII in logs (`*** HIDDEN ***`) |
| Test Correlation | `Serilog.Sinks.TestCorrelator 4.0.0` in unit tests |

Properties marked `[SensitiveData]` across the codebase:

- `CreateUserCommand`: `ClientId`, `ClientSecret`, `UserName`, `Password`
- `CreateTransferFavoriteCommand`: `Identifier`, `Name`, `CardHolderName`
- `CardInfo`: `CardNumber`, `ProcessingCenterCorrelationId`, `Mask`, `PhoneNumber`, `CardHolderName`
- `CoreApiClientOptions.Headers`: `Secret`
- `Status.Message` (in `CoreApiResponseBase`)

### Health Checks

Registered via `services.AddHealthChecks(configuration)` and exposed via `app.UseHealthCheckMiddleware(env)` (from `Space.Service.Common.HealthChecks 2.9.10`).

### Resilience Patterns

HTTP client resilience is handled by `Space.Service.Common.RestClient 2.9.23` which wraps RestEase with built-in retry, circuit breaker, and timeout policies. The `[ExternalApiClient]` attribute on `ICoreApiClient` signals this integration.

### Configuration Management

| Source | Usage |
|---|---|
| `appsettings.json` | Base configuration (copied from `/settings/appsettings.json` in deployed environments) |
| `globalsettings.json` | Shared/global config (from `/settings/globalsettings.json`) |
| `appsettings.Local.json` | Local dev overrides |
| User Secrets | Local development secrets (UserSecretsId: `3f45b935-83aa-40a9-bcd1-349713354ad4`) |
| Environment Variables | `ASPNETCORE_ENVIRONMENT`, `PATH_BASE`, `ASPNETCORE_HTTP_PORTS` |
| Options Pattern | `CoreApiClientOptions` bound from configuration |
| Configuration Watch | `builder.Configuration.Watch(settingsFilePaths)` for hot reload |

### Localization

Multi-language support via resource files:

- `SharedResources.en-US.resx` (English)
- `SharedResources.ka-GE.resx` (Georgian)
- `SharedResources.ru-RU.resx` (Russian)
- `SharedResources.uz-Latn-UZ.resx` (Uzbek Latin)

Registered via `services.AddLocalization()` and `app.UseLocalization()`.

### Kestrel Configuration

```csharp
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MinRequestBodyDataRate = new MinDataRate(
        bytesPerSecond: 50,
        gracePeriod: TimeSpan.FromSeconds(15));
});
```

Thread pool tuned with `ThreadPool.SetMinThreads(100, 100)`.

### Garbage Collection

`Directory.Build.props` configures server GC:

```xml
<ServerGarbageCollection>true</ServerGarbageCollection>
<GarbageCollectionAdaptationMode>1</GarbageCollectionAdaptationMode>
```

---

## 10. Testing

### Test Projects

| Project | Type | Framework |
|---|---|---|
| `Space.Service.CoreApiFacade.UnitTests` | Unit Tests | xUnit 2.9.3 |
| `Space.Service.CoreApiFacade.ComponentTests` | Component/Integration Tests | xUnit 2.9.3 + `WebApplicationFactory` |
| `Space.Service.CoreApiFacade.ArchitectureTests` | Architecture Fitness Tests | xUnit 2.9.3 + NetArchTest.Rules 1.3.2 |

### Testing Frameworks & Libraries

| Library | Version | Purpose |
|---|---|---|
| xUnit | 2.9.3 | Test framework |
| FluentAssertions | 7.2.0 | Assertion library |
| NSubstitute | 5.3.0 | Mocking |
| AutoFixture | 4.18.1 | Test data generation |
| WireMock.Net | 1.8.4 | HTTP mock server (component tests) |
| Microsoft.AspNetCore.Mvc.Testing | 9.0.10 | `WebApplicationFactory` |
| Microsoft.EntityFrameworkCore.InMemory | 9.0.10 | In-memory DB for test isolation |
| coverlet | 6.0.4 | Code coverage collection |
| Serilog.Sinks.TestCorrelator | 4.0.0 | Log assertion in unit tests |
| NetArchTest.Rules | 1.3.2 | Architecture rule enforcement |

### Test Coverage Structure

**Unit Tests** (`UnitTests/`):

- `Api/Controllers/` — Tests for every controller (7 test files), verifying MediatR dispatch.
- `Application/Features/` — Tests for command/query handlers organized by feature:
  - `User/` — `CreateUserCommandHandlerTests`
  - `Customer/` — `CreateCustomerCommandHandlerTests`, `SetTemporaryContractIdCommandHandlerTests`
  - `Transfer/` — Extensive: handlers + validators for Create, Update, Delete, Sync, UpdateImage
  - `Action/` — Create + Update handlers and validators
  - `Card/` — `GetPFMCardsQueryHandlerTests`, `GetCardsForTransactionsHistoryQueryHandlerTests`
  - `Common/` — `UploadFileCommandHandlerTests`
  - `Currency/` — `FreezeCurrencyRateCommandHandlerTests` + validator tests
  - `ProductOrder/` — Create, Get, Update handlers + validators
  - `Saving/` — `GetUserSavingsQueryHandlerTests`
  - `TaxCommittee/` — `CreateTaxCommitteeCommandHandlerTests`, `CreateTaxCommitteeNewCommandHandlerTests`

**Component Tests** (`ComponentTests/`):

- End-to-end HTTP tests for every controller using `CustomWebApplicationFactory<Program>` + WireMock.
- WireMock serves pre-recorded JSON responses from `Mocks/CoreApi/` directory.
- Authorization is bypassed via `TestAllowAnonymous` handler replacement.
- JSON mock files for ~15+ scenarios covering success and error paths.

**Architecture Tests** (`ArchitectureTests/`):

- Controllers must not depend on Infrastructure layer
- Controllers must depend on MediatR
- Controllers must inherit from `ApiControllerBase` and end with "Controller"
- Application must not depend on Infrastructure
- Requests must end with "Command" or "Query"
- Handlers must end with "CommandHandler" or "QueryHandler"
- Consumed events must end with "Command"
- Produced events must end with "Event"

### Notable Test Patterns

| Pattern | Implementation |
|---|---|
| **Shared Fixtures** | `SharedFixtureCollection` with `ICollectionFixture<MapperFixture>`, `ICollectionFixture<LocalizerFixture>` |
| **WireMock Fixture** | `WireMockServerFixture` starts WireMock on port 5980, shared across component tests |
| **WebApplicationFactory** | `CustomWebApplicationFactory<Program>` overrides auth to allow anonymous for testing |
| **AAA Pattern** | Explicit `// Arrange`, `// Act`, `// Assert` comments |
| **AutoFixture** | Test data generation for commands/queries |
| **JSON Mock Files** | Pre-recorded Core API responses in `Mocks/CoreApi/` |

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
ENTRYPOINT ["dotnet", "Space.Service.CoreApiFacade.Api.dll"]
```

**Notes:**
- **Single-stage** Dockerfile (build happens outside; pre-built artifacts are copied in).
- Base image: `mcr.microsoft.com/dotnet/aspnet:9.0` (runtime-only).
- Custom CA certificates installed for Core API and Kafka TLS connections.
- Listens on port 80.

### CI/CD Pipelines

All workflows are in `.github/workflows/` and delegate to **reusable workflows** in `SpaceBank/Space.Service.Workflows`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci-cd.yaml` | Push to `master` | Full CI/CD: build, test, Docker image, deploy to `dev-uz → prod-uz` |
| `cd.yaml` | Manual dispatch | Deploy to a specific environment |
| `pull-request.yaml` | PR opened | Build, test, Pact contract verification |
| `stryker.yaml` | Daily cron + manual | Mutation testing |
| `zaproxy.yaml` | Weekly (Sunday) + manual | OWASP ZAP security scanning |
| `update-packages.yaml` | Manual dispatch | Upgrade `Space.Service.Common.*` packages |
| `generate-readme.yaml` | Weekly (Saturday) + manual | Auto-generate README |
| `create-kibana-alert-rules.yaml` | Manual | Create Kibana monitoring alert rules |
| `notify.yaml` | Dispatched by other workflows | Slack notifications |
| `dora.yaml` | Dispatched by other workflows | DORA metrics tracking |
| `assign-copilot.yaml` | Issue opened/edited/labeled | Auto-assign GitHub Copilot to issues |
| `sync-copilot-configs.yaml` | Manual | Sync Copilot configuration files |

### Deployment Environments

```
dev-uz → automation-uz → qa-uz → preprod-uz → prod-uz
```

All environments are Uzbekistan-specific, consistent with the service's UZ country code handling.

### Contract Testing

Pact-based contract testing is enabled:
- `pact_publish_provider_contract: true`
- `pact_publish_consumer_contract: true`
- `pact_can_i_deploy_check: true`
- `pact_record_deployment: true`

### Tools Directory

| Tool | Purpose |
|---|---|
| `tools/localDevSetup.sh` | Pre-build setup: installs Trivy, copies git hooks |
| `tools/hooks/commit-msg` | Git commit message validation hook |
| `tools/codeCoverage/coverage-precommit.sh` | Pre-commit code coverage check (90% threshold) |
| `tools/stryker/` | Mutation testing scripts (`run-stryker.sh`, `run-stryker-full.sh`, `stryker-precommit.sh`) |
| `tools/trivy/` | Trivy secret scanning (`run-trivy-secret-scan.sh`, `secret-rules.yaml`) |
| `tools/sonarqube/` | SonarQube configuration |
| `tools/zap/` | OWASP ZAP configuration |

---

## 12. External Service Dependencies

### HTTP Clients

There is **one external HTTP client**: `ICoreApiClient`.

#### `ICoreApiClient` — Core Banking API

**Configuration:**
- Registered via `services.AddRestClient<ICoreApiClient>(configuration, "CoreApiClientOptions")` in `InfrastructureExtensions.cs`.
- Uses **RestEase** declarative HTTP client interface with `[ExternalApiClient]` attribute.
- Base URL configured via `CoreApiClientOptions` in appsettings.
- Custom headers (including a `Secret`) via `CoreApiClientOptions.Headers`.

**All Core API Endpoints Called:**

| Method | Core API Route | Purpose |
|---|---|---|
| `POST` | `api{countryCode}/v1/users/create/identityuser` | Create identity user |
| `GET` | `api{countryCode}/v1/users/getuser` | Get user by username |
| `POST` | `api{countryCode}/v1/users/check` | Check user existence |
| `GET` | `api{countryCode}/v1/transfer/standingorders/savings` | Get savings standing orders |
| `POST` | `api{countryCode}/v1/customers/create` | Create customer |
| `POST` | `api{countryCode}/v1/customers/settemporarycontractid` | Set temporary contract ID |
| `GET` | `api{countryCode}/v1/cards/pfm/cards` | Get PFM cards |
| `GET` | `api{countryCode}/v1/cards/cardsForTransactionsHistory` | Get cards for transaction history |
| `GET` | `/api/uz/v1/cards/productorderinfo` | Get product order info |
| `POST` | `/api/uz/v1/cards/customer/products/orderinfo` | Create product order |
| `PATCH` | `/api/uz/v1/cards/productorderinfo` | Update product order status |
| `POST` | `api{countryCode}/v1/currencies/freeze` | Freeze currency rate |
| `POST` | `api{countryCode}/v1/transfer/sync/precalculations` | Create transfer pre-calculated data |
| `PUT` | `api{countryCode}/v1/transfer/precalculations/userinput` | Update transfer user input |
| `PUT` | `api{countryCode}/v1/transfer/sync/precalculations/data` | Sync transfer pre-calculated data |
| `POST` | `api{countryCode}/v1/actions/create` | Create action |
| `POST` | `api{countryCode}/v1/actions/update` | Update action |
| `POST` | `api{countryCode}/v1/common/upload` | Upload file |
| `POST` | `api{countryCode}/v1/taxcommitee` | Create tax receipt (legacy) |
| `POST` | `api{countryCode}/v1/taxcommitee/new` | Create tax receipt (new) |
| `POST` | `api{countryCode}/v1/transfer/sync/favorite` | Create transfer favorite |
| `DELETE` | `api{countryCode}/v1/transfer/sync/favorite` | Delete transfer favorite |
| `PUT` | `api{countryCode}/v1/transfer/sync/favorite` | Update transfer favorite |
| `PATCH` | `api{countryCode}/v1/transfer/sync/favorite/image` | Update transfer favorite image |

**Resilience:** Handled by `Space.Service.Common.RestClient` which provides built-in retry, circuit breaker, and timeout policies via the `[ExternalApiClient]` marker.

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Summary Table

| Pattern | Where It's Used | Why |
|---|---|---|
| **Clean Architecture** | Solution-level project structure | Enforce separation of concerns; keep Application independent of infrastructure details |
| **CQRS** | `Application/Features/*/Commands/` and `Queries/` | Break operations into focused, single-responsibility handlers |
| **MediatR** | All controllers dispatch via `IMediator` | Decouple controllers from handler implementations; enable pipeline behaviors |
| **Facade Pattern** | Entire service | Abstract Core Banking API complexity from consuming services |
| **RestEase Typed Clients** | `ICoreApiClient` | Declarative, strongly-typed HTTP client interface |
| **Pipeline Behaviors** | `LoggingBehavior`, `ValidationBehavior` | Cross-cutting concerns applied uniformly to all requests |
| **FluentValidation** | Per-command validators (e.g., `FreezeCurrencyRateCommandValidator`) | Rich, testable validation rules separate from handler logic |
| **Options Pattern** | `CoreApiClientOptions` | Type-safe, bindable configuration |
| **Sensitive Data Masking** | `[SensitiveData]` attribute on DTOs | Prevent PII leakage to logs |
| **Architecture Tests** | `ArchitectureTests` project with NetArchTest | Automated enforcement of dependency rules and naming conventions |
| **WireMock** | Component tests | HTTP-level mocking of the Core API for realistic integration tests |
| **Contract Testing** | Pact in CI/CD | Verify provider/consumer compatibility before deployment |
| **Mutation Testing** | Stryker (daily scheduled) | Measure test effectiveness beyond code coverage |

### Notable Deviations from Conventions

| Observation | Details |
|---|---|
| **No Domain/Persistence layers** | Expected for a facade; all state lives in Core API |
| **Hardcoded country code** | `ToPathParam()` always returns `"/uz"` regardless of input — all routes are Uzbekistan-specific |
| **Some ProductOrder routes are hardcoded** | `[Get("/api/uz/v1/cards/productorderinfo")]` uses hardcoded `/api/uz/` instead of the `{countryCode}` pattern used elsewhere |
| **Mixed auth strategy** | Many endpoints are `[AllowAnonymous]` despite the base controller being `[Authorize]` — suggests these are called by trusted internal services |
| **`Command` used for reads** | `CheckUserCommand` is a POST that reads data — named "Command" but functionally a query |
| **Spelling inconsistency** | `TaxCommitee` vs `TaxCommittee` (double-t) — present in folder names, class names, and response types |

### Technical Debt & Improvement Opportunities

| Item | Description |
|---|---|
| **Hardcoded `/uz` path** | `ToPathParam()` ignores the input country code, making multi-country support impossible without code changes |
| **Hardcoded ProductOrder routes** | Three `ICoreApiClient` methods use `/api/uz/v1/cards/...` instead of parametric `{countryCode}` |
| **No response caching** | Despite having caching packages referenced, no caching is applied to any query handlers |
| **Manual DTO mapping in handlers** | Some handlers (e.g., `GetPFMCardsQueryHandler`) manually map properties instead of using AutoMapper profiles |
| **Missing validators** | Several commands lack validators (e.g., `CreateUserCommand`, `CreateCustomerCommand`, `CreateActionCommand`) |
| **`ValidateScopes = false`** | Service provider scope validation is disabled to work around MediatR DI issues |
| **Spelling inconsistencies** | `TaxCommitee`/`TaxCommittee`, `Favourite`/`Favorite` — mixed throughout the codebase |
| **Unused EventBus** | `Space.Service.Common.EventBus` is referenced and architecture tests are ready, but no events are published or consumed |
| **EF Core Design package** | Referenced in Api project despite no database — likely a leftover from a template |
