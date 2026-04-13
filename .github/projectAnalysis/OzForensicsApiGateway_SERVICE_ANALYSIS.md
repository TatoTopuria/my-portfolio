# Space.Service.OzForensicsApiGateway — Service Analysis

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

`Space.Service.OzForensicsApiGateway`

### Purpose & Business Problem

This service acts as an **API gateway / reverse proxy** for Oz Forensics — a forensic identity-verification platform. Rather than exposing downstream Oz Forensics APIs directly to consumers, the gateway sits in front of them to centralise authentication, authorization, header propagation, metric collection, and API documentation into one entry point.

### Domain Context (Bounded Context)

The service belongs to the **Onboarding BaaS** (Banking-as-a-Service) domain. It is owned by the `onboarding-baas` team (per `CODEOWNERS`). Within the broader onboarding flow, this gateway handles the **forensic identity verification** sub-domain by proxying requests to one or more downstream Oz Forensics services.

### Key Entities and Domain Models

Because this is a lightweight API gateway — not a data-owning microservice — the domain layer is minimal:

| Artefact | Location | Description |
|---|---|---|
| `ErrorCode` enum | `Domain/Enums/ErrorCode.cs` | Defines service-level error codes (currently only `SERVICE_UNAVAILABLE = 1`). |
| `SharedResources` | `Application/Resources/SharedResources.cs` | Marker class for localisation (`.resx` files in `en-US`, `ru-RU`, `uz-Latn-UZ`). |
| `MobileAppOptions` | `Application/Options/MobileAppOptions.cs` | Configuration POCO holding `LatestVersions` dictionary — used for mobile app version checks. |

The service **does not own persistent entities or database tables**. Its role is to route, secure, and observe traffic to downstream services.

### Main Use Cases / Workflows

1. **Forensics Routing** — Proxy HTTP requests to downstream Oz Forensics services via YARP reverse proxy.
2. **Authentication & Authorization** — Validate bearer tokens using IdentityServer; assign default or anonymous authorization policies per YARP route.
3. **API-Key Access** — Enforce API-key–based access for routes annotated with the `ApiKeys` metadata via the `ApiKeyMiddleware`.
4. **Localization Propagation** — Inject `Accept-Language` header into proxied requests using the current culture.
5. **Health Proxying** — Dynamically register liveness endpoints (`/{clusterId}/health/liveness`) that forward health checks to each downstream YARP cluster.
6. **Metrics** — Expose Prometheus HTTP metrics (`/metrics`) via `prometheus-net`.
7. **Swagger / OpenAPI** — Serve gateway-level Swagger UI in non-production environments.
8. **Header Sanitization** — Strip `traceparent` and `tracestate` headers from outgoing proxy requests.
9. **URL Decoding** — Conditionally decode percent-encoded URL path segments (feature-toggled via `onboarding_ozforensics_url_decoding`).
10. **Maintenance Mode** — Block traffic with a localised maintenance message via `MaintenanceCheckMiddleware<SharedResources>`.

---

## 2. Architecture

### Architectural Pattern

The solution follows **Clean Architecture** with elements from **CQRS** (MediatR is registered), although the gateway nature of the service means the CQRS pipeline is currently dormant — there are no commands, queries, or handlers defined yet. The project structure, dependency flow, and DI registration files are all prepared for a full Clean Architecture + CQRS expansion.

**Justification from code:**

- Four layered projects (Api → Application → Domain, Infrastructure → Application) match Clean Architecture's concentric dependency rule.
- `ApplicationExtensions.cs` registers MediatR with `LoggingBehavior<,>` and `ValidationBehavior<,>` pipeline behaviours — the CQRS plumbing is wired but unused.
- FluentValidation validators are auto-registered from the Application assembly.

### Project Structure Breakdown

```
Space.Service.OzForensicsApiGateway/
├── .github/
│   ├── CODEOWNERS                          # Team ownership definitions
│   ├── instructions/                       # Copilot coding guidelines (7 files)
│   ├── prompts/                            # Copilot prompt definitions
│   ├── skills/                             # Copilot skill definitions (test-expert)
│   └── workflows/                          # GitHub Actions CI/CD pipelines (10 files)
│
├── Space.Service.OzForensicsApiGateway.Api/            # Presentation / Host layer
│   ├── Program.cs                          # Application entry point & host builder
│   ├── ApiExtensions.cs                    # API DI registration + middleware pipeline + YARP config
│   ├── Middlewares/
│   │   └── UrlDecodingMiddleware.cs        # Feature-toggled URL path decoding
│   ├── Properties/launchSettings.json      # Local dev launch profiles
│   └── Dockerfile                          # Container image definition
│
├── Space.Service.OzForensicsApiGateway.Application/    # Application / Use-Case layer
│   ├── ApplicationExtensions.cs            # MediatR, validators, feature toggle, mapping DI
│   ├── Options/
│   │   └── MobileAppOptions.cs             # Mobile app version config POCO
│   └── Resources/
│       ├── SharedResources.cs              # Localization marker class
│       ├── SharedResources.en-US.resx      # English resources
│       ├── SharedResources.ru-RU.resx      # Russian resources
│       └── SharedResources.uz-Latn-UZ.resx # Uzbek (Latin) resources
│
├── Space.Service.OzForensicsApiGateway.Domain/         # Domain layer (minimal)
│   └── Enums/
│       └── ErrorCode.cs                    # Error code enumeration
│
├── Space.Service.OzForensicsApiGateway.Infrastructure/ # Infrastructure layer
│   └── InfrastructureExtensions.cs         # TimeProvider, MemoryCache, HttpClients, SuperCache DI
│
├── Space.Service.OzForensicsApiGateway.UnitTests/      # Unit test project
│   └── Middlewares/
│       └── UrlDecodingMiddlewareTests.cs   # 5 xUnit tests for UrlDecodingMiddleware
│
├── Space.Service.OzForensicsApiGateway.ComponentTests/ # Component / Integration test project
│   ├── CustomWebApplicationFactory.cs      # WebApplicationFactory with auth bypass & ISuperCache mock
│   ├── Fixtures/
│   │   ├── SharedFixtureCollection.cs      # xUnit shared fixture collection
│   │   └── WireMockServerFixture.cs        # WireMock server on port 5980
│   └── Mocks/
│       └── OkResponse.json                 # Stub response for WireMock
│
├── Space.Service.OzForensicsApiGateway.CITools/        # CI utility project
│   └── Program.cs                          # Generates event schemas & API contracts
│
├── tools/                                  # Developer & CI tooling scripts
│   ├── localDevSetup.sh                    # Installs Trivy, copies git hooks
│   ├── codeCoverage/                       # Coverage collection & pre-commit gate
│   ├── hooks/commit-msg                    # Git commit msg format enforcer
│   ├── sonarqube/run-sonar-scan.sh         # SonarQube static analysis
│   ├── stryker/                            # Mutation testing scripts
│   ├── trivy/                              # Secret detection scripts + rules
│   └── zap/rules.tsv                       # ZAP proxy scan rule configuration
│
├── Directory.Build.props                   # Global MSBuild: server GC, nullable enable
├── trivy-secret-config.json                # Trivy file-type & exclude config
└── Space.Service.OzForensicsApiGateway.slnx # Solution file (XML format)
```

### Dependency Flow Direction

```
Domain  ←──  Application  ←──  Infrastructure
                 ↑                    ↑
                 └────── Api ─────────┘
```

| Project | References |
|---|---|
| **Domain** | No project references. Packages: `Space.Service.Common.Logging`, `Common.Exceptions`, `Common.Persistence`. |
| **Application** | → Domain |
| **Infrastructure** | → Application |
| **Api** | → Application, → Infrastructure |

This matches Clean Architecture: inner layers have zero knowledge of outer layers.

### CQRS Status

MediatR is registered in `ApplicationExtensions.cs` with two open pipeline behaviours:

```csharp
cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
```

However, the Application assembly **contains no `Features/` folder, no commands, no queries, and no handlers**. The CQRS infrastructure is scaffolded but dormant — consistent with a gateway that mostly delegates to YARP rather than executing business logic.

### DDD Patterns

Not applicable. The Domain layer contains only a single `ErrorCode` enum. There are no Aggregates, Value Objects, Domain Events, or Repositories because the service does not own a data store.

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Property | Value |
|---|---|
| Runtime | .NET 8.0 |
| Language | C# (latest features enabled) |
| Target framework | `net8.0` |
| Nullable reference types | Enabled globally (`Directory.Build.props`) |
| GC mode | Server GC with `GarbageCollectionAdaptationMode = 1` |

### Primary Frameworks

| Framework | Version | Role |
|---|---|---|
| ASP.NET Core 8.0 | `net8.0` SDK `Microsoft.NET.Sdk.Web` | Web host, routing, controllers |
| YARP (Yet Another Reverse Proxy) | `2.3.0` | Core reverse proxy engine |
| MediatR | via `Space.Service.Common.Mediator 1.0.137` | CQRS mediator (scaffolded, not actively used) |

### Significant NuGet Packages

#### Api Project

| Package | Version | Role |
|---|---|---|
| `Yarp.ReverseProxy` | 2.3.0 | Reverse proxy routing, transforms, load balancing |
| `Space.Service.Common.Auth` | 1.0.56 | IdentityServer JWT authentication & authorization |
| `Space.Service.Common.Middlewares` | 1.0.143 | Standard middleware suite (error handling, correlation, etc.) |
| `Space.Service.Common.ApiGatewayMiddlewares` | 1.0.27 | API gateway–specific middlewares (`ApiKeyMiddleware`, `ElasticApmTransactionGroupingMiddleware`, `MaintenanceCheckMiddleware`) |
| `Space.Service.Common.HealthChecks` | 1.0.131 | Health check registration and middleware |
| `Space.Service.Common.Swagger` | 1.0.136 | Swagger/OpenAPI UI generation |
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus HTTP request metrics + `/metrics` endpoint |
| `Microsoft.VisualStudio.Azure.Containers.Tools.Targets` | 1.22.1 | Docker tooling integration |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |
| `Space.Service.Common.CodeAnalyzers` | 1.0.54 | Custom Roslyn analyzers (e.g. `SensitiveDataAnalyzer`) |

#### Application Project

| Package | Version | Role |
|---|---|---|
| `Space.Service.Common.Mediator` | 1.0.137 | MediatR + pipeline behaviours (`LoggingBehavior`, `ValidationBehavior`) |
| `Space.Service.Common.Mapping` | 1.0.61 | Object mapping utilities |
| `Space.Service.Common.RestClient` | 1.0.196 | RestEase-based typed HTTP client factory |
| `Space.Service.Common.Exceptions` | 1.0.120 | Standardised exception types |
| `Space.Service.Common.FeatureToggle` | 1.0.129 | Feature flag evaluation |
| `Space.Service.Common.Caching` | 2.0.73 | SuperCache (distributed caching abstraction) |
| `Space.Service.Common.Factory` | 1.0.89 | Tenant-specific service factory |
| `Space.Service.Common.Misc` | 1.0.295 | Utility extensions, `RequestMetadata`, etc. |
| `FluentValidation` | (transitive via Mediator) | Request validation |

#### Domain Project

| Package | Version | Role |
|---|---|---|
| `Space.Service.Common.Logging` | 1.0.110 | `[SensitiveData]` attribute, structured logging utilities |
| `Space.Service.Common.Exceptions` | 1.0.120 | Base exception types |
| `Space.Service.Common.Persistence` | 1.0.89 | Entity base classes (`EntityBase<T>`, `ITrackedEntity`) |

#### Infrastructure Project

| Package | Version | Role |
|---|---|---|
| `Microsoft.Extensions.Caching.Memory` | 8.0.1 | In-memory cache |
| `Microsoft.Extensions.DependencyInjection.Abstractions` | 8.0.2 | DI abstractions |

### Database & ORM

**None.** This service has no database, no `DbContext`, no EF Core migrations, and no Persistence project. It is a stateless API gateway.

### Caching Layer

| Type | Implementation | Registration |
|---|---|---|
| In-memory cache | `Microsoft.Extensions.Caching.Memory` (`AddMemoryCache()`) | `InfrastructureExtensions.cs` |
| Distributed / SuperCache | `Space.Service.Common.Caching` (`AddSuperCache(configuration)`) | `InfrastructureExtensions.cs` |

### Logging & Observability

| Concern | Library | Registration Location |
|---|---|---|
| Structured logging | **Serilog** (`UseSerilog()`) | `Program.cs` |
| APM / Distributed tracing | **Elastic APM** (via `AddApm()`, `ElasticApmTransactionGroupingMiddleware`) | `Program.cs`, `ApiExtensions.cs` |
| Metrics | **prometheus-net** 8.2.1 (`UseHttpMetrics()`, `MapMetrics()`) | `ApiExtensions.cs` |
| Code coverage | **Coverlet** (msbuild + collector) | Test `.csproj` files |

---

## 4. API Layer & Communication

### API Style

**Reverse Proxy (YARP)** — This is primarily a proxy gateway, not a traditional REST API. YARP routes are loaded from the `ReverseProxy` configuration section. The service also registers MVC controllers (via `AddControllers()` / `MapControllers()`), though no custom controllers are present in the codebase.

### Exposed Endpoints / Operations

| Endpoint Pattern | Method | Source | Purpose |
|---|---|---|---|
| YARP proxy routes | ALL | `configuration.GetSection("ReverseProxy")` | Forwarded to downstream Oz Forensics clusters |
| `/{clusterId}/health/liveness` | GET | Dynamically generated per YARP cluster in `ApiExtensions.AddHealthChecks()` | Proxies liveness checks to each downstream service |
| `/health/liveness` (+ readiness) | GET | `Space.Service.Common.HealthChecks` | Gateway's own health endpoints |
| `/metrics` | GET | `prometheus-net` via `MapMetrics()` | Prometheus scrape endpoint |
| `/swagger` | GET | `Space.Service.Common.Swagger` (non-production only) | OpenAPI documentation UI |
| Version endpoint | GET | `UseVersionEndpoint(configuration)` | Returns service version info |

> **Note:** No custom `ApiController` classes exist in the codebase. All business traffic is handled by YARP proxy routes.

### Request/Response Patterns

- YARP transparently proxies request/response bodies — no DTOs or envelope patterns are applied at the gateway level.
- The dynamically-generated health proxy endpoint reads upstream JSON and re-serialises it via `System.Text.Json` (`JsonDocument` → `Utf8JsonWriter`).

### API Versioning Strategy

API versioning is registered via `services.AddVersioning()` (from `Space.Service.Common.Swagger`) and an `IApiVersionDescriptionProvider` is resolved in `Program.cs`. However, since there are no local controllers, versioning applies only to the Swagger UI grouping of any future endpoints.

### Authentication & Authorization

| Mechanism | Details |
|---|---|
| **IdentityServer JWT** | `services.AddIdentityServerAuthentication(configuration)` — validates bearer tokens against an IdentityServer instance. |
| **Default policy** | YARP routes without an explicit `AuthorizationPolicy` are assigned `"Default"` (requires authentication). |
| **Anonymous policy** | Routes with `Metadata["ApiKeys"]` are set to `"Anonymous"` authorization and instead go through `ApiKeyMiddleware`. |
| **API Key middleware** | `ApiKeyMiddleware` runs inside the YARP pipeline (`MapReverseProxy(proxyPipeline => { proxyPipeline.UseMiddleware<ApiKeyMiddleware>(); })`). |
| **Data Protection** | `services.AddDataProtection(configuration)` — configures ASP.NET Core Data Protection (key storage, encryption). |

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline (in registration order)

The pipeline is defined in `ApiExtensions.ConfigureAPI()`:

```
1.  UsePathBase(pathBase)                       — Strips configured path base (e.g. /ozforensicsapigateway)
2.  UseLocalization(defaultCultureInfoName)      — Sets request culture from Accept-Language header
3.  UseHttpsRedirection()                        — Redirects HTTP → HTTPS
4.  UseMiddleware<UrlDecodingMiddleware>()        — Feature-toggled URL percent-decoding
5.  UseRouting()                                 — Enables endpoint routing
6.  UseHttpMetrics()                             — Prometheus HTTP request metrics
7.  UseAuthentication()                          — JWT bearer token validation
8.  UseStaticFiles()                             — Serves static content (Swagger UI assets)
9.  UseMiddleware<ElasticApmTransactionGroupingMiddleware>()  — Groups YARP routes for APM
10. UseAuthorization()                           — Policy-based authorization evaluation
11. UseMiddlewares()                             — Common platform middlewares (error handling, correlation ID, etc.)
12. UseHealthCheckMiddleware(env)                — Health check endpoints
13. UseMiddleware<MaintenanceCheckMiddleware<SharedResources>>() — Maintenance mode gate
14. UseVersionEndpoint(configuration)            — Version info endpoint
15. MapControllers()                             — MVC controller endpoints
16. MapMetrics()                                 — Prometheus /metrics endpoint
17. MapReverseProxy(pipeline => {                — YARP reverse proxy
        pipeline.UseMiddleware<ApiKeyMiddleware>()  — API key validation inside proxy pipeline
    })
```

### MediatR Pipeline Behaviours

Registered in `ApplicationExtensions.cs` (execution order):

1. **`LoggingBehavior<TRequest, TResponse>`** — Logs request/response with sensitive data masking.
2. **`ValidationBehavior<TRequest, TResponse>`** — Runs FluentValidation validators before handler execution.

> These behaviours are wired but currently unused since no MediatR handlers exist.

### Global Exception/Error Handling

Handled by `UseMiddlewares()` from `Space.Service.Common.Middlewares` — this platform package typically registers exception-handling middleware that catches unhandled exceptions, logs them via Serilog, and returns standardised error responses.

### Request Validation

- **FluentValidation** validators are auto-discovered from the Application assembly: `services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly())`.
- The built-in ASP.NET model state filter is **suppressed**: `options.SuppressModelStateInvalidFilter = true` — validation is delegated to the MediatR `ValidationBehavior`.

### Correlation ID / Request Tracing

- `UseMiddlewares()` from `Space.Service.Common.Middlewares` propagates correlation IDs.
- YARP transforms explicitly **remove** `traceparent` and `tracestate` headers from proxied requests to prevent trace context leaking.
- A fresh `DistributedContextPropagator.CreateDefaultPropagator()` is configured on the YARP `HttpClientHandler` to re-establish proper W3C trace context for outgoing proxy calls.

---

## 6. Data Layer

**Not applicable.** This service is a stateless API gateway with no database. There is no Persistence project, no `DbContext`, no EF Core migrations, and no repositories. All data persistence is handled by the downstream services that YARP proxies to.

---

## 7. Messaging & Event Handling

**Not applicable.** The service does not publish or consume any messages. There is no message broker integration (no RabbitMQ, Kafka, Azure Service Bus, or MassTransit packages). The `CITools` project has schema generation capability (`EventsSchemaGenerator`, `ContractsGenerator`), but no actual events are defined in any of the source projects.

---

## 8. Background Jobs & Scheduled Tasks

**Not applicable.** No `IHostedService`, `BackgroundService`, `PeriodicBackgroundServiceBase`, or `CronBackgroundServiceBase` implementations exist. The Infrastructure layer has no `Workers/` folder despite the architectural template providing for one.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

| Aspect | Details |
|---|---|
| Framework | **Serilog** — configured via `UseSerilog(builder.Services, builder.Configuration)` in `Program.cs` |
| Structured logging | Yes — via Serilog's structured log templates |
| Sensitive data protection | `[SensitiveData]` attribute masks PII in log serialisation; enforced by `Space.Service.Common.Logging` |
| MediatR logging | `LoggingBehavior<,>` logs all command/query requests and responses |

### Health Checks

| Check | Endpoint | Source |
|---|---|---|
| Gateway liveness | `/health/liveness` | `Space.Service.Common.HealthChecks` |
| Gateway readiness | `/health/readiness` | `Space.Service.Common.HealthChecks` |
| Downstream cluster liveness | `/{clusterId}/health/liveness` | Custom dynamic registration in `ApiExtensions.AddHealthChecks()` |

The downstream health proxy iterates over all YARP clusters, strips the "Api" suffix from the cluster ID, and creates a passthrough endpoint that fetches the downstream liveness response and re-serialises it.

### Rate Limiting / Throttling

Not explicitly configured in this service. No `AddRateLimiter()` or `UseRateLimiter()` calls are present.

### Resilience Patterns

- **Kestrel rate limiting**: `MinRequestBodyDataRate` is set to 50 bytes/second with a 15-second grace period to prevent slow-loris attacks.
- **Thread pool tuning**: `ThreadPool.SetMinThreads(100, 100)` ensures adequate thread availability under load.
- No Polly-based retry, circuit breaker, or timeout policies are configured on outgoing HTTP calls (the YARP `HttpClient` uses default settings).

### Configuration Management

| Source | Details |
|---|---|
| `appsettings.json` | Standard ASP.NET Core configuration (loaded in non-local via `/settings/appsettings.json`) |
| `globalsettings.json` | Shared org-wide settings (loaded from `/settings/globalsettings.json` in non-local environments) |
| `appsettings.Local.json` | Local development overrides (excluded from CI triggers) |
| Environment variables | `ASPNETCORE_ENVIRONMENT`, `PATH_BASE` |
| Configuration reload | `builder.Configuration.Watch(settingsFilePaths)` — hot-reload enabled for mounted config files |
| Feature toggles | `Space.Service.Common.FeatureToggle` — used by `UrlDecodingMiddleware` (`onboarding_ozforensics_url_decoding`) |
| Options pattern | `services.Configure<MobileAppOptions>(configuration.GetSection(nameof(MobileAppOptions)))` |

---

## 10. Testing

### Test Projects

| Project | Type | Framework |
|---|---|---|
| `Space.Service.OzForensicsApiGateway.UnitTests` | Unit tests | xUnit 2.9.2 |
| `Space.Service.OzForensicsApiGateway.ComponentTests` | Component / Integration tests | xUnit 2.9.2 + `WebApplicationFactory` |

### Testing Frameworks & Libraries

| Library | Version | Role |
|---|---|---|
| **xUnit** | 2.9.2 | Test framework |
| **FluentAssertions** | 6.12.2 | Assertion library |
| **NSubstitute** | 5.3.0 | Mocking framework |
| **AutoFixture** | 4.18.1 | Test data generation |
| **WireMock.Net** | 1.5.47 | HTTP service stubbing (component tests) |
| **RichardSzalay.MockHttp** | 7.0.0 | `HttpMessageHandler` mocking (unit tests) |
| **Serilog.Sinks.TestCorrelator** | 4.0.0 | Log assertion in tests |
| **Coverlet** | 6.0.2 (msbuild + collector) | Code coverage collection |
| **Microsoft.AspNetCore.Mvc.Testing** | 8.0.11 | `WebApplicationFactory` for in-process API testing |
| **XunitXml.TestLogger** | 6.1.0 | XML test result output |
| **GitHubActionsTestLogger** | 2.4.1 | GitHub Actions test reporting |

### Mocking Strategy

- **Unit tests**: Use `NSubstitute` for interface mocking (e.g., `IFeatureToggle`) and `RichardSzalay.MockHttp` for HTTP handler mocking. Inline `ServiceCollection` setup for DI in test contexts.
- **Component tests**: Use `CustomWebApplicationFactory<Program>` which:
  - Replaces the real `IAuthorizationHandler` with `TestAllowAnonymous` (bypasses all auth).
  - Substitutes `ISuperCache` with an NSubstitute mock.
  - Loads a test-specific `appsettings.json` and forces `"Local"` environment.

### Notable Test Patterns

| Pattern | Location | Details |
|---|---|---|
| `WebApplicationFactory<Program>` | `CustomWebApplicationFactory.cs` | Full in-process API hosting for component tests |
| WireMock fixture | `WireMockServerFixture.cs` | Shared `WireMockServer` on port 5980 via `IDisposable` |
| xUnit shared fixtures | `SharedFixtureCollection.cs` | `ICollectionFixture<CustomWebApplicationFactory<Program>>` + `ICollectionFixture<WireMockServerFixture>` |
| AAA pattern | `UrlDecodingMiddlewareTests.cs` | Arrange/Act/Assert with descriptive naming `MethodName_Condition_ExpectedResult` |

### Current Test Coverage

The unit test project contains **5 tests** in `UrlDecodingMiddlewareTests.cs`:

1. `InvokeAsync_FlagOnAndEncodedPath_DecodesSlashes`
2. `InvokeAsync_FlagOnAndNoEncoding_PathUnchanged`
3. `InvokeAsync_FlagOnAndMixedEncoding_DecodesAllEncodedCharacters`
4. `InvokeAsync_FlagOff_PathNotModified`
5. `InvokeAsync_FlagOnAndEncodedPath_QueryStringPreserved`

---

## 11. DevOps & Deployment

### Dockerfile Analysis

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0        # Single-stage; runtime-only base image
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt
COPY ./ca_cert_es.pem /usr/local/share/ca-certificates/ca_cert_es.crt
RUN update-ca-certificates --verbose             # Trust internal CA certs (Kafka, Elasticsearch)
COPY app/publish  .                              # Pre-built publish output
ENV ASPNETCORE_HTTP_PORTS=80
ENTRYPOINT ["dotnet", "Space.Service.OzForensicsApiGateway.Api.dll"]
```

**Key observations:**
- **Single-stage**: The build happens externally (in CI) — the Dockerfile only packages the published output.
- **Custom CA certificates**: Three internal CA certs are installed (general, Kafka, Elasticsearch) for mTLS communication.
- **Port 80**: The container listens on port 80 (HTTP); HTTPS termination is handled by the infrastructure (ingress/load balancer).

### CI/CD Pipeline Files

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci-cd.yaml` | Push to `master` | Full CI/CD: build, test, publish Docker image, deploy through environments (`dev-uz` → `prod-uz`) via ArgoCD. Includes Pact contract testing. |
| `cd.yaml` | Manual dispatch | Deploy a specific version to a chosen environment (`dev-uz`, `automation-uz`, `qa-uz`, `preprod-uz`, `prod-uz`). |
| `pull-request.yaml` | Pull request | Build, test, Pact contract verification. |
| `stryker.yaml` | Scheduled daily (18:19 UTC) + manual | Mutation testing via Stryker. |
| `zaproxy.yaml` | Scheduled weekly (Mon 00:49 UTC) + manual | OWASP ZAP security scan against the service path `/ozforensicsapigateway`. |
| `update-packages.yaml` | Manual dispatch | Auto-upgrade `Space.Service.Common.*` NuGet packages with optional CI/CD trigger. |
| `generate-readme.yaml` | Scheduled weekly (Fri 23:51 UTC) + manual | Auto-generate README from metadata. |
| `notify.yaml` | Called by other workflows | Slack notification for deployment success/failure. |
| `dora.yaml` | Called by other workflows | DORA metrics recording. |
| `assign-copilot.yaml` | Issue opened/edited/labeled | Auto-assign GitHub Copilot to issues. |

All workflows delegate to reusable workflows in `SpaceBank/Space.Service.Workflows`.

### Deployment Environments

```
dev-uz → automation-uz → qa-uz → preprod-uz → prod-uz
```

Deployment is managed by **ArgoCD** (`argocd_app_name: space-service-ozforensicsapigateway`). Docker image name: `space-service-ozforensicsapigateway`.

### Environment-Specific Configuration

- Non-local environments load configs from mounted paths: `/settings/globalsettings.json` and `/settings/appsettings.json`.
- Local environment uses `appsettings.Local.json` with auto-copy to output directory.
- Environment detection via `builder.Environment.IsLocal()` helper from `Space.Service.Common.Misc.Utils`.

---

## 12. External Service Dependencies

### HTTP Clients

The `InfrastructureExtensions.AddHttpClients()` method is **currently empty** — no named or typed HTTP clients are registered for external service communication:

```csharp
private static IServiceCollection AddHttpClients(this IServiceCollection services, IConfiguration configuration)
{
    return services;
}
```

### YARP Reverse Proxy Destinations

All external communication happens through YARP. Cluster destinations are loaded from configuration (`ReverseProxy` section) at runtime. The `AddHealthChecks()` method in `ApiExtensions.cs` iterates `proxyConfig.Clusters` to dynamically create health passthrough endpoints, confirming that downstream services are configured via YARP.

### Other HTTP Communication

- The dynamically-generated health proxy endpoints use `IHttpClientFactory` (registered via `services.AddHttpClient()`) to make ad-hoc `GET` calls to downstream liveness endpoints.
- `IAppVersionCheckService` is registered as a singleton — likely used for mobile app version-check logic.

### Resilience Policies on Outgoing Calls

No explicit Polly or resilience policies are configured on the YARP `HttpClient` or the `IHttpClientFactory`. YARP's built-in retry/timeout/circuit-breaker settings would need to be configured in the `ReverseProxy` configuration section.

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Table

| Pattern | Where It's Used | Why |
|---|---|---|
| **YARP Reverse Proxy** | `ApiExtensions.cs` — `AddReverseProxy()`, `MapReverseProxy()` | Core purpose: route traffic to Oz Forensics services without exposing them directly |
| **Clean Architecture** | Solution structure (Api → Application → Domain ← Infrastructure) | Organisation standard; enforces dependency inversion |
| **CQRS + MediatR** | `ApplicationExtensions.cs` — `AddMediatR()` with behaviours | Scaffolded for future feature expansion; currently unused |
| **Feature Toggles** | `UrlDecodingMiddleware` — `IFeatureToggle.IsOn()` | Safely roll out URL decoding behaviour per environment |
| **Gateway Swagger** | `UseGatewaySwagger()` (non-production only) | API documentation for proxied routes |
| **Dynamic Health Proxying** | `ApiExtensions.AddHealthChecks()` | Exposes downstream health through the gateway without manual endpoint definitions |
| **Header Sanitization** | YARP transforms — `AddRequestHeaderRemove("traceparent"/"tracestate")` | Prevents upstream trace context from polluting downstream spans |
| **Localization Propagation** | YARP request transform — `Add("Accept-Language", CultureInfo.CurrentCulture.Name)` | Ensures downstream services respect the client's locale |
| **Authorization Policy Assignment** | YARP transform — reflection-based `AuthorizationPolicy` setter | Programmatically enforce "Default" or "Anonymous" policy on proxy routes |
| **Maintenance Mode** | `MaintenanceCheckMiddleware<SharedResources>` | Gate traffic with localised maintenance messages |
| **Prometheus Metrics** | `UseHttpMetrics()`, `MapMetrics()`, `SetPrometheusStaticLabels()` | Standardised observability for Kubernetes monitoring |
| **Commit Message Enforcement** | `tools/hooks/commit-msg` | Git hook validates `<JIRA-ID> \| message \| <author>` format |
| **Mutation Testing** | Stryker via `tools/stryker/` and `stryker.yaml` | Ensures test quality by running automated mutation testing |
| **Secret Scanning** | Trivy via `tools/trivy/` | Pre-commit and CI secret leak detection |
| **DAST Scanning** | ZAP via `tools/zap/` and `zaproxy.yaml` | Weekly OWASP ZAP dynamic security testing |

### Notable Deviations from Conventions

| Observation | Details |
|---|---|
| **No controllers** | Despite `AddControllers()` and `MapControllers()` being registered, there are no controller classes. All routing is done via YARP. |
| **No Persistence project** | The architectural template provides for one, but this gateway has no database — appropriately omitted. |
| **Reflection for YARP auth policy** | `ApiExtensions.cs` uses `GetType().GetProperty("AuthorizationPolicy")` to set the authorization policy on YARP routes via reflection, bypassing the immutable `RouteConfig` API. This is a workaround for a YARP limitation. |
| **Empty `AddHttpClients()`** | The method exists but registers nothing — placeholder for future external service integrations. |
| **MediatR registered but unused** | Full MediatR pipeline is wired (logging + validation behaviours), but no handlers or commands exist. |
| **`ValidateScopes = false`** | Scope validation is disabled (`options.ValidateScopes = false`) with a comment "Needed for Mediator DI" — this weakens DI safety and may mask lifetime mismatches. |

### Technical Debt & Improvement Opportunities

| Area | Observation |
|---|---|
| **YARP auth policy reflection hack** | Setting `AuthorizationPolicy` via reflection on `RouteConfig` is fragile. Consider using YARP's `IProxyConfigFilter` or `ITransformProvider` for a supported approach. |
| **No resilience on YARP HttpClient** | No retry, circuit breaker, or timeout policies on the proxy HTTP client. A downstream outage would propagate immediately. Consider adding Polly policies or YARP's built-in health checking and retry. |
| **Health proxy does not handle errors** | `AddHealthChecks()` makes raw HTTP calls to downstream liveness endpoints without try/catch. A failed downstream call will result in an unhandled exception. |
| **Health proxy creates HttpClient per request** | Uses `IHttpClientFactory.CreateClient()` per health request, which is correct for socket management, but the endpoint could benefit from caching or a short-circuit on repeated failures. |
| **Unused MediatR infrastructure** | Consider removing MediatR, FluentValidation, and related packages if the gateway will remain a pure proxy — reduces startup overhead and package surface. |
| **`ValidateScopes = false`** | Re-evaluate whether scope validation can be re-enabled to catch DI lifetime bugs. |
| **Limited test coverage** | Only 5 unit tests exist (for `UrlDecodingMiddleware`). Component tests have the infrastructure but no test classes. The YARP configuration, auth policy assignment, and health proxy logic are untested. |
| **Single-stage Dockerfile** | The build is done externally, but a multi-stage Dockerfile would make the image self-buildable and more portable. |
| **Localization resources are template defaults** | The `.resx` files contain only the Visual Studio template example entries (`Name1`, `Color1`, `Bitmap1`, `Icon1`), not actual service-specific translations. |
