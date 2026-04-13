# Space.Service.ApiGateway — Comprehensive Service Analysis

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

### Service Name

**Space.Service.ApiGateway**

### Purpose & Core Business Problem

Central API Gateway for the **Space Neobank** mobile banking platform. It acts as the single entry point for all client-facing traffic, aggregating, orchestrating, and proxying requests to downstream microservices. The gateway solves the problem of:

- **Unified authentication & authorization** — every mobile client request is authenticated via IdentityServer before reaching backend services.
- **Cross-cutting policy enforcement** — maintenance mode, version checks, required headers, localization, and feature toggling are applied in one place rather than duplicated across dozens of microservices.
- **Backend-for-Frontend (BFF) orchestration** — several endpoints compose data from multiple services into a single response (e.g., agreements from Identity, Customer, Loyalty, Referral, and PremiumSubscription; credit card overview combining CreditCard + RevolvingCard state).
- **Reverse-proxy routing** — via YARP, the gateway transparently forwards traffic to 13+ downstream services for operations that don't require orchestration.

### Domain Context

The service represents the **API Gateway / BFF bounded context**. It does not own any persistent domain data. Instead, it owns the **composition and routing logic** that presents a unified mobile API surface to clients. It sits at the boundary between external consumers (mobile apps, CRM systems) and the internal microservice landscape.

### Key Entities & Domain Models

The gateway does not own persistent entities. Its domain model consists of:

| Model | Purpose |
|-------|---------|
| `SessionType` | Enum for liveness session types (Onboarding, RecoverPasscode, etc.) |
| `UserType` | Enum classifying users by device trust and card status |
| `OnboardingFlags` | Flags enum tracking registration, identification, KYC, and current-account completion |
| `OnboardingFlowType` | Enum for onboarding flow variants (OpenAccount, CreateCard, etc.) |
| `ErrorCode` | Enum for gateway-specific error codes (SERVICE_UNAVAILABLE, ELIGIBLE_FOR_CREDIT_CARD, RECIPIENT_USER_NOT_FOUND, etc.) |
| `ApplicationStatus` | Credit card application lifecycle states |
| `ApplicationLimitStatus` | Credit card limit states |
| `DueStatus` | Due payment status (StatementGenerated, OverdueSoon, Overdue) |
| `CardProductCode` | Card product code enum |

### Main Use Cases & Workflows

| Use Case | Description |
|----------|-------------|
| **Agreement Aggregation** | Fetches agreements from Identity, Customer, Loyalty, Referral, and PremiumSubscription services in parallel; merges into a single list |
| **Credit Card Orchestration** | Combines CreditCard and RevolvingCard data for overview, details, product info, widget, and CRM endpoints; applies overdue logic and balance adjustments |
| **Customer Onboarding** | Creates customers in Customer service, optionally creates identity records and refreshes tokens behind feature toggles |
| **Loan Eligibility Check** | Calls CashLoan eligibility (V1/V2 via feature toggle); interprets problem details to redirect to credit card or reject |
| **Session & Liveness** | Authorizes liveness sessions and face-comparison via Verification service; validates JWT claims for passcode recovery; triggers untrusted-device verification |
| **Transfer Recipient Lookup** | Resolves recipient info by phone number, aggregating cards/accounts from Transfer, RevolvingCard, Card, AttachedCard, and CurrentAccount services |
| **User Flags & Settings** | Builds onboarding flags from KYC, CurrentAccount, and Customer data; returns app configuration settings |
| **Feature Toggles** | Proxies feature toggle values with ETag-based caching and 304 support |
| **Home Products** | Combines home products with installment status to filter product catalog |
| **Revolving Card Renewal** | Validates overdue state before forwarding card renewal requests |
| **Reverse-Proxy Routing** | Transparently proxies 80+ routes to 13 downstream services via YARP |

---

## 2. Architecture

### Architectural Pattern

**Clean Architecture with CQRS (via MediatR)** — justified by the project structure and dependency flow:

- The solution separates concerns into four core projects (`Domain`, `Application`, `Infrastructure`, `Api`) with strict dependency direction.
- The `Application` layer uses MediatR with explicit Command/Query separation enforced by architecture tests.
- The `Domain` layer has zero dependencies on other layers (enforced by `ArchitectureTests.Domain_ShouldNotDependOnAnyLayer()`).
- The `Api` layer does not depend on `Domain` directly (enforced by `ArchitectureTests.Api_ShouldNotDependOnDomain()`).
- The `Application` layer does not depend on `Infrastructure` (enforced by `ArchitectureTests.Application_ShouldNotDependOnInfrastructure()`).

### Project Structure Breakdown

```
Space.Service.ApiGateway/
├── Space.Service.ApiGateway.Api/              # Presentation layer
│   ├── Controllers/                           # REST controllers (thin, mediator-dispatching)
│   │   └── V2/                                # Versioned controllers
│   ├── Properties/                            # Launch settings
│   ├── yarpsettings.*.json (×13)              # YARP reverse-proxy route configs
│   ├── ApiExtensions.cs                       # Service + middleware registration
│   ├── Program.cs                             # Composition root
│   └── Dockerfile
│
├── Space.Service.ApiGateway.Application/      # Application / Use-case layer
│   ├── Features/                              # Vertical slices (Command/Query + Handler + Validator + DTOs)
│   │   ├── Agreement/                         # Agreement aggregation
│   │   ├── CashLoan/                          # Loan eligibility
│   │   ├── CreditCard/                        # Credit card orchestration (8 sub-features)
│   │   ├── Customer/                          # Customer create/update/profile
│   │   ├── FeatureToggle/                     # Feature toggle queries
│   │   ├── Home/                              # Product listing
│   │   ├── RevolvingCard/                     # Card renewal
│   │   ├── Session/                           # Liveness session management (4 sub-features)
│   │   ├── Transfer/                          # Recipient lookup
│   │   └── User/                              # User flags & settings
│   ├── HttpClients/                           # Interface definitions for external service calls
│   │   ├── AttachedCard/                      # IAttachedCardServiceClient
│   │   ├── Card/                              # ICardServiceClient
│   │   ├── CashLoan/                          # ICashLoanServiceClient
│   │   ├── CreditCard/                        # ICreditCardServiceClient
│   │   ├── CurrentAccount/                    # ICurrentAccountServiceClient
│   │   ├── Customer/                          # ICustomerServiceClient
│   │   ├── Home/                              # IHomeServiceClient
│   │   ├── Identity/                          # IIdentityServiceClient
│   │   ├── Installment/                       # IInstallmentServiceClient
│   │   ├── Kyc/                               # IKycServiceClient
│   │   ├── Loyalty/                           # ILoyaltyServiceClient
│   │   ├── PremiumSubscription/               # IPremiumSubscriptionServiceClient
│   │   ├── Referral/                          # IReferralServiceClient
│   │   ├── RevolvingCard/                     # IRevolvingCardClient
│   │   ├── Transfer/                          # ITransferClient
│   │   ├── Verification/                      # IVerificationServiceClient
│   │   └── Shared/                            # Shared DTOs (widgets, cards by phone)
│   ├── Constants/                             # Feature toggle string constants
│   ├── Options/                               # Strongly-typed configuration classes
│   └── Resources/                             # Localization .resx files (en-US, ru-RU, uz-Latn-UZ)
│
├── Space.Service.ApiGateway.Domain/           # Domain layer (enums, shared types)
│   └── Enums/                                 # SessionType, UserType, ErrorCode, etc.
│       ├── Card/
│       ├── CreditCard/
│       ├── Customer/
│       └── User/
│
├── Space.Service.ApiGateway.Infrastructure/   # Infrastructure layer (DI wiring for HTTP clients & cache)
│   └── InfrastructureExtensions.cs
│
├── Space.Service.ApiGateway.UnitTests/        # Unit tests
│   ├── API/Controllers/                       # Controller tests
│   ├── Application/Features/                  # Handler + validator tests
│   └── Fixtures/                              # Shared test fixtures
│
├── Space.Service.ApiGateway.ComponentTests/   # Component / integration tests
│   ├── Controllers/                           # Full HTTP pipeline tests
│   ├── Features/                              # Feature-level integration tests
│   ├── Middlewares/                            # Middleware tests
│   ├── Mocks/                                 # WireMock configurations
│   └── Fixtures/                              # Test fixtures
│
├── Space.Service.ApiGateway.ArchitectureTests/ # Architecture fitness tests (NetArchTest)
│
├── Space.Service.ApiGateway.CITools/          # CI tooling (contract + event schema generation)
│
└── tools/                                     # Dev tooling scripts
    ├── codeCoverage/                          # Coverage scripts
    ├── hooks/                                 # Git hook (commit-msg)
    ├── sonarqube/                             # SonarQube scan script
    ├── stryker/                               # Mutation testing scripts
    ├── trivy/                                 # Secret scanning
    └── zap/                                   # OWASP ZAP rules
```

### Dependency Flow

```
Api → Application → Domain
Infrastructure → Application → Domain
```

- **Api** references `Application` and `Infrastructure` (for DI wiring).
- **Application** references `Domain` only.
- **Infrastructure** references `Application` (to resolve client interfaces) and `Domain`.
- **Domain** references no other project (pure enums and types).
- Architecture tests enforce: Controllers ✗ Domain, Controllers ✗ Infrastructure, Api ✗ Domain, Application ✗ Infrastructure, Domain ✗ any layer.

### CQRS & Mediator Usage

All features follow the CQRS pattern via **MediatR**:

- **Commands** (state-changing): `CreateCustomerCommand`, `CreateCustomerNonResidentCommand`, `UpdateCustomerProfileCommand`, `CheckLoanOfferCommand`, `RevolvingCardRenewAsyncCommand`, `AuthorizeCommand`, `AuthorizeV2Command`, `CompareFaceCommand`, `CompareFaceV2Command`
- **Queries** (read-only): `GetAgreementsQuery`, `AgreementQuery`, `CreditCardQuery`, `CreditCardV2Query`, `CreditCardOverviewQuery`, `CreditCardOverviewV2Query`, `CreditCardProductQuery`, `CreditCardWidgetQuery`, `CreditCardCrmQuery`, `CustomerProfileQuery`, `GetFeatureTogglesQuery`, `GetFeatureToggleDefaultValuesQuery`, `ProductsQuery`, `RecipientInfoQuery`, `UserFlagsQuery`, `UserSettingsQuery`

All handlers inherit from `RequestHandlerBase<TRequest, TResponse>` (from `Space.Service.Common.Mediator`).

**Pipeline behaviors** (registered in order in `ApplicationExtensions.cs`):
1. `LoggingBehavior<,>` — logs request/response
2. `ValidationBehavior<,>` — runs FluentValidation validators before handler execution

### DDD Patterns

This service uses a **lightweight domain model** (enum-heavy, no Aggregates, no Domain Events, no Repositories). The Domain layer contains only enums and value-type definitions. This is appropriate for a BFF/Gateway that doesn't own persistent state.

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Item | Value |
|------|-------|
| Runtime | **.NET 9.0** |
| Language | **C# (latest)** |
| GC | Server GC with Adaptive Mode 1 (`Directory.Build.props`) |

### Primary Frameworks

| Framework | Version | Role |
|-----------|---------|------|
| ASP.NET Core | 9.0 | Web framework |
| YARP (Yet Another Reverse Proxy) | 2.3.0 | Reverse-proxy routing |
| MediatR | via `Space.Service.Common.Mediator` 2.9.9 | CQRS mediator |
| FluentValidation | via `Space.Service.Common.Mediator` | Request validation |
| AutoMapper | via `Space.Service.Common.Mapping` 2.9.2 | Object mapping |
| RestEase | via `Space.Service.Common.RestClient` 2.9.24 | Declarative HTTP client interfaces |

### Significant NuGet Packages

| Package | Version | Role |
|---------|---------|------|
| `Space.Service.Common.Auth` | 2.9.10 | IdentityServer authentication |
| `Space.Service.Common.Middlewares` | 2.9.13 | Shared middleware pipeline |
| `space.service.common.apigatewaymiddlewares` | 2.9.25 | Gateway-specific middlewares (version check, maintenance, API key, required headers) |
| `Space.Service.Common.HealthChecks` | 2.9.11 | Health check endpoints |
| `Space.Service.Common.Swagger` | 2.9.14 | Swagger/OpenAPI generation |
| `Space.Service.Common.Caching` | 2.9.19 | SuperCache (Redis + in-memory) |
| `space.service.common.featuretoggle` | 2.9.17 | Feature toggle integration |
| `Space.Service.Common.Logging` | 2.9.10 | Serilog structured logging + sensitive data masking |
| `Space.Service.Common.Exceptions` | 2.9.10 | Shared exception types (`AppException`) |
| `Space.Service.Common.Misc` | 2.9.77 | Utilities (JWT, encryption, `RequestMetadata`, etc.) |
| `Space.Service.Common.Factory` | 2.9.10 | Factory patterns |
| `space.service.common.transactions` | 2.9.21 | Transaction support |
| `Space.Service.Common.RestClient` | 2.9.24 | Typed HTTP client registration via RestEase |
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus metrics |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement |
| `Space.Service.Common.CodeAnalyzers` | 2.9.6 | Custom analyzers (sensitive data detection) |

### Database

**Not applicable.** This is a stateless gateway service — it does not own or connect to any database.

### Caching Layer

| Layer | Implementation |
|-------|---------------|
| In-memory cache | `Microsoft.Extensions.Caching.Memory` (registered via `services.AddMemoryCache()`) |
| Distributed cache | `Space.Service.Common.Caching.SuperCache` (likely Redis + memory hybrid, registered via `services.AddSuperCache(configuration)`) |

The feature toggle handler (`GetFeatureTogglesQueryHandler`) uses the cache with ETag-based invalidation.

### Logging & Observability

| Concern | Technology |
|---------|-----------|
| Structured logging | **Serilog** (via `Space.Service.Common.Logging`) |
| APM | Elastic APM (`ElasticApmTransactionGroupingMiddleware`, `services.AddApm(...)`) |
| Metrics | **Prometheus** (`prometheus-net.AspNetCore` 8.2.1, `app.UseHttpMetrics()`, `app.MapMetrics()`) |
| Sensitive data masking | `[SensitiveData]` attribute on DTOs (custom analyzer) |

---

## 4. API Layer & Communication

### API Style

**REST** (JSON) + **YARP Reverse Proxy**. The service exposes two types of endpoints:

1. **Orchestrated endpoints** — controllers that dispatch MediatR commands/queries, aggregate data from multiple services.
2. **Proxied endpoints** — YARP transparently forwards requests to downstream services.

### Exposed Endpoints

#### Orchestrated Endpoints (Controllers)

##### AgreementController

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/agreement/api/v{version}/agreement/list` | Get all agreements (aggregated from 5 services) |

##### CardController

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/card/api/v{version}/card/renew/async` | Renew a card asynchronously |

##### CashLoanController

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/cashloan/api/v{version}/loan/check-loan-offer` | Check loan/credit card eligibility |

##### CreditCardController (V1)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/creditcard/api/v1/creditcard/agreement/{applicationId}` | Get credit card agreement details |
| `GET` | `/creditcard/api/v1/creditcard/product-info` | Get credit card product details |
| `GET` | `/creditcard/api/v1/creditcard` | Get user's credit card details |
| `GET` | `/creditcard/api/v1/creditcard/overview/{applicationId}` | Get credit card overview |
| `GET` | `/creditcard/api/v1/creditcard/crm` | Get CRM application details |
| `GET` | `/creditcard/api/v1/creditcard/widget` | Get credit card hub widget |
| `GET` | `/creditcard/api/v1/creditcard/limit-change-inquiry/{applicationId}/terms` | Get CLIP agreement terms |

##### CreditCardController (V2)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/creditcard/api/v2/creditcard/overview` | Get credit card overview V2 |
| `GET` | `/creditcard/api/v2/creditcard` | Get credit card details V2 |

##### CustomerController

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/customer/api/v{version}/customer` | Create customer |
| `POST` | `/customer/api/v{version}/customer/non-resident` | Create non-resident customer |
| `GET` | `/customer/api/v{version}/customer/profile` | Get customer profile |
| `POST` | `/customer/api/v{version}/customer/profile` | Update customer profile |

##### FeaturesController

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/features/api/v{version}/api/features/{clientKey}` | Get feature toggles (anonymous, ETag-cached) |
| `GET` | `/features/api/v{version}/api/features/default-values` | Get feature toggle defaults (anonymous) |

##### HomeController

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/home/api/v{version}/home/products` | Get available products |

##### RevolvingCardController

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/revolvingcard/api/v{version}/revolvingcard/renew` | Renew revolving card |

##### SessionController

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/session/api/v1/session/authorize` | Authorize liveness session (anonymous) |
| `POST` | `/session/api/v1/session/compare-face` | Compare face for liveness (anonymous) |
| `POST` | `/session/api/v2/session/authorize` | Authorize liveness session V2 (anonymous) |
| `POST` | `/session/api/v2/session/compare-face` | Compare face V2 (anonymous) |

##### TransferController

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/transfer/api/v{version}/transfer/recipient` | Get recipient info for transfers |

##### UserController

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/user/api/v{version}/user/flags` | Get user onboarding flags |
| `GET` | `/user/api/v{version}/user/settings` | Get user settings (anonymous) |

#### Proxied Routes via YARP (13 Downstream Services)

| Cluster | Route Count | Key Routes |
|---------|-------------|------------|
| **IdentityApi** | 20+ | OTP generate/verify, user creation, login, passcode, SCA, trusted device, agreements, language, logout |
| **VerificationApi** | 7 | Session authorize/analyze, phone number change flows, compare face, liveness media URL |
| **CustomerApi** | 7 | Customer check, duplicate check, cities/regions, profile update, image update, residency check |
| **CardApi** | 8 | Digital/physical card creation, block/unblock, activate, set default |
| **CashLoanApi** | 2 | Get loan by ID, generate conditions |
| **CreditCardApi** | — | (Proxied via dedicated yarpsettings file — not found as separate, likely handled via orchestrated controllers) |
| **DepositApi** | 10 | Deposit CRUD, transfer, transactions, calculator, products, comparator |
| **CurrencyApi** | 2 | Freeze rate, get frozen rate |
| **FeatureToggleApi** | 1 | Check features |
| **KycApi** | 2 | KYC questions and answers |
| **ReferralApi** | 3 | Referral program, user info, invited friends |
| **AttachedCardApi** | 1 | Set default attached card |
| **AutoLoanApi** | 2 | Car list, loan purpose list |
| **PfmApi** | 1 | Transaction category |

### Request/Response Patterns

- Controllers return `ObjectResult` with explicit status codes via `OkResult()` / `CreatedResult()` helpers in `ApiControllerBase`.
- Response DTOs are feature-specific (e.g., `AgreementsResponse`, `CreditCardOverviewQueryResponse`).
- The `[SensitiveData]` attribute is pervasively used on DTO properties for log masking.
- Swagger documentation via `[ApiOperation]`, `[ApiSuccessResponse]`, `[ApiErrorResponse]` custom attributes.

### API Versioning

- **URL-based versioning**: `v{version:apiVersion}` segment in route templates.
- Implemented via `Asp.Versioning` (from `services.AddVersioning()`).
- V2 endpoints exist for: `CreditCardController`, `SessionController` (authorize/compare-face).
- V2 CreditCardController is in a separate namespace `Controllers.V2` with `[ApiVersion("2.0")]`.

### Authentication & Authorization

| Mechanism | Details |
|-----------|---------|
| Authentication | **IdentityServer** (via `services.AddIdentityServerAuthentication(configuration)`) |
| Default policy | All controllers inherit `[Authorize]` from `ApiControllerBase` |
| Anonymous endpoints | Explicitly marked with `[AllowAnonymous]` (features, session, user settings) |
| API Key auth | `[ApiKey("CRM")]` attribute on CRM endpoint; `ApiKeyMiddleware` in YARP pipeline |
| YARP auth | Routes default to `"Default"` policy unless metadata contains `ApiKeys` (then `"Anonymous"`) |
| PII in dev | `IdentityModelEventSource.ShowPII = true` in non-production |

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline

Registered in `ApiExtensions.ConfigureAPI()`, in execution order:

```csharp
app.UsePathBase(pathBase);                                    // 1. Path base (/apigateway)
app.UseLocalization(configuration["DefaultCultureInfoName"]); // 2. Culture/localization
app.UseHttpsRedirection();                                    // 3. HTTPS redirect
app.UseRouting();                                             // 4. Routing
app.UseHttpMetrics();                                         // 5. Prometheus HTTP metrics
app.UseAuthentication();                                      // 6. IdentityServer auth
app.UseStaticFiles();                                         // 7. Static files
app.UseMiddleware<ElasticApmTransactionGroupingMiddleware>();  // 8. Elastic APM transaction grouping
app.UseAuthorization();                                       // 9. Authorization
app.UseMiddlewares();                                         // 10. Common shared middlewares
app.UseHealthCheckMiddleware(env);                            // 11. Health check middleware
app.UseMiddleware<MaintenanceCheckMiddleware<SharedResources>>();  // 12. Maintenance mode check
app.UseMiddleware<AccessTokenCheckMiddleware>();               // 13. Access token validation
app.UseMiddleware<RequiredHeadersCheckerMiddleware>();         // 14. Required headers check
app.UseMiddleware<VersionCheckMiddleware>();                   // 15. App version check
app.UseVersionEndpoint(configuration);                        // 16. Version info endpoint
app.MapControllers();                                         // 17. Route to controllers
app.MapMetrics();                                             // 18. Prometheus metrics endpoint
app.MapReverseProxy(proxyPipeline => {                        // 19. YARP reverse proxy
    proxyPipeline.UseMiddleware<ApiKeyMiddleware>();           //     with API key check
});
```

### MediatR Pipeline Behaviors

Registered in `ApplicationExtensions.cs`, in execution order:

| Order | Behavior | Purpose |
|-------|----------|---------|
| 1 | `LoggingBehavior<,>` | Logs request and response payloads |
| 2 | `ValidationBehavior<,>` | Runs FluentValidation validators; throws on failure |

### Global Exception Handling

Exception handling is provided by `Space.Service.Common.Middlewares` (via `app.UseMiddlewares()`). The service uses `AppException` from `Space.Service.Common.Exceptions` for structured error throwing with error codes.

### Request Validation

- **FluentValidation** — validators auto-discovered via `services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly())`.
- `ValidatorOptions.Global.DisplayNameResolver` configured to use camelCase property names.
- `SuppressModelStateInvalidFilter = true` — model state validation is disabled in favor of MediatR pipeline validation.

Active validators:

| Validator | Rules |
|-----------|-------|
| `AgreementQueryValidator` | `ApplicationId` required |
| `AuthorizeCommandValidator` | `Type` required, must be valid enum |
| `AuthorizeV2CommandValidator` | `Operation` required, must be valid enum |
| `CompareFaceCommandValidator` | `UserId`, `SessionId`, `FolderId`, `AccessToken` required; `Type` required + enum |
| `CompareFaceV2CommandValidator` | `UserId`, `SessionId`, `FolderId`, `AccessToken` required; `Operation` required + enum |
| `RevolvingCardRenewAsyncCommandValidator` | `CardId` required; `DeliveryType` enum when present; conditional address/pickup validation |
| `RecipientInfoQueryValidator` (inline) | `IdentifierType` valid enum; `Identifier` required |

### Correlation ID / Request Tracing

- YARP removes `traceparent` and `tracestate` headers from proxied requests and replaces them via `DistributedContextPropagator.CreateDefaultPropagator()`.
- `RequestMetadata` (scoped) carries user context (`UserId`) across the pipeline.
- Elastic APM provides distributed trace propagation.

---

## 6. Data Layer

**Not applicable.**

This service is a stateless API Gateway. It does not own, connect to, or migrate any database. All state is held by downstream microservices. The only local storage is in-memory and distributed caching for feature toggles and transient data.

---

## 7. Messaging & Event Handling

### Message Broker

No direct message broker integration exists in the runtime code. However, the architecture is event-aware:

- The `ArchitectureTests` enforce naming conventions for consumed and produced events using `[ConsumeEventAttribute]` and `[ProduceEventAttribute]` from `Space.Service.Common.EventBus`.
- The `CITools` project can generate event schemas via `EventsSchemaGenerator.GenerateEventSchemaJson()`.
- The Dockerfile installs a Kafka CA certificate (`ca_cert_kafka.pem`), suggesting the broader platform uses Kafka.

### Published / Consumed Events

No events are currently published or consumed by this service's runtime code. The event schema generation tooling is in place for future use.

---

## 8. Background Jobs & Scheduled Tasks

**Not applicable.**

No `IHostedService`, Hangfire, Quartz, or background worker implementations exist. The service handles requests synchronously (with async I/O). The only proactive configuration is:

- `ThreadPool.SetMinThreads(100, 100)` — pre-warms the thread pool for high-concurrency scenarios.
- Kestrel's `MinRequestBodyDataRate` is set to 50 bytes/sec with a 15-second grace period.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

| Aspect | Implementation |
|--------|---------------|
| Framework | **Serilog** (via `builder.Host.UseSerilog(...)`) |
| Structure | Structured logging with JSON sinks |
| Sensitive data | `[SensitiveData]` attribute auto-masks PII in logs |
| Pipeline logging | `LoggingBehavior<,>` logs all MediatR requests/responses |
| Handler-level | Individual handlers log warnings on non-fatal service failures (e.g., agreement aggregation) |

### Health Checks & Probes

- Registered via `services.AddHealthChecks(configuration)` from `Space.Service.Common.HealthChecks`.
- Middleware: `app.UseHealthCheckMiddleware(env)` and `app.AddHealthChecks()`.
- Version endpoint: `app.UseVersionEndpoint(configuration)`.

### Rate Limiting / Throttling

Not explicitly configured in the gateway code. May be handled by the infrastructure layer (load balancer, ingress controller).

### Resilience Patterns

| Pattern | Implementation |
|---------|---------------|
| HTTP client resilience | Configured via `Space.Service.Common.RestClient` (likely includes Polly policies) |
| Graceful degradation | Agreement aggregation catches per-service failures and logs warnings |
| Feature toggle gates | Handlers check feature toggles before executing maintenance-sensitive operations |
| Thread pool pre-warming | `ThreadPool.SetMinThreads(100, 100)` prevents thread starvation |
| Kestrel rate protection | `MinRequestBodyDataRate` prevents slow-loris attacks |

### Configuration Management

| Source | Usage |
|--------|-------|
| `appsettings.json` | Base configuration |
| `yarpsettings.*.json` (×13) | YARP route/cluster configuration per downstream service |
| Environment variables | `ASPNETCORE_ENVIRONMENT`, `PATH_BASE` |
| Options pattern | `CardOptions`, `UserSettingOptions` — validated on start via `ValidateDataAnnotations().ValidateOnStart()` |
| Feature toggles | `Space.Service.Common.FeatureToggle` — `CreditCardTermsMaintenance`, `CreditCardMVPMaintenance`, `ActivateParallelLoans` |
| Encryption | `EncryptionKey` configuration for JWT token operations |
| CORS | `CorsOrigins` configuration section |
| Localization | `DefaultCultureInfoName` configuration key; supports en-US, ru-RU, uz-Latn-UZ |

---

## 10. Testing

### Test Projects

| Project | Type | Framework |
|---------|------|-----------|
| `Space.Service.ApiGateway.UnitTests` | Unit tests | xUnit 2.9.3 |
| `Space.Service.ApiGateway.ComponentTests` | Component/Integration tests | xUnit 2.9.3 + `WebApplicationFactory` |
| `Space.Service.ApiGateway.ArchitectureTests` | Architecture fitness tests | xUnit 2.9.3 + NetArchTest.Rules 1.3.2 |

### Testing Frameworks & Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| xUnit | 2.9.3 | Test framework |
| FluentAssertions | 7.2.0 | Assertion library |
| NSubstitute | 5.3.0 | Mocking framework |
| AutoFixture | 4.18.1 | Test data generation |
| RichardSzalay.MockHttp | 7.0.0 | HTTP message handler mocking |
| WireMock.Net | 1.8.4 | HTTP API mocking (component tests) |
| Microsoft.AspNetCore.Mvc.Testing | 9.0.11 | `WebApplicationFactory` for component tests |
| Serilog.Sinks.TestCorrelator | 4.0.0 | Log assertion in tests |
| coverlet | 6.0.4 | Code coverage collection |
| XunitXml.TestLogger | 8.0.0 | XML test result reporting |
| GitHubActionsTestLogger | 3.0.1 | GitHub Actions test reporting |
| NetArchTest.Rules | 1.3.2 | Architecture constraint testing |

### Mocking Strategy

- **NSubstitute** for all service client interfaces and dependencies.
- **AutoFixture** for generating test data (commands, responses).
- **WireMock.Net** for component tests that need full HTTP mocking of downstream services.
- **RichardSzalay.MockHttp** for HTTP handler-level mocking.

### Notable Test Patterns

- **`CustomWebApplicationFactory<TProgram>`** — overrides authorization to allow anonymous access, substitutes `ISuperCache` and `IFeatureToggle`, loads `appsettings.json` for `Local` environment.
- **`TestAllowAnonymous`** — replaces authorization handler to succeed all requirements in tests.
- **Shared fixtures** — `LocalizerFixture`, `MapperFixture` via `[Collection("SharedFixtures")]`.
- **Architecture tests** enforce:
  - Controllers depend on MediatR, not on Domain or Infrastructure.
  - Domain has no outward dependencies.
  - Request names end with `Command` or `Query`.
  - Handler names end with `CommandHandler` or `QueryHandler`.
  - No important classes decorated with `[ExcludeFromCodeCoverage]`.

### Coverage Enforcement

- Pre-commit hook runs full test suite with coverage collection.
- **Threshold: 90%** combined line + branch coverage (via `coverage-precommit.sh`).
- **Stryker mutation testing** with **80% mutation score threshold** (via `stryker-precommit.sh`).

---

## 11. DevOps & Deployment

### Dockerfile Analysis

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0           # Runtime-only base image (.NET 9)
WORKDIR /app
COPY ./ca_cert.pem /usr/local/share/ca-certificates/ca_cert.crt       # Custom CA cert
COPY ./ca_cert_kafka.pem /usr/local/share/ca-certificates/ca_cert_kafka.crt  # Kafka CA cert
RUN update-ca-certificates --verbose                # Trust custom CAs
COPY app/publish  .                                 # Pre-built publish output
ENV ASPNETCORE_HTTP_PORTS=80                        # Listen on port 80
ENTRYPOINT ["dotnet", "Space.Service.ApiGateway.Api.dll"]
```

**Notes:**
- Single-stage Dockerfile — build happens externally (CI pipeline).
- Installs two custom CA certificates (internal PKI + Kafka).
- Runs on port 80 (HTTP); HTTPS termination expected at ingress/load balancer level.

### CI/CD Pipeline

Referenced in the README badges:
- **`ci-cd.yaml`** — combined CI/CD pipeline (build, test, deploy)
- **`cd.yaml`** — dedicated deployment pipeline

These files are hosted in GitHub Actions (`https://github.com/SpaceBank/Space.Service.ApiGateway/actions`).

### CI Tooling (`CITools` Project)

The `Space.Service.ApiGateway.CITools` console app supports:
- `generate-events-schema` — generates event schema JSON for the platform's event catalog.
- `generate-contracts` — generates API contracts for consumer-driven contract testing.

### Development Tools

| Tool | Location | Purpose |
|------|----------|---------|
| `localDevSetup.sh` | `tools/` | Installs Trivy, sets up git hooks |
| `commit-msg` hook | `tools/hooks/` | Enforces commit message format: `<ABBR-NUM> \| message \| <author>` |
| `coverage-precommit.sh` | `tools/codeCoverage/` | Runs tests + enforces 90% coverage threshold |
| `stryker-precommit.sh` | `tools/stryker/` | Enforces 80% Stryker mutation score |
| `run-stryker.sh` | `tools/stryker/` | Runs Stryker mutation testing locally |
| `run-sonar-scan.sh` | `tools/sonarqube/` | Runs SonarQube analysis |
| `run-trivy-secret-scan.sh` | `tools/trivy/` | Scans for hardcoded secrets |
| `secret-rules.yaml` | `tools/trivy/` | Custom Trivy rules for password detection |
| `rules.tsv` | `tools/zap/` | OWASP ZAP scan rules configuration |
| `run-tests-with-coverage-local.sh` | `tools/codeCoverage/` | Local coverage report generation |

### Environment-Specific Configuration

| Environment | Details |
|-------------|---------|
| Local | `ASPNETCORE_ENVIRONMENT=Local`, `PATH_BASE=/apigateway`, ports 5142/7142 |
| Development | YARP clusters point to `https://api.dev.uz.spaceneobank.loc/` |
| Production | Swagger disabled (`!env.IsProduction()`), PII logging disabled |

---

## 12. External Service Dependencies

### HTTP Clients (16 Downstream Services)

| Client Interface | Service | Config Key | Key Operations |
|------------------|---------|------------|----------------|
| `ICreditCardServiceClient` | Space.Service.CreditCard | `CreditCardClientOptions` | Current state, overview, terms, product info, widget, CRM details, CLIP terms, CC→loan redirect |
| `ICardServiceClient` | Space.Service.Card | `CardClientOptions` | Card CRM, get cards by phone number |
| `IRevolvingCardClient` | Space.Service.RevolvingCard | `RevolvingCardClientOptions` | Get card (V1/V2), renew, product details, get cards (V1/V2), CRM, widget, cards by phone |
| `ICustomerServiceClient` | Space.Service.Customer | `CustomerClientOptions` | Create customer (resident/non-resident), profile, update, flags, onboarding flow, agreements |
| `IIdentityServiceClient` | Space.Service.Identity | `IdentityClientOptions` | Create customer, trusted device check/verify, refresh token, user email, update email, agreements |
| `IVerificationServiceClient` | Space.Service.Verification | `VerificationClientOptions` | Authorize session (V1/V2), compare face (V1/V2) |
| `ICurrentAccountServiceClient` | Space.Service.CurrentAccount | `CurrentAccountClientOptions` | Has current account, get by phone number |
| `IKycServiceClient` | Space.Service.KYC | `KycClientOptions` | Has KYC |
| `ILoyaltyServiceClient` | Space.Service.Loyalty | `LoyaltyClientOptions` | Get agreements |
| `IPremiumSubscriptionServiceClient` | Space.Service.PremiumSubscription | `PremiumSubscriptionClientOptions` | Get agreements |
| `IReferralServiceClient` | Space.Service.Referral | `ReferralClientOptions` | Get agreements |
| `IHomeServiceClient` | Space.Service.Home | `HomeClientOptions` | Get products |
| `IInstallmentServiceClient` | Space.Service.Installment | `InstallmentClientOptions` | Has current installments |
| `ICashLoanServiceClient` | Space.Service.CashLoan | `CashLoanClientOptions` | Check loan eligibility (V1/V2) |
| `ITransferClient` | Space.Service.Transfer | `TransferClientOptions` | Get recipient info |
| `IAttachedCardServiceClient` | Space.Service.AttachedCard | `AttachedCardClientOptions` | Get cards by phone number |

### Client Configuration

All clients are registered via `services.AddRestClient<IClient>(configuration, "ConfigKey")` from `Space.Service.Common.RestClient`. This library:
- Uses **RestEase** for declarative HTTP interface definitions.
- Reads base URLs and configuration from the named options section.
- Likely applies standard resilience policies (retry, circuit breaker) via the common library.

### Client Interface Technology

All client interfaces use RestEase attributes:
- `[InternalApiClient("Space.Service.XXX")]` — marks as internal service client
- `[Get(...)]`, `[Post(...)]`, `[Patch(...)]` — HTTP method + path
- `[Path]`, `[Query]`, `[Body]` — parameter binding
- `[AllowAnyStatusCode]` — used for calls where non-2xx is expected (e.g., eligibility checks)

---

## 13. Key Technical Decisions & Patterns Summary

### Patterns Table

| Pattern | Where Used | Why |
|---------|-----------|-----|
| **API Gateway / BFF** | Entire service | Unified entry point for mobile clients; composition of multiple backend responses |
| **YARP Reverse Proxy** | 80+ routes in `yarpsettings.*.json` | Zero-code routing for simple pass-through endpoints |
| **CQRS (MediatR)** | All Features/** handlers | Separates read/write concerns; clean command/query semantics |
| **Clean Architecture** | 4-layer project structure | Dependency inversion; testability; enforced by architecture tests |
| **Vertical Slice** | Each Features/ subfolder | Feature-centric organization with co-located command/query/handler/validator/DTOs |
| **Feature Toggles** | CashLoan, CreditCard handlers | Safe rollouts; maintenance mode gates; V1/V2 traffic switching |
| **Pipeline Behaviors** | `LoggingBehavior`, `ValidationBehavior` | Cross-cutting logging and validation without per-handler boilerplate |
| **Parallel Service Calls** | Agreement, Transfer, User handlers | Reduces latency by calling independent services concurrently |
| **Graceful Degradation** | Agreement handler | Individual service failures don't break the aggregated response |
| **RestEase Typed Clients** | All 16 HttpClient interfaces | Declarative, type-safe HTTP client definitions |
| **Options Pattern** | `CardOptions`, `UserSettingOptions` | Validated configuration with `ValidateOnStart` |
| **Architecture Fitness Tests** | `ArchitectureTests` | Automated enforcement of layer dependency rules and naming conventions |
| **Mutation Testing** | Stryker (pre-commit) | Ensures test quality beyond line coverage |
| **Sensitive Data Masking** | `[SensitiveData]` attribute on DTOs | GDPR/PII compliance in logs |
| **ETag Caching** | Feature toggle endpoint | 304 Not Modified support for efficient client polling |
| **Version Gating** | `[RequiredMinVersion]` on endpoints | Per-platform minimum app version enforcement |

### Notable Deviations

| Observation | Details |
|-------------|---------|
| Single-stage Dockerfile | Build happens in CI, not in Docker — acceptable for CI-optimized pipelines but reduces reproducibility |
| No database layer | Unusual for a .NET Clean Architecture template — justified because this is a pure BFF/gateway |
| `ValidateScopes = false` | Disabled scope validation in the DI container — common for services mixing scoped/singleton registrations with YARP |
| Empty Domain layer | Contains only enums — some teams would argue these belong in a shared contracts package |
| Controller route duplication | All controllers use `[Route("[controller]/api/v{version:apiVersion}/[controller]")]` which doubles the controller name in the path (e.g., `/card/api/v1/card/...`) |
| xunit.extensibility.core in Application | Test package referenced in the Application project (likely for `[Fact]`-like attributes in stryker disable comments) |

### Technical Debt & Improvement Opportunities

| Area | Observation |
|------|-------------|
| **Reflection in YARP transform** | `builderContext.Route.GetType().GetProperty("AuthorizationPolicy").SetValue(...)` uses reflection to set authorization policy — fragile if YARP internals change |
| **Mixed command/query semantics** | `CheckLoanOfferCommand` is semantically a query (it checks eligibility, doesn't mutate state) |
| **Inline validator** | `RecipientInfoQuery` contains its validator inline rather than in a separate file |
| **Duplicated card renewal** | Both `CardController` and `RevolvingCardController` dispatch `RevolvingCardRenewAsyncCommand` |
| **Missing pagination** | No visible pagination pattern for list endpoints |
| **No retry policies visible** | While `Space.Service.Common.RestClient` likely adds Polly policies, they're not explicitly configured or documented |
| **CORS `AllowCredentials` + `WithOrigins`** | Correct pattern, but the allowed origins come from configuration — ensure production values are restrictive |
| **Thread pool manual tuning** | `ThreadPool.SetMinThreads(100, 100)` — may need tuning per environment |

---
