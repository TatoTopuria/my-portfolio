# SERVICE_ANALYSIS.md — Space.Service.Template.MicroService

> **Generated:** 2026-04-02  
> **Repository:** `Space.Service.Template.MicroService`  
> **Type:** Cookiecutter template for .NET microservices at SpaceBank

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

This is **not** a running microservice itself — it is a **Cookiecutter project template** used to scaffold new .NET microservices within the **SpaceBank** organization. When a team creates a new repository from this template and configures `cookiecutter.json`, the scaffolding process generates a fully wired, production-ready microservice skeleton.

The template variables are defined in [`cookiecutter.json`](cookiecutter.json):

```json
{
  "Namespace": "Space.Service",
  "ProjectName": "[[Write project name here]]",
  "GitHubTeamId": "[[Write your GitHub team Id here]]",
  "JiraOperationsTeamId": "[[Write your Jira Operations team Id here]]",
  "JiraAssetsTeamId": "[[Write your Jira Assets team Id here]]"
}
```

The hook script [`hooks/pre_gen_project.py`](hooks/pre_gen_project.py) performs search-and-replace across Helm values, ArgoCD configs, GitHub workflows, and CODEOWNERS with template variables like `[[Namespace]]`, `[[ProjectName]]`, etc.

### Domain Context

As a template, this repository defines no specific bounded context. The generated service is a **blank-slate microservice** intended to own a single bounded context within SpaceBank's microservices ecosystem. The folder structure and guidelines encourage each generated service to model its own domain entities, enums, constants, and exceptions.

### Key Entities & Domain Models

The template contains **no concrete entities** — all domain folders (`Domain/Entities/`, `Domain/Enums/`, `Domain/Constants/`, `Domain/Exceptions/`) contain only `.gitkeep` placeholders. Entities are expected to derive from base classes provided by `Space.Service.Common.Persistence`:

- `EntityBase<TEntityId>` — standard entity with tracked audit fields
- `SoftDeletedEntityBase<TEntityId>` — adds soft-delete support
- `SequentialEntityBase` — uses sequential GUIDs for primary keys

### Main Use Cases & Workflows

The template provides the **scaffolding** for:

- CRUD operations routed through controller → MediatR → command/query handler → repository → database
- Event-driven communication via Kafka (event bus)
- External service integration via RestEase HTTP clients
- Background job execution via periodic/cron-based workers
- Localized error responses (en-US, ru-RU, uz-Latn-UZ resource files)

---

## 2. Architecture

### Architectural Pattern: Clean Architecture + CQRS

The service follows **Clean Architecture** (also known as Onion Architecture) combined with **CQRS** (Command Query Responsibility Segregation) via MediatR. This is evidenced by the strict layer separation and enforced dependency rules.

**Justification from code:**

The architecture tests in [`ArchitectureTests.cs`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.ArchitectureTests/ArchitectureTests.cs) explicitly enforce:

```csharp
[Fact]
public void Domain_ShouldNotDependOnAnyLayer()
{
    TestResult result = ShouldNotDependOn(domainLayer, persistenceLayer,
        infrastructureLayer, apiLayer, applicationLayer);
    Assert.True(result.IsSuccessful, result.GetFailingTypeNames());
}

[Fact]
public void Application_ShouldNotDependOnPersistence()
{
    TestResult result = ShouldNotDependOn(applicationLayer, persistenceLayer);
    Assert.True(result.IsSuccessful, result.GetFailingTypeNames());
}

[Fact]
public void Controllers_ShouldNotDependOnPersistence()
{
    TestResult result = ShouldNotDependOn(controllersNamespace, persistenceLayer);
    Assert.True(result.IsSuccessful, result.GetFailingTypeNames());
}
```

CQRS naming enforcement:

```csharp
[Fact]
public void Requests_ShouldHaveNameEndingWithCommandOrQuery() { ... }

[Fact]
public void RequestHandlers_ShouldHaveNameEndingWithCommandHandlerOrQueryHandler() { ... }
```

### Project Structure Breakdown

| Project | Responsibility |
|---------|---------------|
| **`*.Api`** | ASP.NET Core web host. Controllers, middleware pipeline, Swagger, auth, health checks. Entry point (`Program.cs`). |
| **`*.Application`** | Business logic layer. MediatR handlers (commands/queries), repository interfaces, DTOs, validators (FluentValidation), mapping profiles, localization resources. |
| **`*.Domain`** | Core domain. Entities, enums, constants, custom exceptions. Zero dependencies on other layers. |
| **`*.Infrastructure`** | Integration layer. External HTTP clients (RestEase), background workers, event bus setup, memory cache. |
| **`*.Persistence`** | Data access. EF Core `DbContext`, entity configurations, repository implementations, migrations, seeding. |
| **`*.ArchitectureTests`** | NetArchTest-based tests enforcing dependency rules and naming conventions. |
| **`*.ComponentTests`** | Integration/component tests using `WebApplicationFactory`, Testcontainers (PostgreSQL), WireMock, and in-memory DB. |
| **`*.UnitTests`** | Unit tests with NSubstitute mocks, AutoFixture, FluentAssertions. Fixtures for in-memory DB, PostgreSQL containers, AutoMapper, and localizer. |
| **`*.CITools`** | CLI utility for generating event schemas and API contracts for CI pipelines. |

### Dependency Flow Direction

```
Api ──→ Application ──→ Domain ←── (no outgoing deps)
 │           ↑
 ├──→ Infrastructure ──→ Application
 │           │              ↑
 └──→ Persistence ─────────┘
```

- **Domain** has **zero** project references — it only uses `Space.Service.Common.Persistence`, `Common.Logging`, `Common.Misc`, and `Common.Exceptions` NuGet packages.
- **Application** references only **Domain**.
- **Persistence** references **Application** (to implement repository interfaces).
- **Infrastructure** references **Application** and **Persistence** (for `DbContext` used in event bus setup).
- **Api** references **Application**, **Infrastructure**, and **Persistence** (composition root).

### CQRS Implementation

- **Commands** and **Queries** implement `IRequest<TResponse>` (MediatR).
- **Handlers** inherit from `RequestHandlerBase<TRequest, TResponse>` (from `Space.Service.Common.Mediator`).
- Commands represent state-changing operations; Queries represent read operations.
- Handlers are organized under `Application/Features/{FeatureName}/Commands/` and `Application/Features/{FeatureName}/Queries/`.
- MediatR is registered in [`ApplicationExtensions.cs`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Application/ApplicationExtensions.cs):

```csharp
services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
    cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
});
```

### DDD Patterns

- **Entities**: Expected to reside in `Domain/Entities/`, deriving from `EntityBase<TEntityId>` (includes `ITrackedEntity` for audit trails).
- **Repository pattern**: Interfaces in `Application/Repositories/`, implementations in `Persistence/Repositories/`.
- **Value Objects / Aggregates / Domain Events**: Not explicitly present in the template skeleton, but the structure supports them.

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Aspect | Value |
|--------|-------|
| **Runtime** | .NET 9.0 |
| **Language** | C# (latest features, per style guide) |
| **Nullable reference types** | Enabled globally via [`Directory.Build.props`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/Directory.Build.props) |
| **GC mode** | Server GC with `GarbageCollectionAdaptationMode=1` (DATAS) |

### NuGet Packages & Their Roles

#### Application Layer

| Package | Version | Role |
|---------|---------|------|
| `Space.Service.Common.Mediator` | 2.9.9 | MediatR-based CQRS with `RequestHandlerBase`, `LoggingBehavior`, `ValidationBehavior` |
| `Space.Service.Common.Mapping` | 2.9.2 | AutoMapper configuration and registration |
| `Space.Service.Common.Caching` | 2.9.16 | `ISuperCache` abstraction for caching |
| `Space.Service.Common.RestClient` | 2.9.24 | RestEase-based typed HTTP client infrastructure |
| `Space.Service.Common.EventBus` | 2.9.37 | Kafka-based event bus for producing/consuming events |
| `Space.Service.Common.Factory` | 2.9.10 | Tenant-specific service factory pattern |
| `FluentValidation` | (transitive) | Request validation in MediatR pipeline |

#### Domain Layer

| Package | Version | Role |
|---------|---------|------|
| `Space.Service.Common.Persistence` | 2.9.15 | `EntityBase<T>`, `IEntityBase<T>`, `ITrackedEntity`, `SoftDeletedEntityBase`, `SequentialEntityBase` |
| `Space.Service.Common.Logging` | 2.9.10 | Serilog integration, `[SensitiveData]` attribute, structured logging |
| `Space.Service.Common.Misc` | 2.9.71 | Utility extensions (`ToCamelCase`, `IsLocal()`, `ValidateServiceLifetimes`, etc.) |
| `Space.Service.Common.Exceptions` | 2.9.10 | Custom exception types (`EnsureNotNull`, etc.) |

#### API Layer

| Package | Version | Role |
|---------|---------|------|
| `Space.Service.Common.Auth` | 2.9.10 | IdentityServer authentication (`AddIdentityServerAuthentication`) |
| `Space.Service.Common.HealthChecks` | 2.9.11 | Startup/liveness/readiness health check endpoints |
| `Space.Service.Common.Middlewares` | 2.9.13 | Custom middleware pipeline (`UseMiddlewares`) |
| `Space.Service.Common.Swagger` | 2.9.14 | Swagger/OpenAPI documentation with versioning |
| `Asp.Versioning.ApiExplorer` | (transitive) | API versioning support |
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus metrics endpoint (`/metrics`) |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |
| `Space.Service.Common.CodeAnalyzers` | 2.9.6 | Custom Roslyn analyzers |

#### Infrastructure Layer

| Package | Version | Role |
|---------|---------|------|
| `Microsoft.Extensions.Caching.Memory` | 9.0.10 | In-memory caching |

#### Persistence Layer

| Package | Version | Role |
|---------|---------|------|
| `Microsoft.EntityFrameworkCore.Relational` | 9.0.10 | EF Core relational provider |
| `Microsoft.EntityFrameworkCore.Tools` | 9.0.10 | EF Core CLI migration tools |
| `Microsoft.EntityFrameworkCore.Design` | 9.0.10 | Design-time EF Core support (in Api project) |

### Database

| Aspect | Value |
|--------|-------|
| **Database** | PostgreSQL |
| **ORM** | Entity Framework Core 9.0.10 |
| **Provider** | Npgsql (via `UseNpgsql`) |

### Caching

- **In-memory cache**: `Microsoft.Extensions.Caching.Memory` registered in `InfrastructureExtensions.cs`
- **`ISuperCache`**: Abstraction from `Space.Service.Common.Caching` (mocked in component tests)

### Logging & Observability

| Tool | Purpose |
|------|---------|
| **Serilog** | Structured logging via `UseSerilog()` in `Program.cs` |
| **Prometheus** | Metrics export via `prometheus-net.AspNetCore` (`UseHttpMetrics`, `MapMetrics`) |
| **`[SensitiveData]` attribute** | PII masking in log serialization |
| **Kibana** | Alert rules created via `create-kibana-alert-rules.yaml` workflow |

---

## 4. API Layer & Communication

### API Style

**REST** — all endpoints are served via ASP.NET Core MVC controllers, as configured by `services.AddControllers()` in [`ApiExtensions.cs`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Api/ApiExtensions.cs).

### Exposed Endpoints

The template contains **no concrete controller implementations** — only the base class [`ApiControllerBase`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Api/Controllers/ApiControllerBase.cs). Concrete controllers are added when building a specific service.

```csharp
[Authorize]
[ApiController]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    protected readonly IMediator mediator;

    protected ApiControllerBase(IMediator mediator)
    {
        this.mediator = mediator;
    }

    protected ObjectResult OkResult(object value) => new(value) { StatusCode = 200 };
    protected ObjectResult CreatedResult(object value) => new(value) { StatusCode = 201 };
}
```

**Key points:**
- All controllers **must** inherit from `ApiControllerBase` (enforced by architecture tests).
- Controllers are `[Authorize]` by default.
- Controllers delegate all logic to MediatR — they never call repositories or DbContext directly.
- Responses are JSON (`application/json`).

### Built-in System Endpoints

| Endpoint Pattern | Purpose |
|-----------------|---------|
| `/health/startup` | Startup probe |
| `/health/liveness` | Liveness probe |
| `/health/readiness` | Readiness probe |
| `/metrics` | Prometheus metrics |
| `/swagger` | Swagger UI |
| Event bus endpoints | Event consumption endpoints via `UseEventEndpoints()` |
| Version endpoint | Service version via `UseVersionEndpoint()` |

### Request/Response Patterns

- DTOs are created per-feature under `Application/Features/{Feature}/Models/` or `Application/Features/{Feature}/Dtos/`.
- AutoMapper (`Space.Service.Common.Mapping`) is used for entity ↔ DTO mapping.
- Controllers return DTOs — **never** domain entities (enforced by convention and architecture tests).

### API Versioning

API versioning is configured via `services.AddVersioning()` (from `Space.Service.Common.Swagger`) and `IApiVersionDescriptionProvider` is injected in `Program.cs` for Swagger documentation per version.

### Authentication & Authorization

- **IdentityServer** authentication via `services.AddIdentityServerAuthentication(configuration)` (from `Space.Service.Common.Auth`).
- All controllers are `[Authorize]` by default.
- Data protection configured via `services.AddDataProtection(configuration)`.
- In component tests, authorization is bypassed using `AnonymousAuthorizationHandler`:

```csharp
public class AnonymousAuthorizationHandler : IAuthorizationHandler
{
    public Task HandleAsync(AuthorizationHandlerContext context)
    {
        foreach (IAuthorizationRequirement requirement in context.PendingRequirements.ToList())
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
```

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

Configured in [`ApiExtensions.ConfigureAPI()`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Api/ApiExtensions.cs), the middleware pipeline executes in this order:

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `UsePathBase(pathBase)` | Sets base path from `PATH_BASE` env var (e.g., `/projectname`) |
| 2 | `UseLocalization()` | Request culture/language resolution |
| 3 | `UseHttpsRedirection()` | Redirects HTTP to HTTPS |
| 4 | `UseStaticFiles()` | Serves static files (Swagger UI CSS) |
| 5 | `UseRouting()` | Endpoint routing |
| 6 | `UseHttpMetrics()` | Prometheus HTTP request metrics collection |
| 7 | `UseAuthentication()` | IdentityServer JWT validation |
| 8 | `UseAuthorization()` | Policy-based authorization |
| 9 | `UseMiddlewares()` | Custom middlewares from `Space.Service.Common.Middlewares` (exception handling, correlation ID, request logging, etc.) |
| 10 | `UseHealthCheckMiddleware(env)` | Health check endpoints |
| 11 | `UseEventEndpoints()` | Event bus consumer endpoints |
| 12 | `UseVersionEndpoint(configuration)` | Version info endpoint |
| 13 | `MapControllers()` | Controller endpoint mapping |
| 14 | `MapMetrics()` | Prometheus `/metrics` endpoint |
| 15 | `UseSwagger(env, provider, pathBase)` | Swagger UI |

### MediatR Pipeline Behaviors

Registered in [`ApplicationExtensions.cs`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Application/ApplicationExtensions.cs) in execution order:

| Order | Behavior | Purpose |
|-------|----------|---------|
| 1 | `LoggingBehavior<,>` | Logs request entry/exit with structured data and timing |
| 2 | `ValidationBehavior<,>` | Runs FluentValidation validators before handler execution |

### Global Exception Handling

Handled by `Space.Service.Common.Middlewares` via `UseMiddlewares()`. The common library provides centralized exception-to-HTTP-response mapping.

### Request Validation

- **FluentValidation** — validators are auto-discovered from the Application assembly:

```csharp
services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
ValidatorOptions.Global.DisplayNameResolver = (type, member, expression) => member?.Name.ToCamelCase();
```

- Model state validation is **suppressed** at the MVC level (`SuppressModelStateInvalidFilter = true`) — validation is handled exclusively by the MediatR `ValidationBehavior`.

### Correlation ID / Request Tracing

Propagated via `Space.Service.Common.Middlewares` and `Space.Service.Common.Misc.RequestMetadata` (registered as scoped in `ApplicationExtensions.cs`).

---

## 6. Data Layer

### Database Type & Provider

| Aspect | Value |
|--------|-------|
| **Database** | PostgreSQL |
| **EF Core Provider** | Npgsql |
| **Connection string key** | `ConnectionStrings:NpgSql` |

### ORM Configuration

The DbContext is [`{{cookiecutter.ProjectName}}DbContext`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Persistence/{{cookiecutter.ProjectName}}DbContext.cs), inheriting from `DbContextBase` (from `Space.Service.Common.Persistence`):

```csharp
public class {{cookiecutter.ProjectName}}DbContext : DbContextBase
{
    public {{cookiecutter.ProjectName}}DbContext(DbContextOptions<{{cookiecutter.ProjectName}}DbContext> options)
        : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
```

- Entity configurations are auto-discovered from the Persistence assembly via `ApplyConfigurationsFromAssembly`.
- `DbContextBase` likely provides common conventions (audit fields, soft-delete, etc.).

### Migration Strategy

**Dual approach:**

1. **EF Core Migrations** — standard code-first migrations with `MigrationsAssembly` pointing to the Persistence project.
2. **Manual SQL scripts** — a `scripts/` folder contains a [`template.sql`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/scripts/template.sql) with a custom `__MigrationsHistory` table and transaction-wrapped scripts. Environment-specific folders exist under `scripts/tbc_uz/{dev,automation,qa,preprod,prod}/`.

On startup, [`PersistenceExtensions.ConfigurePersistence()`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Persistence/PersistenceExtensions.cs) runs:

```csharp
db.Database.Create().Wait();
db.Database.Migrate();
db.Seed().Wait();
```

### Repository Pattern

**Interface-implementation split:**

- **Interfaces** in `Application/Repositories/` — e.g., [`IRepositoryBase<TEntity, TEntityId>`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Application/Repositories/IRepositoryBase.cs)
- **Implementations** in `Persistence/Repositories/` — e.g., [`RepositoryBase<TEntity, TEntityId>`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Persistence/Repositories/RepositoryBase.cs)

The base repository provides:

| Method | Behavior |
|--------|----------|
| `GetAll(asNoTracking)` | Returns all entities, optionally with no-tracking |
| `GetById(id, asNoTracking, ensureNotNull)` | Single entity lookup with optional null guard |
| `Add(entity)` | Adds and saves, returns entity ID |
| `Update(entity, beginTracking)` | Optionally attaches for disconnected scenarios, then saves |
| `Delete(id)` | Find, null-check, remove, and save |

### Unit of Work

Registered via `services.AddUnitOfWork(typeof({{cookiecutter.ProjectName}}DbContext))` from `Space.Service.Common.Persistence`. Used for transactions spanning multiple repositories or combined DB writes with event publishing.

### Read/Write Separation

Not explicitly separated at the database level. The `asNoTracking` parameter on read operations serves as a lightweight optimization.

---

## 7. Messaging & Event Handling

### Message Broker

**Apache Kafka** — configured via `Space.Service.Common.EventBus` package (version 2.9.37).

Registered in [`InfrastructureExtensions.cs`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Infrastructure/InfrastructureExtensions.cs):

```csharp
services.AddEventBus(configuration, typeof({{cookiecutter.ProjectName}}DbContext));
```

The `DbContext` type is passed for outbox pattern support.

Kafka CA certificates are deployed via Kubernetes secrets (mounted at `/settings/ssl/`) and installed in the Docker image:

```dockerfile
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt
```

### Published & Consumed Events

The template contains **no concrete events**. Architecture tests enforce naming conventions:

- **Consumed events**: Must end with `Command` or `Event` and be decorated with `[ConsumeEventAttribute]`
- **Produced events**: Must end with `Event` or `Command` and be decorated with `[ProduceEventAttribute]`

### Event Schema Generation

The [`CITools/Program.cs`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.CITools/Program.cs) utility generates event schemas for CI:

```csharp
case "generate-events-schema":
    EventsSchemaGenerator.GenerateEventSchemaJson(projects, serviceName);
    break;
case "generate-contracts":
    await ContractsGenerator.GenerateContractsAsync(projects, serviceName);
    break;
```

### Event Handling Patterns

- **Outbox pattern**: Supported via `AddEventBus(configuration, typeof(DbContext))` — the DbContext reference enables transactional outbox.
- **Event endpoints**: Exposed via `app.UseEventEndpoints()` in the HTTP pipeline.
- Swagger hides event-related endpoints with custom CSS in [`wwwroot/swagger-ui/events.css`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Api/wwwroot/swagger-ui/events.css).

---

## 8. Background Jobs & Scheduled Tasks

### Worker Infrastructure

The `Infrastructure/Workers/` folder exists with a `.gitkeep` placeholder. Per the project instructions, workers derive from classes provided by `Space.Service.Common.Workers`:

| Base Class | Trigger |
|-----------|---------|
| `PeriodicBackgroundServiceBase` | Periodic interval-based execution |
| `CronBackgroundServiceBase` | Cron expression-based scheduling |

No concrete workers are defined in the template.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Serilog** with structured logging, configured in `Program.cs` via `UseSerilog(builder.Services, builder.Configuration)`.
- **Sensitive data protection**: The `[SensitiveData]` attribute (from `Space.Service.Common.Logging`) masks PII in log output via `SensitiveDataUtils.SerializeSensitiveData()`.
- **MediatR LoggingBehavior**: Automatically logs request entry/exit for all handlers.
- Unit tests include `Serilog.Sinks.TestCorrelator` (v4.0.0) for log assertion.

### Health Checks

Three separate health check endpoints configured via `Space.Service.Common.HealthChecks`:

| Probe | Path | Purpose |
|-------|------|---------|
| **Startup** | `/health/startup` | Initial readiness after boot (K8s `startupProbe`) |
| **Liveness** | `/health/liveness` | Ongoing process health (K8s `livenessProbe`) |
| **Readiness** | `/health/readiness` | Ready to accept traffic (K8s `readinessProbe`) |

Kubernetes probe configuration from Helm values (e.g., `dev-uz.yaml`):

```yaml
startupProbe:
  httpGet:
    path: /[[ProjectNameLower]]/health/startup
    port: http
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 5
livenessProbe:
  httpGet:
    path: /[[ProjectNameLower]]/health/liveness
    port: http
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /[[ProjectNameLower]]/health/readiness
    port: http
  initialDelaySeconds: 10
  periodSeconds: 3
  failureThreshold: 2
```

### Rate Limiting / Throttling

Not explicitly configured in the template. Can be added via middleware.

### Resilience Patterns

- **Kestrel rate limiting**: `MinRequestBodyDataRate` is configured:

```csharp
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MinRequestBodyDataRate = new MinDataRate(
        bytesPerSecond: 50, gracePeriod: TimeSpan.FromSeconds(15));
});
```

- **Connection resilience**: `Space.Service.Common.RestClient` (RestEase-based) likely includes Polly-based resilience policies for HTTP clients.

### Configuration Management

| Source | Environment | Purpose |
|--------|-------------|---------|
| `appsettings.Local.json` | Local development | Developer overrides |
| `/settings/globalsettings.json` | All deployed environments | Organization-wide settings (from Vault) |
| `/settings/appsettings.json` | All deployed environments | Service-specific settings (from Vault) |
| `/settings/dbsettings.json` | All deployed environments | Database connection strings (from Vault) |
| `ASPNETCORE_ENVIRONMENT` | All | Environment discriminator (`Local`, `Development`, `Automation`, `QA`, `PreProd`, `Production`) |
| `PATH_BASE` | All | URL path base for reverse proxy routing |
| `GRACEFULSHUTDOWNTIMEOUTSECONDS` | Deployed | Graceful shutdown timeout (60s) |
| `SHUTDOWNTIMEOUTSECONDS` | Deployed | Hard shutdown timeout (120s) |

Settings are loaded from Vault via Kubernetes volume mounts:

```yaml
vault:
  enabled: true
  volumePath: "/settings"
  secrets:
    - name: "kv/GlobalSecrets"
      mountFileName: "globalsettings.json"
    - name: "kv/ServiceSecrets/[[NamespaceProjectNameLower]]"
      mountFileName: "appsettings.json"
    - name: "kv/DatabaseSecrets/[[NamespaceProjectNameLower]]"
      mountFileName: "dbsettings.json"
```

File change monitoring is enabled for non-local environments:

```csharp
builder.Configuration.Watch(settingsFilePaths);
```

### Encryption

Encryption support registered via `services.AddEncryption(configuration)` in `ApplicationExtensions.cs`.

---

## 10. Testing

### Test Projects

| Project | Type | Purpose |
|---------|------|---------|
| `*.ArchitectureTests` | Architecture | Enforces layer dependency rules, naming conventions, and `[ExcludeFromCodeCoverage]` prohibitions |
| `*.UnitTests` | Unit | Tests individual handlers, services, repositories with mocked dependencies |
| `*.ComponentTests` | Integration/Component | Full HTTP pipeline tests via `WebApplicationFactory`, testing controller → handler → DB |

### Frameworks & Libraries

| Package | Version | Role |
|---------|---------|------|
| **xUnit** | 2.9.3 | Test framework |
| **FluentAssertions** | 7.2.0 | Readable assertion syntax |
| **NSubstitute** | 5.3.0 | Mocking framework |
| **AutoFixture** | 4.18.1 | Test data generation |
| **NetArchTest.Rules** | 1.3.2 | Architecture constraint verification |
| **Testcontainers.PostgreSql** | 4.8.1 | Real PostgreSQL in Docker for integration tests |
| **WireMock.Net** | 1.8.4 | HTTP service mocking |
| **Microsoft.AspNetCore.Mvc.Testing** | 9.0.10 | `WebApplicationFactory` for in-process API testing |
| **Microsoft.EntityFrameworkCore.InMemory** | 9.0.10 | In-memory database for fast unit tests |
| **Serilog.Sinks.TestCorrelator** | 4.0.0 | Log assertion in tests |
| **coverlet.collector/msbuild** | 6.0.4 | Code coverage collection |
| **GitHubActionsTestLogger** | 2.4.1 | Test result formatting for GitHub Actions |
| **XunitXml.TestLogger** | 6.1.0 | XML test result output |

### Mocking Strategy

- **NSubstitute** is the primary mocking library.
- In component tests, `IEventBus` and `ISuperCache` are mocked:

```csharp
IEventBus eventBus = Substitute.For<IEventBus>();
services.AddScoped(_ => eventBus);

ISuperCache superCache = Substitute.For<ISuperCache>();
services.AddScoped(_ => superCache);
```

### Test Fixtures

| Fixture | Location | Purpose |
|---------|----------|---------|
| `InMemoryDbContextFixture` | UnitTests/Fixtures | Creates EF Core in-memory DB with seeding |
| `PostgresContextFixture` | UnitTests/Fixtures | Spins up real PostgreSQL via Testcontainers |
| `MapperFixture` | UnitTests/Fixtures | Provides configured `IMapper` instance |
| `LocalizerFixture` | UnitTests/Fixtures | Provides `IStringLocalizer<SharedResources>` |
| `SharedFixtureCollection` | UnitTests/Fixtures | xUnit collection fixture combining all above |
| `CustomWebApplicationFactory<Program>` | ComponentTests | Full API host with in-memory DB, mocked auth, mocked event bus |
| `PostgresDbContextFixture` | ComponentTests/Fixtures | Testcontainers PostgreSQL for component tests |
| `WireMockServerFixture` | ComponentTests/Fixtures | WireMock HTTP server on port 5980 |

### Code Coverage Enforcement

- **90% minimum threshold** enforced at commit time via `tools/codeCoverage/coverage-precommit.sh`.
- Coverage combines line coverage + branch coverage.
- Uses `coverlet` for collection and `reportgenerator` for reports.
- Exclusions: Migrations, Connected Services, `[GeneratedCode]` attributed code.

---

## 11. DevOps & Deployment

### Dockerfile Analysis

[`Dockerfile`]({{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}/{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Api/Dockerfile):

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt
COPY ./ca_cert_es.pem /usr/local/share/ca-certificates/ca_cert_es.crt
RUN update-ca-certificates --verbose
COPY app/publish  .
ENV ASPNETCORE_HTTP_PORTS=80
ENTRYPOINT ["dotnet", "{{cookiecutter.Namespace}}.{{cookiecutter.ProjectName}}.Api.dll"]
```

| Aspect | Detail |
|--------|--------|
| **Base image** | `mcr.microsoft.com/dotnet/aspnet:9.0` (runtime-only, no SDK) |
| **Multi-stage** | No — build happens externally in CI; only pre-published artifacts are copied |
| **CA certificates** | Three custom certs installed: general, Kafka, Elasticsearch |
| **Port** | 80 (HTTP) |
| **Entry point** | Direct `dotnet` execution of the published DLL |

### CI/CD Pipeline

All workflows delegate to shared reusable workflows in `SpaceBank/Space.Service.Workflows`.

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [`ci-cd.yaml`](github_configs/workflows/ci-cd.yaml) | Push to `master` | Full CI/CD: build, test, Docker image, deploy to all environments. Includes Pact contract testing. |
| [`pull-request.yaml`](github_configs/workflows/pull-request.yaml) | Pull request | Build + test + Pact contract verification |
| [`cd.yaml`](github_configs/workflows/cd.yaml) | Manual dispatch | Deploy a specific version to a chosen environment |
| [`stryker.yaml`](github_configs/workflows/stryker.yaml) | Scheduled (daily) + manual | Mutation testing via Stryker |
| [`zaproxy.yaml`](github_configs/workflows/zaproxy.yaml) | Scheduled (weekly) + manual | OWASP ZAP security scanning |
| [`generate-readme.yaml`](github_configs/workflows/generate-readme.yaml) | Scheduled (weekly) + manual | Auto-generate README documentation |
| [`update-packages.yaml`](github_configs/workflows/update-packages.yaml) | Manual dispatch | Upgrade `Space.Service.Common.*` NuGet packages |
| [`create-kibana-alert-rules.yaml`](github_configs/workflows/create-kibana-alert-rules.yaml) | Manual dispatch | Create monitoring alerts in Kibana |
| [`notify.yaml`](github_configs/workflows/notify.yaml) | Called by other workflows | Slack notification for deployment results |
| [`dora.yaml`](github_configs/workflows/dora.yaml) | Called by other workflows | DORA metrics tracking |
| [`assign-copilot.yaml`](github_configs/workflows/assign-copilot.yaml) | Issue opened/edited/labeled | Auto-assign GitHub Copilot to issues |
| [`sync-copilot-configs.yaml`](github_configs/workflows/sync-copilot-configs.yaml) | Manual dispatch | Sync Copilot configuration files from template |
| [`setup-repository.yaml`](.github/workflows/setup-repository.yaml) | Push to `master` (on `cookiecutter.json` change) | Cookiecutter scaffolding: generates the actual service from template |

### Kubernetes Deployment (ArgoCD + Helm)

**ArgoCD ApplicationSet** defined in [`argocd/argocd.yaml`](argocd/argocd.yaml):

| Environment | Cluster | Replicas | HPA |
|-------------|---------|----------|-----|
| `dev-uz` | `dev-uz-p` | 1 | No |
| `automation-uz` | `automation-uz-p` | 1 | No |
| `qa-uz` | `qa-uz-p` | 1 | No |
| `preprod-uz` | `preprod-uz-p` | — | Yes (2-10, 40% CPU / 60% mem) |
| `prod-uz` | `prod-uz-p` (commented out) | — | Yes (3-10, 40% CPU / 60% mem) |

**Helm chart**: `k8s-service` (version 0.0.37) from `charts.shared.int.spaceneobank.com`.

**Production resources:**

```yaml
containerResources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2"
```

**Service mesh**: Istio enabled across all environments (`istio.enabled: true`).

**Graceful shutdown**: `terminationGracePeriodSeconds: 180` with application-level `GRACEFULSHUTDOWNTIMEOUTSECONDS: 60` and `SHUTDOWNTIMEOUTSECONDS: 120`.

### Environment-Specific Configurations

| Value File | `ASPNETCORE_ENVIRONMENT` |
|-----------|-------------------------|
| `dev-uz.yaml` | `Development` |
| `automation-uz.yaml` | `Automation` |
| `qa-uz.yaml` | `QA` |
| `preprod-uz.yaml` | `PreProd` |
| `prod-uz.yaml` | `Production` |

---

## 12. External Service Dependencies

### HTTP Clients

The template has a placeholder structure for external service integrations:

- `Application/HttpClients/` — contains only `.gitkeep`
- `InfrastructureExtensions.AddHttpClients()` — empty method stub:

```csharp
private static IServiceCollection AddHttpClients(this IServiceCollection services, IConfiguration configuration)
{
    return services;
}
```

When implemented, HTTP clients use **RestEase** interfaces (registered via `Space.Service.Common.RestClient`). RestEase provides:
- Declarative HTTP client interfaces
- Typed client pattern with `HttpClientFactory`
- Built-in resilience policies

### External Service Certificates

Three external services require custom CA certificates (from the Dockerfile):

| Certificate | Likely Service |
|-------------|---------------|
| `ca_cert.pem` | General internal PKI |
| `ca_cert_kafka.pem` | Apache Kafka cluster |
| `ca_cert_es.pem` | Elasticsearch/Kibana |

### WireMock for Testing

Component tests include `WireMockServerFixture` (port 5980) for mocking external HTTP dependencies during integration testing.

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Summary Table

| Pattern | Where It's Used | Why |
|---------|----------------|-----|
| **Clean Architecture** | Project structure (Api, Application, Domain, Infrastructure, Persistence) | Enforces dependency inversion; Domain has no outward dependencies |
| **CQRS** | `Application/Features/*/Commands/` and `Queries/` | Separates read/write concerns; simpler handlers |
| **Mediator (MediatR)** | Controllers → Handlers via `IMediator` | Decouples controllers from business logic; enables pipeline behaviors |
| **Repository Pattern** | `Application/Repositories/` (interfaces), `Persistence/Repositories/` (implementations) | Abstracts data access; testable without DB |
| **Unit of Work** | `Space.Service.Common.Persistence.IUnitOfWork` | Transactional consistency across repos + event bus |
| **Outbox Pattern** | `AddEventBus(config, typeof(DbContext))` | Reliable event publishing with transactional guarantee |
| **Pipeline Behaviors** | `LoggingBehavior<,>`, `ValidationBehavior<,>` | Cross-cutting concerns without handler modification |
| **Factory Pattern** | `Space.Service.Common.Factory` | Tenant-specific service implementations |
| **Feature Toggles** | `Space.Service.Common.FeatureToggle` (GrowthBook) | Runtime feature control without redeployment |
| **Architecture Tests** | `*.ArchitectureTests` with NetArchTest | Automated enforcement of architecture constraints |
| **Sensitive Data Masking** | `[SensitiveData]` attribute on DTOs/entities | PII protection in logs |
| **Mutation Testing** | Stryker (.NET) via CI + pre-commit hook | Validates test quality beyond code coverage |
| **Secret Scanning** | Trivy + custom rules | Prevents credential leaks in source code |
| **Contract Testing** | Pact (in CI/CD workflows) | Consumer/provider API contract verification |
| **Testcontainers** | `PostgresContextFixture`, `PostgresDbContextFixture` | Real PostgreSQL for integration tests |
| **Cookiecutter** | Repository template + `pre_gen_project.py` | Standardized microservice scaffolding |

### Notable Deviations from Conventions

1. **Single-stage Dockerfile**: The build is done externally in CI rather than in a multi-stage Docker build. This is intentional — it keeps the image small and the CI pipeline in control of the build process.

2. **`ValidateScopes = false`**: Disabled in `Program.cs` with the comment "Needed for Mediator DI." This relaxes DI scope validation for MediatR's internal service resolution.

3. **`SuppressModelStateInvalidFilter = true`**: ASP.NET Core's automatic 400 response on model state errors is disabled. Validation is handled entirely through MediatR's `ValidationBehavior`.

4. **`ThreadPool.SetMinThreads(100, 100)`**: Explicitly sets minimum thread pool size to avoid thread starvation under load.

5. **Synchronous `.Wait()` calls on startup**: `db.Database.Create().Wait()` and `db.Seed().Wait()` use synchronous blocking on the main thread during application startup. This is acceptable since it occurs before the request pipeline is active.

### Technical Debt & Improvement Opportunities

| Item | Severity | Description |
|------|----------|-------------|
| **No `appsettings.json` in source** | Low | The template relies entirely on Vault-mounted settings for deployed environments and `appsettings.Local.json` (gitignored) for local dev. A default `appsettings.json` with placeholder structure would improve discoverability. |
| **`TimeProvider.System` registered twice** | Low | `InfrastructureExtensions.cs` registers `TimeProvider.System` via both `TryAddSingleton` and `AddSingleton` — the second registration is redundant. |
| **Blocking `.Wait()` on startup** | Low | Could be refactored to use async startup with `IHostedService` or .NET's async `Main`. |
| **Component test DB initializer duplication** | Low | Both `ComponentTests/{{cookiecutter.ProjectName}}DbInitializer.cs` and `UnitTests/Persistence/{{cookiecutter.ProjectName}}DbInitializer.cs` contain identical code — could be consolidated into a shared test utility. |
| **Empty workers/features folders** | Info | Expected for a template — but new teams may not discover the intended patterns without examples. The inline instructions and skill files help mitigate this. |
| **`ValidateScopes = false`** | Medium | Disabling scope validation can mask DI lifetime mismatches. Worth investigating if the MediatR issue has been resolved in newer versions. |
