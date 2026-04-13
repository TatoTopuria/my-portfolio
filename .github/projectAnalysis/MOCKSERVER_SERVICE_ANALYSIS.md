# Space.Service.MockServer — Comprehensive Service Analysis

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

### Service Name

**Space.Service.MockServer**

### Purpose & Core Business Problem

A lightweight in-memory mock server that simulates external HTTP and SOAP APIs for development, QA, and automation testing environments. It eliminates the dependency on real third-party systems (banking APIs, card processors, government services, identity providers, etc.) so that dependent microservices in the SpaceBank ecosystem can operate in isolation during development and testing cycles.

### Domain Context

This service sits in the **Testing & Development Infrastructure** bounded context. It is not a domain service itself but rather a cross-cutting infrastructure tool that replicates the behavior of 50+ external service APIs. It serves the entire microservice fleet by acting as a centralized mock endpoint.

### Key Entities & Domain Models

The service has minimal domain entities of its own—it primarily manages **WireMock mappings** (request/response stubs). Key models include:

| Model | Location | Purpose |
|---|---|---|
| `CreateMappingRequest` | `Application/Features/Mappings/Models/CreateMappingRequest.cs` | Defines a dynamic WireMock mapping (path, headers, body matchers, response) |
| `MappingResponse` | `Application/Features/Mappings/Models/MappingResponse.cs` | Response DTO for created mappings |
| `DeleteMappingRequest` | `Application/Features/Mappings/Models/DeleteMappingRequest.cs` | Request to delete a single mapping by GUID |
| `DeleteMappingsRequest` | `Application/Features/Mappings/Models/DeleteMappingsRequest.cs` | Request to delete all dynamic mappings |
| `ProduceEventCommand` | `Application/Features/Events/Produce/ProduceEventCommand.cs` | Command for publishing integration events to Kafka |
| `RequestModel`, `ResponseModel`, `PathModel`, `MatcherModel` | `Application/Features/Mappings/Models/CreateMappingRequest.cs` | Full WireMock matching model hierarchy |
| `DynamicMappingOptions` | `Application/Options/DynamicMappingOptions.cs` | Configuration for mapping TTL in Redis |

### Main Use Cases & Workflows

1. **Static Mock Serving** — On startup, loads hundreds of JSON/XML mock files from `Mocks/` and registers them with an in-memory WireMock server on port 81. External services hit this port and get pre-configured responses.
2. **Dynamic Mapping CRUD** — At runtime, QA/automation teams create, list, and delete mock mappings via a REST API. Mappings are persisted in Redis and synchronized across all instances via Redis Pub/Sub.
3. **Integration Event Publishing** — Produces Kafka events on demand (e.g., to simulate events that would normally come from real services), enabling end-to-end testing of event-driven workflows.
4. **Handlebars Response Templating** — Supports dynamic response generation using custom Handlebars helpers (random numbers, session state, date parsing, IABS accounts, card numbers, etc.).
5. **Multi-Instance Synchronization** — Uses Redis Pub/Sub to ensure that dynamically-created mappings are replicated across all running instances of the mock server.

---

## 2. Architecture

### Architectural Pattern

The service follows **Clean Architecture** with **CQRS** (Command Query Responsibility Segregation) principles, consistent with the SpaceBank platform standard. This is evidenced by:

- **Four-project layer separation**: `Api`, `Application`, `Infrastructure`, `Persistence`
- **Features folder** with `Commands/` and `Queries/` sub-folders inside `Application/Features/`
- **MediatR** as the mediator/dispatcher between controllers and handlers
- **Dependency direction** flowing inward (Api → Infrastructure → Application ← Persistence)

### Project Structure Breakdown

```
Space.Service.MockServer.sln
├── Space.Service.MockServer.Api/            # Presentation layer
│   ├── Controllers/                         # REST API endpoints (EventController, MappingsController)
│   ├── Helpers/                             # Custom Handlebars helpers for WireMock templating
│   │   └── Cards/                           # Card-specific helpers (IABS accounts)
│   ├── Mocks/                               # 55+ folders of static JSON/XML mock definitions
│   ├── Services/                            # WireMockServerAccessorService (adapter)
│   ├── Workers/                             # MappingSyncWorker (Redis Pub/Sub background service)
│   ├── Properties/                          # launchSettings.json
│   ├── Program.cs                           # Application entry point
│   ├── ApiExtensions.cs                     # API layer DI registration
│   └── MockServerExtensions.cs              # WireMock server setup & 900+ lines of SOAP/REST mock config
│
├── Space.Service.MockServer.Application/    # Business logic layer (CQRS handlers)
│   ├── Abstractions/                        # Interfaces (IWireMockServerAccessor, IRedisPubSubService, IMappingService)
│   ├── Constants/                           # CacheConstants (Redis key prefixes, Pub/Sub channels)
│   ├── Features/                            # CQRS features
│   │   ├── Events/Produce/                  # ProduceEventCommand + Handler + Validator
│   │   └── Mappings/                        # CreateMapping, DeleteMapping, DeleteMappings commands
│   │       ├── Commands/                    # Command handlers
│   │       └── Models/                      # DTOs and request/response models
│   ├── Options/                             # DynamicMappingOptions
│   └── Services/                            # MappingService (Redis index management)
│
├── Space.Service.MockServer.Infrastructure/ # Infrastructure services
│   └── Services/                            # RedisPubSubService (StackExchange.Redis Pub/Sub)
│
├── Space.Service.MockServer.Persistence/    # Data access layer
│   ├── MockServerDbContext.cs               # EF Core DbContext (PostgreSQL, currently empty)
│   └── PersistenceExtensions.cs             # DB registration and migration
│
└── tools/                                   # Developer tooling
    ├── localDevSetup.sh                     # Git hooks + Trivy setup
    ├── hooks/commit-msg                     # Commit message format enforcement
    ├── codeCoverage/                        # Code coverage scripts
    ├── stryker/                             # Mutation testing scripts
    ├── sonarqube/                           # SonarQube scan
    ├── trivy/                               # Secret detection
    └── zap/                                 # OWASP ZAP rules
```

### Dependency Flow Direction

```
Api ──────────────► Infrastructure ──────► Application
 │                       │                     ▲
 │                       │                     │
 └──────────────► Persistence ─────────────────┘
```

- **Api** references `Infrastructure` and `Persistence`
- **Infrastructure** references `Application` and `Persistence`
- **Persistence** references `Application`
- **Application** has zero project references (it is the innermost layer — depends only on NuGet packages)

### CQRS Details

| Feature | Type | Handler | Purpose |
|---|---|---|---|
| Events/Produce | Command | `ProduceEventCommandHandler` | Publishes events to Kafka via `IEventBus` |
| Mappings/Create | Command | `CreateMappingCommandHandler` | Creates a WireMock mapping + persists to Redis + Pub/Sub sync |
| Mappings/Delete | Command | `DeleteMappingCommandHandler` | Deletes a single mapping + Redis cleanup + Pub/Sub sync |
| Mappings/DeleteAll | Command | `DeleteMappingsCommandHandler` | Bulk-deletes all dynamic mappings |

MediatR is configured in `ApplicationExtensions.AddApplication()` with two pipeline behaviors:
1. `LoggingBehavior<,>` — logs request/response
2. `ValidationBehavior<,>` — runs FluentValidation before handler execution

### DDD Patterns

This service has minimal DDD patterns since it's an infrastructure tool, not a domain service. There are no Aggregates, Value Objects, or Domain Events. The `MockServerDbContext` extends `DbContextBase` (from `Space.Service.Common.Persistence`) but currently has no `DbSet<>` properties — the database is provisioned but empty.

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Item | Value |
|---|---|
| Runtime | .NET 8.0 |
| Language | C# (latest features enabled via `<ImplicitUsings>enable</ImplicitUsings>`) |
| Target Framework | `net8.0` (all four projects) |

### Primary Frameworks & Versions

| Package | Version | Project | Role |
|---|---|---|---|
| `WireMock.Net` | 1.5.47 | Api | Core mock server engine |
| `WireMock.Net.StandAlone` | 1.5.47 | Api | Standalone WireMock server host |
| `AutoFixture` | 4.18.1 | Api | Test data generation (used in mock responses) |
| `AutoMapper` | 14.0.0 | Application, Infrastructure, Persistence | Object-to-object mapping |
| `Microsoft.EntityFrameworkCore.Design` | 8.0.10 | Api | EF Core design-time tooling |
| `Microsoft.EntityFrameworkCore.Tools` | 8.0.10 | Persistence | EF Core CLI tools |
| `Microsoft.CodeAnalysis.Common` | 4.11.0 | Api, Persistence | Roslyn analyzers |
| `Microsoft.CodeAnalysis.CSharp.Workspaces` | 4.11.0 | Api, Persistence | Roslyn workspace support |
| `Microsoft.Extensions.Caching.Memory` | 8.0.1 | Infrastructure | In-memory caching |
| `prometheus-net.AspNetCore` | 8.2.1 | Api | Prometheus metrics endpoint |

### SpaceBank Internal Packages

| Package | Version | Role |
|---|---|---|
| `Space.Service.Common.Mediator` | 1.0.139 | MediatR abstraction with pipeline behaviors |
| `Space.Service.Common.Middlewares` | 1.0.121 | Standard HTTP middleware pipeline |
| `Space.Service.Common.Swagger` | 1.0.128 | Swagger/OpenAPI configuration |
| `Space.Service.Common.HealthChecks` | 1.0.116 | Health check endpoints |
| `Space.Service.Common.Logging` | 1.0.116 | Serilog structured logging + sensitive data masking |
| `Space.Service.Common.Caching` | 2.0.70 | `ISuperCache` Redis + memory caching abstraction |
| `Space.Service.Common.Mapping` | 1.0.59 | AutoMapper registration helpers |
| `Space.Service.Common.RestClient` | 1.0.183 | RestEase HTTP client factory |
| `Space.Service.Common.EventBus` | 1.1.30 | Kafka event bus abstraction |
| `Space.Service.Common.Exceptions` | 1.0.124 | Standardized exception types |
| `Space.Service.Common.Persistence` | 1.0.94 | EF Core base classes, DbContextBase, UnitOfWork |
| `Space.Service.Common.Misc` | 1.0.363 | Shared utilities (RequestMetadata, environment helpers) |
| `Space.Service.Common.Workers` | (transitive) | Background worker registration helpers |
| `Space.Service.Common.CodeAnalyzers` | 1.0.46 | Custom Roslyn analyzers (SensitiveData, etc.) |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |

### Database

| Item | Value |
|---|---|
| Database Engine | PostgreSQL (via Npgsql) |
| ORM | Entity Framework Core 8.0.10 |
| Purpose | Provisioned but currently empty (no DbSets) — likely reserved for future use |

### Caching Layer

| Item | Value |
|---|---|
| Primary Cache | Redis via `ISuperCache` (`Space.Service.Common.Caching`) |
| Secondary Cache | In-memory cache (`Microsoft.Extensions.Caching.Memory`) |
| Redis Client | StackExchange.Redis (`IConnectionMultiplexer`) |
| Usage | Mapping persistence, session variables, state management, Pub/Sub |

### Logging & Observability

| Item | Value |
|---|---|
| Logging | Serilog (via `Space.Service.Common.Logging`, configured in `Program.cs` with `UseSerilog()`) |
| Metrics | Prometheus (`prometheus-net.AspNetCore` 8.2.1, endpoint via `MapMetrics()`) |
| APM | Configured via `AddApm(builder.Configuration)` in `Program.cs` |
| Sensitive Data | `[SensitiveData]` attribute from `Space.Service.Common.Logging.SensitiveData` |

---

## 4. API Layer & Communication

### API Style

**REST** (JSON) on port **5148** (development) / port **80** (container) for the management API.  
**HTTP + SOAP** on port **81** for the WireMock mock server (serves stubbed responses to calling services).

### API Versioning Strategy

API versioning is enabled via `services.AddVersioning()` in `ApiExtensions.cs`. Routes use the `v{version:apiVersion}` segment:
- `api/v{version:apiVersion}/[controller]`
- `api/v{version:apiVersion}/admin/[controller]`

### Exposed Endpoints

#### EventController — `api/v{version}/event`

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v{version}/event` | Produce an integration event to Kafka. Reads `TenantId` from request headers. Request body is `ProduceEventCommand` containing topic, event type, body, optional key, delay, and metadata fields. |

#### MappingsController — `api/v{version}/admin/mappings`

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v{version}/admin/mappings` | Create a new dynamic WireMock mapping. Body is `CreateMappingRequest` with path matchers, headers, body matchers, and response configuration. Returns the created mapping GUID. |
| `DELETE` | `/api/v{version}/admin/mappings` | Delete **all** dynamically-created mappings. Returns `204 No Content`. |
| `DELETE` | `/api/v{version}/admin/mappings/{mappingGuid}` | Delete a **single** dynamic mapping by GUID. Returns `204 No Content` or `404 Not Found`. |

#### WireMock Admin Interface — Port 81

WireMock.Net's built-in admin interface is enabled (`StartAdminInterface = true`), providing standard WireMock admin endpoints (`/__admin/mappings`, `/__admin/requests`, etc.) on port 81 alongside the mock stubs.

### Request/Response Patterns

- **DTOs**: All requests and responses are serialized to JSON. The `CreateMappingRequest` is a comprehensive WireMock mapping model supporting path matchers (`ExactMatcher`, `RegexMatcher`, `JsonMatcher`, `JsonPartialMatcher`, `WildcardMatcher`, `XPathMatcher`, etc.), multiple HTTP methods, header/cookie/param matchers, and body matchers.
- **Envelope pattern**: Responses use a simple ad-hoc structure (e.g., `{ guid, status }` for create, or standard HTTP status codes for delete).
- **`PathConverter`**: A custom `JsonConverter<PathModel>` that handles both simple string paths and complex matcher objects during deserialization.

### Authentication & Authorization

Authentication is **disabled**. In `ApiExtensions.cs`, the identity server authentication line is commented out:
```csharp
// services.AddIdentityServerAuthentication(configuration);
```
The middleware pipeline does call `UseAuthentication()` and `UseAuthorization()`, but no authentication scheme is configured. This is expected for an internal development/testing tool.

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

Registered in `ApiExtensions.ConfigureAPI()`, executed in this order:

| Order | Middleware | Purpose |
|---|---|---|
| 1 | `UsePathBase(pathBase)` | Sets the path base from `PATH_BASE` configuration (default: `/mockserver`) |
| 2 | `UseLocalization()` | Enables request localization |
| 3 | `UseHttpsRedirection()` | Redirects HTTP to HTTPS |
| 4 | `UseRouting()` | Endpoint routing |
| 5 | `UseHttpMetrics()` | Prometheus HTTP request metrics collection |
| 6 | `UseAuthentication()` | Authentication (no scheme configured) |
| 7 | `UseAuthorization()` | Authorization (no policies configured) |
| 8 | `UseMiddlewares()` | SpaceBank common middleware stack (from `Space.Service.Common.Middlewares`) |
| 9 | `UseHealthCheckMiddleware(env)` | Health check endpoints |
| 10 | `UseVersionEndpoint(configuration)` | Version info endpoint |
| 11 | `MapControllers()` | Maps attribute-routed controllers |
| 12 | `MapMetrics()` | Prometheus `/metrics` endpoint |
| 13 | `UseSwagger()` | Swagger UI and OpenAPI spec |

### MediatR Pipeline Behaviors

Registered in `ApplicationExtensions.AddApplication()`:

| Order | Behavior | Purpose |
|---|---|---|
| 1 | `LoggingBehavior<,>` | Logs incoming requests and outgoing responses (from `Space.Service.Common.Mediator`) |
| 2 | `ValidationBehavior<,>` | Executes FluentValidation validators before the handler (from `Space.Service.Common.Mediator`) |

### Global Exception Handling

Handled by `UseMiddlewares()` from `Space.Service.Common.Middlewares`, which provides standardized error response formatting. Custom exceptions like `ObjectNotFoundException` (from `Space.Service.Common.Exceptions`) are thrown by handlers and caught by the middleware.

### Request Validation

- **FluentValidation** is used for command validation. Validators are auto-registered via `services.AddValidatorsFromAssembly()`.
- `ProduceEventCommandValidator` validates: `TenantId` (not null/empty), `Topic` (not null/empty), `EventType` (not null/empty), `EventBody` (not null).
- Model state validation is suppressed at the controller level: `options.SuppressModelStateInvalidFilter = true` — validation is handled by the MediatR `ValidationBehavior` instead.
- Display names are resolved to camelCase: `ValidatorOptions.Global.DisplayNameResolver = (type, member, expression) => member?.Name.ToCamelCase()`.

### Correlation ID / Request Tracing

Handled by `Space.Service.Common.Middlewares` (via `UseMiddlewares()`). The `RequestMetadata` class (from `Space.Service.Common.Misc`) is registered as scoped and carries correlation context through the request pipeline.

---

## 6. Data Layer

### Database Type & Provider

| Item | Value |
|---|---|
| Engine | PostgreSQL |
| Provider | Npgsql (via `UseNpgsql()`) |
| Connection String Key | `NpgSql` |

### ORM Configuration

```csharp
// PersistenceExtensions.cs
services.AddDbContext<MockServerDbContext>(options =>
    options.UseNpgsql(configuration.GetConnectionString("NpgSql"), npgsqlOptions =>
    {
        npgsqlOptions.MigrationsAssembly(Assembly.GetExecutingAssembly().FullName);
    }));
```

`MockServerDbContext` extends `DbContextBase` from `Space.Service.Common.Persistence`. It currently has **no `DbSet<>` properties** — the database exists as infrastructure scaffolding but contains no tables. This is likely because the service's primary data store is Redis (for mapping persistence), not the relational database.

### Migration Strategy

EF Core Migrations, auto-applied on startup:
```csharp
// PersistenceExtensions.cs
db.Database.Create().Wait();  // Creates DB if not exists
db.Database.Migrate();         // Applies pending migrations
```

### Repository Pattern

Not applicable in the current implementation. No repositories exist because there are no entities. All data access is through Redis via `ISuperCache`.

### Connection Resilience

Not explicitly configured beyond default Npgsql behavior. The database is currently unused in practice.

---

## 7. Messaging & Event Handling

### Message Brokers

| Broker | Library | Purpose |
|---|---|---|
| **Apache Kafka** | `Space.Service.Common.EventBus` 1.1.30 | Publishing integration events |
| **Redis Pub/Sub** | StackExchange.Redis `IConnectionMultiplexer` | Cross-instance mapping synchronization |

### Published Events (Kafka)

The service publishes **arbitrary events** to Kafka on demand via the `POST /api/v{version}/event` endpoint. The topic, event type, body, and key are all caller-supplied. This is used to simulate events that would normally be produced by other services.

```csharp
// ProduceEventCommandHandler.cs
await eventBus.Produce(
    request.Topic,
    request.EventType,
    request.EventBody,
    request.EventKey ?? Guid.NewGuid().ToString(),
    request.TenantId,
    request.EventHeaders,
    timeSpan,
    cancellationToken: cancellationToken);
```

Supports optional delayed publishing via `EventDelayTimeInMinutes`.

### Published Events (Redis Pub/Sub)

| Channel | Published By | Message | Purpose |
|---|---|---|---|
| `mockserver:mapping-sync` | `CreateMappingCommandHandler` | Mapping GUID (string) | Notify other instances to fetch and apply a new mapping |
| `mockserver:mapping-delete-sync` | `DeleteMappingCommandHandler` | Mapping GUID (string) | Notify other instances to delete a specific mapping |
| `mockserver:mappings-delete-all-sync` | `DeleteMappingsCommandHandler` | JSON array of GUIDs | Notify other instances to bulk-delete mappings |

### Consumed Events (Redis Pub/Sub)

Consumed by `MappingSyncWorker`:

| Channel | Handler Method | Action |
|---|---|---|
| `mockserver:mapping-sync` | `HandleMappingCreatedMessage` | Fetches mapping JSON from Redis → applies to local WireMock (skips if already exists) |
| `mockserver:mapping-delete-sync` | `HandleMappingDeletedMessage` | Deletes mapping from local WireMock instance |
| `mockserver:mappings-delete-all-sync` | `HandleMappingsDeletedAllMessage` | Bulk-deletes all listed mappings from local WireMock |

### Consumed Events (Kafka)

None. This service only produces Kafka events; it does not consume them.

### Event Patterns

- **Redis Pub/Sub** is used for broadcast (all instances receive all messages), unlike Kafka consumer groups.
- The `MappingSyncWorker` performs idempotency checks (e.g., `MappingExists()` before applying).
- No outbox pattern, saga, or dead-letter queue — this is a lightweight dev tool.

---

## 8. Background Jobs & Scheduled Tasks

### Background Workers

| Worker | Base Class | Registration | Purpose |
|---|---|---|---|
| `MappingSyncWorker` | `BackgroundService` | `services.AddWorker<MappingSyncWorker>()` via `Space.Service.Common.Workers` | Subscribes to 3 Redis Pub/Sub channels on startup and handles mapping synchronization across instances. Runs for the lifetime of the application. |

The worker subscribes to channels on startup and then awaits `Task.Delay(Timeout.Infinite, stoppingToken)` to stay alive. Message handling is callback-driven via the StackExchange.Redis subscriber.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Serilog** configured in `Program.cs` via `builder.Host.UseSerilog(builder.Services, builder.Configuration)`.
- Structured logging with `ILogger<T>` injection throughout handlers and workers.
- `LoggingBehavior<,>` in the MediatR pipeline logs all requests and responses.
- `[SensitiveData]` attribute masks PII fields when serializing for logs (e.g., `AccountNumber` in `IabsAccountHelper`, `Title` in `MappingResponse`).
- Log levels used: `Information` (happy paths), `Warning` (non-critical failures like Redis persistence failures), `Error` (exceptions), `Debug` (skip/duplicate sync events).

### Health Checks

Configured via `services.AddHealthChecks(configuration)` from `Space.Service.Common.HealthChecks` and exposed via `UseHealthCheckMiddleware(env)`.

### Rate Limiting / Throttling

Not configured. As an internal testing tool, rate limiting is unnecessary.

### Resilience Patterns

- **Redis connection**: `AbortOnConnectFail = false`, `ConnectTimeout = 5000ms`, `SyncTimeout = 1000ms` in `InfrastructureExtensions.cs`.
- **Mapping operations**: Redis persistence failures are caught and logged without failing the request (the mapping remains in WireMock memory).
- **Kestrel**: Minimum request body data rate configured: 50 bytes/sec with 15-second grace period.
- **Thread pool**: `ThreadPool.SetMinThreads(100, 100)` set for high-concurrency mock serving.

### Configuration Management

| Source | Purpose |
|---|---|
| `appsettings.json` (not present in repo) | Base configuration |
| `appsettings.Local.json` | Local development overrides |
| `/settings/globalsettings.json` | Mounted global settings in non-local environments |
| `/settings/appsettings.json` | Mounted app-specific settings |
| `/settings/dbsettings.json` | Mounted database connection strings |
| User Secrets (ID: `3f45b935-83aa-40a9-bcd1-349713354ad4`) | Local development secrets |
| `DynamicMappingOptions` | Bound from `DynamicMappingOptions` config section, validated on start |
| `RedisOptions` | Redis host/port/password/database (from `Space.Service.Common.Caching`) |
| `PATH_BASE` | Path base for URL routing (default `/mockserver`) |
| `configuration.Watch(settingsFilePaths)` | Hot-reload of mounted settings files |

Service provider validation: `ValidateOnBuild = true`, `ValidateScopes = false` (needed for MediatR DI).

---

## 10. Testing

### Test Projects

No test projects exist in the current solution. The `.sln` file contains only the four main projects:
- `Space.Service.MockServer.Api`
- `Space.Service.MockServer.Application`
- `Space.Service.MockServer.Infrastructure`
- `Space.Service.MockServer.Persistence`

The development workflow instructions reference `Space.Service.MockServer.UnitTests`, `Space.Service.MockServer.ComponentTests`, and `Space.Service.MockServer.ArchitectureTests`, but these projects are not present in the repository. The CI/CD configuration confirms this with `code_coverage_report: false` and `stryker_score_check: false`.

### Testing Infrastructure (Tooling Only)

While no test projects exist, the `tools/` directory contains infrastructure for:
- **Code coverage** (`tools/codeCoverage/`) — pre-commit coverage verification scripts
- **Mutation testing** (`tools/stryker/`) — Stryker.NET with 80% score threshold enforcement
- **Secret scanning** (`tools/trivy/`) — Trivy secret detection on commit

The `[ExcludeFromCodeCoverage]` attribute is applied extensively throughout the codebase (every class), suggesting that either tests are in a separate repository or were removed after the mock data was stabilized.

---

## 11. DevOps & Deployment

### Dockerfile Analysis

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt
RUN update-ca-certificates --verbose
COPY app/publish  .
ENV ASPNETCORE_HTTP_PORTS=80
ENTRYPOINT ["dotnet", "Space.Service.MockServer.Api.dll"]
```

| Aspect | Detail |
|---|---|
| Base Image | `mcr.microsoft.com/dotnet/aspnet:8.0` (runtime-only, no SDK) |
| Build Stages | **Single stage** — expects pre-built artifacts in `app/publish` (build happens in CI) |
| CA Certificates | Installs two custom CA certs (`ca_cert.pem` for general, `ca_cert_kafka.pem` for Kafka TLS) |
| Port | Exposes port 80 (management API); WireMock runs on port 81 internally |
| No multi-stage build | Build is offloaded to CI pipeline |

### CI/CD Pipeline

All workflows use reusable workflow templates from `SpaceBank/Space.Service.Workflows`.

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci-cd.yaml` | Push to `master` | Full CI/CD: build, test, Docker image, deploy to `dev-uz`, `automation-uz`, `qa-uz`, `preprod-uz` |
| `cd.yaml` | Manual dispatch | Deploy to a selected environment |
| `pull-request.yaml` | Pull request | PR checks (build, lint) — no coverage or Pact |
| `stryker.yaml` | Scheduled (daily 03:27 UTC) + manual | Mutation testing report |
| `zaproxy.yaml` | Scheduled (weekly Monday 00:53 UTC) + manual | OWASP ZAP security scan |
| `dora.yaml` | Manual dispatch | DORA metrics tracking |
| `update-packages.yaml` | Manual dispatch | Auto-upgrade `Space.Service.Common.*` NuGet packages |
| `generate-readme.yaml` | Scheduled (weekly Saturday 03:58 UTC) | Auto-generate README |
| `notify.yaml` | Called by other workflows | Slack deployment notifications |
| `sync-copilot-configs.yaml` | Manual dispatch | Sync GitHub Copilot configuration files |
| `assign-copilot.yaml` | Issue opened/edited/labeled | Auto-assign Copilot to issues |
| `create-kibana-alert-rules.yaml` | Manual dispatch | Create Kibana alerting rules |

### Deployment Environments

| Environment | Purpose |
|---|---|
| `dev-uz` | Development (Uzbekistan region) |
| `automation-uz` | Automated test execution |
| `qa-uz` | QA testing |
| `preprod-uz` | Pre-production validation |

Deployment uses **ArgoCD** (referenced as `argocd_app_name: space-service-mockserver`).

### Docker Compose

Not present. The service is deployed via Kubernetes/ArgoCD, not Docker Compose.

---

## 12. External Service Dependencies

### Services Mocked (Not Called)

This service **does not call** external services — it **simulates** them. The `Mocks/` folder contains stubs for 55+ external services:

| Category | Services Mocked |
|---|---|
| **Banking Core** | IABS, Mambu, MfoCoreBanking, CoreApi, CoreApiFacade, CoreBankingAdapter, BankingPlatformAdapter |
| **Card Processing** | Humo, Uzcard, Visa, TransAxis, ProcessingCenter, ProcessingCenterAdapter, CardManagement |
| **Identity & KYC** | MyId, Identomat, OzForensics, NationalRegistry, Egov, MyGov, Emehmon-uz, Verification |
| **Credit & Scoring** | Asoki, Crif, CashLoan, Scoring, WingsDM, TMX, AmlAcuity, ThreatDetection |
| **Loans & Deposits** | Mambu (CashLoan, AutoLoan, CreditCard, Deposit), Currency |
| **Payments** | Shina, Payme, ServiceVendors (Munis, Vendoo, Paynet), MoneyMovement |
| **Business Banking** | BusinessBank, BusinessOnboarding, MyOrg, Nibbd |
| **Insurance** | TbcInsurance |
| **Communication** | GoSms |
| **Third-Party** | Giphy, Appsflyer, Salesforce, Creatio, Formica, SpaceRex, Inps, Cbu, Bs2 |
| **Anti-Fraud** | AntiFraud, ThreatDetection, AmlAcuity |

### Actual External Dependencies

| Dependency | Client | Configuration |
|---|---|---|
| **Redis** | StackExchange.Redis `IConnectionMultiplexer` | Configured in `InfrastructureExtensions.cs` with `RedisOptions` (hosts, port, password, database). Used for caching (`ISuperCache`) and Pub/Sub. |
| **Kafka** | `IEventBus` from `Space.Service.Common.EventBus` | Configured via `services.AddEventBus(configuration, typeof(MockServerDbContext))`. TLS via custom CA cert (`ca_cert_kafka.pem`). |
| **PostgreSQL** | EF Core via Npgsql | Connection string `NpgSql`. Currently unused (no tables). |

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Usage Table

| Pattern | Where Used | Why |
|---|---|---|
| **WireMock.Net In-Memory Server** | `MockServerExtensions.cs`, port 81 | Provides a fully-featured HTTP/SOAP mock server with request matching, response templating, and admin API |
| **Clean Architecture** | 4-project solution structure | Platform standard; separates concerns and enables testability |
| **CQRS with MediatR** | `Application/Features/` | Decouples controllers from business logic; standardized request pipeline |
| **Redis Pub/Sub for Sync** | `MappingSyncWorker`, `RedisPubSubService` | Broadcasts dynamic mapping changes to all instances (not Kafka, because all instances must receive every message) |
| **Redis as Primary Data Store** | `ISuperCache`, `CacheConstants` | Dynamic mappings need fast access and TTL expiration; no relational schema needed |
| **Handlebars Response Templating** | 20+ custom helpers in `Helpers/` | Dynamic response generation based on request content (e.g., random card numbers, session-based state) |
| **Custom Handlebars Helpers** | `PersonalNumberHelpers`, `RedisStateManager`, `SessionVariableHelpers`, etc. | Domain-specific response logic (banking card numbers, IABS accounts, date parsing) |
| **Static + Dynamic Mock Layering** | `MockServerExtensions.cs` + `MappingsController` | Static mocks from JSON files for stable scenarios; dynamic API for test-specific overrides |
| **Background Worker for Pub/Sub** | `MappingSyncWorker : BackgroundService` | Long-lived subscriber that processes mapping sync messages asynchronously |
| **FluentValidation in Pipeline** | `ValidationBehavior<,>` + validators | Validates commands before handler execution; consistent error responses |
| **Prometheus Metrics** | `prometheus-net.AspNetCore`, `MapMetrics()` | Kubernetes-native observability |
| **SOAP Mock Helpers** | `MockSoapCall()`, `MockSoapCallXPath()`, `MockSoapCallDoubleXPath()` | Many mocked services (Humo, Visa, TransAxis) use SOAP/XML — custom helper methods simplify registration |
| **Singleton WireMock Accessor** | `WireMockServerAccessor.Instance` (static) + `IWireMockServerAccessor` (DI) | Static accessor for startup registration; interface abstraction for handler injection |
| **Commit Message Enforcement** | `tools/hooks/commit-msg` | Format: `<ABBREVIATION-NUMBER> \| COMMIT MESSAGE \| <PAIR>` |
| **Secret Scanning** | Trivy on commit + CI | Prevents accidental credential leaks, especially important with 55+ mock files |

### Notable Deviations from Conventions

| Deviation | Observation |
|---|---|
| **No test projects** | Despite platform guidelines mandating unit and component tests, none exist. Every class has `[ExcludeFromCodeCoverage]`. CI disables coverage reporting. |
| **Empty DbContext** | `MockServerDbContext` has no `DbSet<>` properties. PostgreSQL is provisioned but unused — Redis handles all data persistence. |
| **Helpers in API layer** | All 20+ Handlebars helpers live in `Api/Helpers/` rather than `Application/` or `Infrastructure/`. This is because they are WireMock-specific response transformers, tightly coupled to the API layer. |
| **Static mutable state** | Several helpers use `static` fields (`RandomCardNumberHelper.cardNumber`, `IabsAccountHelper.accounts`, `RandomHumoVariableHelper.humoVariable`). Safe only because tests do not share state; could cause issues under concurrent load. |
| **`MockServerExtensions.cs` is ~940 lines** | Contains all static mock wiring. Excluded from SonarQube analysis. |
| **`IMappingService` interface in wrong namespace** | Declared in `Space.Service.MockServer.Application.Services` but file is in `Abstractions/`. |
| **`ValidateScopes = false`** | Disabled to work around MediatR DI resolution of scoped services from singleton contexts. |

### Technical Debt & Improvement Opportunities

| Area | Observation | Potential Improvement |
|---|---|---|
| **Test coverage** | Zero test projects exist | Add unit tests for command handlers and integration tests for API endpoints |
| **Static mutable state in helpers** | `RandomCardNumberHelper`, `IabsAccountHelper`, `RandomHumoVariableHelper` use static fields | Use scoped/transient instances or thread-safe patterns |
| **MockServerExtensions size** | 940+ lines of procedural SOAP mock wiring | Extract declarative JSON configs for SOAP mocks or split into per-service extension methods |
| **Unused PostgreSQL** | DB provisioned, migrations run, but no tables | Remove Persistence project or document future intent |
| **No authentication** | Management API is publicly accessible | Add API key or network-level restriction for the `/admin/` endpoints |
| **Hardcoded WireMock port** | Port 81 is hardcoded in `MockServerExtensions.cs` | Move to configuration |
| **`ISuperCache` sync-over-async** | Handlebars helpers call `GetAwaiter().GetResult()` on async cache methods | WireMock's synchronous handler model forces this; consider async Handlebars if supported |
| **Bulk file loading** | All `Mocks/**/*.json` files loaded at startup | Consider lazy loading or categorized loading for faster startup |
