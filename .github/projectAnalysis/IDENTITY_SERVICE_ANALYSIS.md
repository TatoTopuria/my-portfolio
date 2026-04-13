# Space.Service.Identity — Comprehensive Service Analysis

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

### Service Identity

| Attribute | Value |
|---|---|
| **Name** | `Space.Service.Identity` |
| **Owner Team** | `identity-sso` |
| **Runtime** | .NET 9.0 (C# latest) |
| **Primary Database** | PostgreSQL (via Npgsql) |
| **Secondary Database** | MongoDB (digital signatures) |

### Purpose & Business Problem

Space.Service.Identity is the **centralized identity and authentication microservice** for the Space neobank platform. It owns the entire user lifecycle — from registration through authentication, device management, and account deactivation — and acts as the OAuth 2.0 / OpenID Connect token issuer (via Duende IdentityServer) for all downstream services.

### Bounded Context

This service represents the **Identity & Access Management (IAM)** bounded context. It is the single source of truth for:

- User accounts and credentials
- Authentication tokens (access, refresh)
- Strong Customer Authentication (SCA) / Multi-Factor Authentication (MFA)
- Device trust and verification state
- One-Time Passwords (OTPs)
- Customer-to-user association
- Business profile linkage
- User agreements and consent records

### Key Entities & Domain Models

| Entity | Base Class | Description |
|---|---|---|
| `User` | `IdentityUser` + `IEntityBase<string>` | Core user account (ASP.NET Identity); owns password, status, lockout, language |
| `Customer` | `EntityBase<string>` | Banking customer record linked to a user; holds `PersonalNumber`, core-banking and platform correlation IDs |
| `UserDevice` | `EntityBase<int>` | Registered device per user; tracks trust/verification status and trust method |
| `LocalAuthentication` | `SoftDeletedEntityBase<long>` | Biometric/local auth enrollment (fingerprint, face) per device |
| `OneTimePassword` | `EntityBase<long>` | OTP record with try count, expiry, phone binding |
| `ScaCodeEntity` / `ScaCodeArchive` | `EntityBase<string>` | SCA flow state: knowledge, possession, inherence factor completion tracking |
| `Agreement` / `AgreementTemplate` | `EntityBase<int>` / `EntityBase<string>` | User consent records and versioned agreement templates with translations |
| `BusinessProfile` | `EntityBase<int>` | Business-banking role binding (user ↔ business customer ↔ role) |
| `TelecomOneTimePassword` | `EntityBase<string>` | Telecom anti-fraud OTP records (separate from standard OTPs) |
| `UserLoginLog` | `EntityBase<long>` | Login/logout audit trail per device |
| `UserBlock` | `EntityBase<long>` | Block reason audit (CRM, ThreatDetection, automatic) |
| `EimzoSignatureRecord` | MongoDB document | E-imzo digital signature verification records |
| `ProviderDeactivatedPhoneNumber` | `EntityBase<string>` | Phone numbers flagged for deactivation by telecom providers |
| `DeviceNameMapping` | `IEntityBase<long>` | Device manufacturer/model → human-readable branding name mapping |

### Main Use Cases & Workflows

1. **User Registration** — OTP-verified phone-based signup → user + customer creation → token issuance → event bus notification
2. **Login / Token Refresh** — Password or SCA grant → JWT issuance with claims (customer, business profiles) → threat detection event
3. **Strong Customer Authentication (SCA)** — Multi-factor flow: start → check knowledge (password) → check possession (OTP/digital signature) → check inherence (biometrics) → generate SCA code JWT
4. **Device Trust Management** — Register → verify (face comparison) → trust (OTP-confirmed or auto-trust worker) → deactivate
5. **Passcode Change / Recovery** — Authenticated change or unauthenticated recovery with OTP + face verification + document check
6. **Phone Number Change** — With SCA verification, updates across identity + core banking (IABS)
7. **OTP Generation & Verification** — Standard OTPs + telecom anti-fraud OTPs with delivery status tracking
8. **Agreement Management** — Serve localized templates → record user acceptance → publish signed URL events
9. **Device Authorization Flow** — OAuth 2.0 device code flow for limited-input devices (business banking)
10. **Digital Signatures** — E-imzo mobile signature initiation and PKCS7 verification
11. **AI Token Issuance** — Generate encrypted time-limited tokens for AIphoria integration
12. **User Status Management** — Block/unblock via CRM, threat detection, or automatic lockout with audit trail

---

## 2. Architecture

### Architectural Pattern

The service follows **Clean Architecture** with **CQRS** (Command Query Responsibility Segregation) via MediatR. This is validated by architecture tests in `ArchitectureTests.cs` using `NetArchTest.Rules`.

**Justification from code:**

- **Dependency inversion**: Domain has zero dependencies on other layers. Application depends only on Domain. Infrastructure and Persistence implement Application-layer interfaces.
- **CQRS via MediatR**: Every operation is either a `Command` (state-changing) or a `Query` (read-only), dispatched through `IMediator`. Handlers derive from `RequestHandlerBase<TRequest, TResponse>`.
- **Architecture tests enforce** that controllers never touch Persistence/Domain/Infrastructure directly, and Application never references Persistence or Infrastructure.

### Project Structure Breakdown

```
Space.Service.Identity/
├── Space.Service.Identity.Api/              # Presentation layer: controllers, middleware, Program.cs
├── Space.Service.Identity.Application/      # Business logic: features (CQRS), services, repository interfaces
├── Space.Service.Identity.Domain/           # Core domain: entities, enums, exceptions, value objects
├── Space.Service.Identity.Infrastructure/   # External concerns: HTTP clients, workers, caching, email
├── Space.Service.Identity.Persistence/      # Data access: EF Core DbContext, repositories, migrations, IdentityServer config
├── Space.Service.Identity.UnitTests/        # Unit tests (NSubstitute, InMemory DB, Testcontainers MongoDB)
├── Space.Service.Identity.ComponentTests/   # Integration tests (real PostgreSQL via Testcontainers, WireMock)
├── Space.Service.Identity.ArchitectureTests/# Structural tests (NetArchTest)
├── Space.Service.Identity.CITools/          # CI helper project
├── scripts/                                 # SQL migration scripts per environment
└── tools/                                   # DevOps tooling (code coverage, Stryker, Trivy, ZAP, SonarQube)
```

| Project | Responsibility |
|---|---|
| **Api** | HTTP entry point. Controllers dispatch to MediatR. Configures middleware pipeline, auth, Swagger, health checks. References: Application, Infrastructure, Persistence |
| **Application** | All business logic. Organized by feature (CQRS). Defines repository interfaces, service interfaces, HTTP client interfaces, options classes, DTOs, events, validators. References: Domain only |
| **Domain** | Pure domain model. Entities with base classes from `Space.Service.Common.Persistence`. Enums, exceptions, cache models. References: no project dependencies |
| **Infrastructure** | Implements Application interfaces. Background workers (`CronBackgroundServiceBase`), HTTP-calling services, caching (Redis), email, QR generation, fraud check, telecom anti-fraud. References: Application, Persistence |
| **Persistence** | EF Core `IdentityDbContext`, MongoDB context, entity configurations, repository implementations, Duende IdentityServer operational store, migrations. References: Application |

### Dependency Flow

```
Api → Application → Domain
 ↓        ↑            ↑
 ├→ Infrastructure ────┘
 └→ Persistence ───────┘
```

- **Domain**: No outward dependencies (innermost layer)
- **Application**: References only Domain
- **Infrastructure**: References Application (to implement interfaces) and Persistence (for DbContext in workers)
- **Persistence**: References Application (to implement repository interfaces)
- **Api**: References Application, Infrastructure, and Persistence (for DI composition root)

### CQRS Organization

All features reside under `Application/Features/{FeatureName}/`:

```
Features/
├── Agreement/
│   ├── Commands/CreateAgreements/
│   └── Queries/Agreements/, AgreementTemplateHtml/
├── User/
│   ├── Commands/CreateUser/, Login/, ChangePasscode/, RecoverPasscode/, ...
│   ├── Queries/GetUserType/, GetUserEmail/, GetUserLanguage/
│   ├── Events/UserCreatedEvent, UserLoggedInEvent, ...
│   └── Sync/UserCreatedCommand, UserLoggedInCommand, ... (EventBus consumers)
├── Sca/
│   ├── Commands/StartScaFlow/, CheckKnowledgeFactor/, CheckPossessionFactor/, ...
│   └── Queries/GetScaCache/
├── Device/
│   ├── Commands/SetTrustedDevice/, DeactivateTrustedDevice/, VerifyDevice/, ...
│   ├── Queries/CheckTrustedDevice/, GetTrustedDevicesForUser/, ...
│   └── Sync/TrustedDeviceCreated/, TrustedDeviceDeactivated/, ...
├── Otp/
│   ├── Commands/GenerateOtp/, VerifyOtp/, GenerateOtpV2/, VerifyOtpV2/
│   ├── Events/OtpVerifiedEvent, SendOtpBlockNotificationEvent
│   └── Queries/UnencryptedOtpByIdentifier/
└── ... (AIphoria, BusinessProfile, Cache, Customer, DeviceAuthFlow, DigitalSignature, etc.)
```

Each Command/Query folder contains:
- `{Name}Command.cs` / `{Name}Query.cs` — MediatR request
- `{Name}CommandHandler.cs` / `{Name}QueryHandler.cs` — handler (derives from `RequestHandlerBase<,>`)
- `{Name}CommandValidator.cs` — FluentValidation rules (when applicable)
- `{Name}Response.cs` — response DTO
- Event classes for outbound EventBus messages

### Repository Pattern

Repository interfaces live in `Application/Repositories/`, implementations in `Persistence/Repositories/`. All extend `IRepositoryBase<TEntity, TEntityId>` which provides standard CRUD. Specific repositories add domain-specific query methods.

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Component | Version |
|---|---|
| **Runtime** | .NET 9.0 (`net9.0`) |
| **Language** | C# (latest features enabled) |
| **SDK** | `Microsoft.NET.Sdk.Web` (Api project) |

### Build Configuration (`Directory.Build.props`)

```xml
<ServerGarbageCollection>true</ServerGarbageCollection>
<GarbageCollectionAdaptationMode>1</GarbageCollectionAdaptationMode>
```

Server GC with DATAS (Dynamic Adaptation To Application Sizes) enabled for high-throughput server workloads.

### Primary Frameworks & Libraries

| Package | Version | Role |
|---|---|---|
| `Duende.IdentityServer.AspNetIdentity` | 7.3.2 | OAuth 2.0 / OIDC token server with ASP.NET Identity integration |
| `Duende.IdentityServer.EntityFramework` | 7.3.2 | IdentityServer operational + configuration stores in PostgreSQL |
| `Microsoft.AspNetCore.Identity.EntityFrameworkCore` | 9.0.9 | User/role/claim management with EF Core backing |
| `Microsoft.EntityFrameworkCore.Relational` | 9.0.9 | EF Core relational database abstractions |
| `Microsoft.EntityFrameworkCore.Design` | 9.0.9 | Design-time migration tooling |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | (transitive) | PostgreSQL EF Core provider |
| `MongoDB.Driver` | 3.5.0 | MongoDB client for digital signature records |
| `MongoDB.Bson` | 3.5.0 | BSON serialization for MongoDB documents |
| `Dapper` | 2.1.66 | Lightweight ORM for raw SQL queries (used in `UserRepository`) |
| `BouncyCastle.Cryptography` | 2.6.2 | GOST hash algorithms for E-imzo digital signatures |
| `CsvHelper` | 33.1.0 | CSV generation for telecom failure reports |
| `QRCoder` | 1.7.0 | QR code generation for business banking device auth |
| `System.IO.Hashing` | 9.0.9 | CRC32 hashing (E-imzo verification) |

### Space.Service.Common Packages (Internal Platform Libraries)

| Package | Version | Role |
|---|---|---|
| `Space.Service.Common.Mediator` | 2.9.8 | MediatR wrapper with `RequestHandlerBase<,>`, `LoggingBehavior`, `ValidationBehavior` |
| `Space.Service.Common.EventBus` | 2.9.36.7-beta | Event bus abstraction (Kafka-backed); `[ProduceEvent]`/`[ConsumeEvent]` attributes |
| `Space.Service.Common.Caching` | 2.9.15 | Redis `ISuperCache` wrapper |
| `Space.Service.Common.Auth` | 2.9.9 | IdentityServer configuration helpers, JWT auth setup |
| `Space.Service.Common.Exceptions` | 2.9.9 | Custom exception hierarchy (`AppException`, `NotFoundException`, etc.) |
| `Space.Service.Common.Persistence` | 2.9.14.7-beta | `EntityBase<T>`, `SoftDeletedEntityBase<T>`, `SequentialEntityBase`, `IUnitOfWork` |
| `Space.Service.Common.RestClient` | 2.9.23 | RestEase-based typed HTTP client registration (`[InternalApiClient]`, `[ExternalApiClient]`) |
| `Space.Service.Common.Mapping` | 2.9.2 | Object mapping utilities |
| `Space.Service.Common.Middlewares` | 2.9.12.7-beta | Shared middleware (correlation ID, exception handling, request/response logging) |
| `Space.Service.Common.HealthChecks` | 2.9.10 | Health check registration and middleware |
| `Space.Service.Common.Swagger` | 2.9.13 | Swagger/OpenAPI configuration |
| `Space.Service.Common.Logging` | 2.9.9 | Structured logging, `[SensitiveData]` attribute, `SensitiveDataUtils` |
| `Space.Service.Common.Otp` | 2.9.9 | OTP framework, `[OtpToken]` attribute |
| `Space.Service.Common.Sca` | 2.9.9 | SCA framework, `[ScaParameter]` attribute, factor types |
| `Space.Service.Common.Misc` | 2.9.71 | Shared enums (`Operation`, `Platform`, `UserStatus`), extension methods |
| `Space.Service.Common.FeatureToggle` | 2.9.16 | GrowthBook-based feature toggles (`IFeatureToggle`) |
| `Space.Service.Common.Storage` | 2.9.3 | Cloud storage abstraction (`IStorageClient`) |
| `Space.Service.Common.Workers` | (transitive) | `CronBackgroundServiceBase`, `PeriodicBackgroundServiceBase` |
| `Space.Service.Common.EmployeePermissionManagement` | 1.0.21 | `[EmployeePermission]` attribute-based authorization |
| `Space.Service.Common.BusinessBanking.Sync.BusinessCustomer` | 2.9.11 | Business customer sync event handling |
| `Space.Service.Common.CodeAnalyzers` | 2.9.6 | Custom Roslyn analyzers (including `SensitiveDataAnalyzer`) |

### Observability & Metrics

| Package | Version | Role |
|---|---|---|
| `prometheus-net.AspNetCore` | 8.2.1 | Prometheus metrics endpoint (`/metrics`) and HTTP request metrics |
| Serilog | (via `UseSerilog()`) | Structured logging (configured in `Program.cs`) |
| Elastic APM | (via `AddApm()`) | Application Performance Monitoring (spans in `ScaGrantValidator`) |

### Databases

| Database | Provider | Purpose |
|---|---|---|
| **PostgreSQL** | Npgsql + EF Core | Primary relational store for all entities — users, devices, OTPs, SCA codes, customers, agreements, audit logs |
| **MongoDB** | MongoDB.Driver 3.5.0 | Digital signature records (`DigitalSignatureMongoDbContext` → `EimzoSignatureRecords` collection) |
| **Redis** | `Space.Service.Common.Caching` (`ISuperCache`) | SCA flow cache, passcode recovery daily limits, telecom auth tokens, feature toggle state |

---

## 4. API Layer & Communication

### API Style

RESTful HTTP API with URL-based versioning (`api/v{version:apiVersion}/[controller]`). Lowercase URL routing enforced.

### Authentication & Authorization

| Mechanism | Where Used |
|---|---|
| **Duende IdentityServer (JWT Bearer)** | Default `[Authorize]` on `ApiControllerBase`; most endpoints |
| **Microsoft Entra ID (Azure AD)** | CRM-facing admin endpoints (`ChangeUserStatus`, `BlockUser`, `UnblockUser`, `CrmPhoneNumberChange`) |
| **API Key** | `[ApiKey("CRM")]`, `[ApiKey("RedesignAuth")]`, `[ApiKey("TbcUzWebIdentityBackend")]`, `[ApiKey("CrmPhoneNumberChangeAuth")]` |
| **Employee Permissions** | `[EmployeePermission("Identity_DeviceInformation")]`, `[EmployeePermission("IdentityChangeStatus")]`, `[EmployeePermission("BlockCustomer")]`, `[EmployeePermission("UnblockCustomer")]` |
| **`[AllowAnonymous]`** | Public endpoints: login, registration, OTP, SCA factor checks, device auth |
| **`[NonProduction]`** | Dev/test-only endpoints: `GetCache`, `DeleteUser`, `FakeLogin`, `GetUnencryptedOtp`, SCA cache management |
| **OTP Token Validation** | `[OtpTokenAction(Registration)]`, `[OtpTokenAction(SetTrustedDevice)]`, `[OtpTokenAction(ChangePasscode)]` |

### API Versioning

URL segment versioning via `Asp.Versioning`: `api/v1.0/...` and `api/v2.0/...`. V2 endpoints exist for:
- `POST /user/check` (v2 returns additional data)
- `POST /user/login` (v2)
- `POST /user/passcode/change` (v2 returns 204 instead of 201)
- `POST /user/passcode/recover` (v2 returns 204)
- `POST /user/phone-number-change` (v2)
- `POST /otp/generate` (v2 with telecom integration)
- `POST /otp/verify` (v2)
- `POST /otp/delivery-status` (v2 only)
- `POST /aiphoria/token` (v2)

### Endpoints by Controller

#### `AgreementController` — `api/v1/agreement`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `GetAgreementTemplateHtml` | GET | `/html` | Authorized | Get active agreement template HTML by type |
| `CreateAgreements` | POST | `/` | Authorized | Record user agreement acceptance |
| `GetAgreements` | GET | `/list` | Authorized | List user's signed agreements |

#### `AIphoriaController` — `api/v{version}/aiphoria`

| Method | Verb | Route | Version | Purpose |
|---|---|---|---|---|
| `GenerateToken` | POST | `/token` | v1.0 | Generate encrypted AIphoria integration token |
| `GenerateTokenV2` | POST | `/token` | v2.0 | V2 token generation |

#### `CacheController` — `api/v1/cache`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `GetCache` | GET | `/` | Anonymous, NonProduction | Debug: inspect Redis cache entry |

#### `CustomerController` — `api/v1/customer`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `CreateCustomer` | POST | `/` | Authorized | Create customer record linked to user |

#### `DeviceAuthController` — `api/v1/deviceauth`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `GenerateCodes` | POST | `/generate-codes` | Anonymous | Generate device + user codes (OAuth device flow) |
| `CheckUserCode` | POST | `/check-user-code` | Authorized | Verify user code for device auth |
| `GetTokens` | POST | `/login` | Anonymous | Exchange device code for tokens |

#### `DeviceController` — `api/v1/device`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `SetTrustedDevice` | POST | `/trusted` | Authorized + OTP | Trust a user's device |
| `GetTrustedDevicesForUser` | GET | `/trusted` | Authorized | List trusted devices |
| `DeactivateTrustedDevice` | POST | `/trusted/deactivate` | Authorized | Remove trust from a device |
| `GetDeviceUniqueId` | GET | `/unique-id` | Anonymous | Get device unique ID from headers |
| `CheckTrustedDevice` | POST | `/trusted/check` | Anonymous | Check if device is trusted for user |
| `VerifyDevice` | POST | `/verify` | Anonymous | Verify device via face comparison |
| `GetCustomerDeviceInfo` | GET | `/information` | EmployeePermission | CRM: get customer device info |
| `GetUsersDevices` | POST | `/search-devices` | ApiKey | Search devices by phone/personal numbers |
| `GetUserRegistrationDeviceInfo` | GET | `/registration-device` | ApiKey | CRM: get registration device info |
| `ForgetDevice` | POST | `/forget` | Authorized | Remove device association |
| `GetActiveDevicesForUser` | GET | `/active` | Authorized | List all active devices |

#### `ExternalAuthController` — `api/v1/externalauth`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `CapCallback` | GET | `/cap-callback` | Anonymous | OAuth callback redirect from CAP provider |

#### `LocalAuthenticationController` — `api/v1/localauthentication`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `Update` | POST | `/` | Authorized | Register/update biometric auth for device |
| `Delete` | DELETE | `/` | Authorized | Remove biometric auth from device |

#### `OtpController` — `api/v{version}/otp`

| Method | Verb | Route | Version | Auth | Purpose |
|---|---|---|---|---|---|
| `GenerateOtp` | POST | `/generate` | v1.0 | Anonymous | Generate and send OTP |
| `VerifyOtp` | POST | `/verify` | v1.0 | Anonymous | Verify OTP |
| `GetUnencryptedOtp` | GET | `/` | v1.0 | NonProduction | Debug: get raw OTP |
| `GenerateOtpV2` | POST | `/generate` | v2.0 | Anonymous | V2: Generate with telecom anti-fraud |
| `VerifyOtpV2` | POST | `/verify` | v2.0 | Anonymous | V2: Verify with telecom anti-fraud |
| `DeliveryStatus` | POST | `/delivery-status` | v2.0 | Anonymous | SMS delivery status webhook |

#### `ProviderController` — `api/v1/provider`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `DeactivatePhoneNumbers` | POST | `/deactivate-phone-number` | Anonymous | Receive deactivated phone numbers from telecom provider |

#### `ScaController` — `api/v1/sca`

| Method | Verb | Route | Auth | Purpose |
|---|---|---|---|---|
| `StartScaFlow` | POST | `/start-flow` | Anonymous | Initiate SCA flow with requirements |
| `CheckKnowledgeFactor` | POST | `/knowledge` | Anonymous | Verify password (knowledge factor) |
| `CheckPossessionFactor` | POST | `/possession` | Anonymous | Verify OTP/digital signature (possession) |
| `CheckInherenceFactor` | POST | `/inherence` | Anonymous | Verify biometrics (inherence factor) |
| `GenerateScaCodeJwt` | POST | `/code` | Anonymous | Generate signed SCA code JWT |
| `GenerateRequirementsJwt` | POST | `/generate-requirements-jwt` | NonProduction | Debug: generate SCA requirements token |
| `GetScaCache` | GET | `/cache` | NonProduction | Debug: inspect SCA cache |
| `ClearScaCache` | DELETE | `/cache` | NonProduction | Debug: clear user SCA cache |
| `ClearAllScaCache` | DELETE | `/allCache` | NonProduction | Debug: clear all SCA cache |
| `InitiateMobileSignature` | POST | `/initiate-mobile-digital-signature` | Authorized | Start E-imzo mobile signing flow |

#### `UserController` — `api/v{version}/user`

| Method | Verb | Route | Version | Auth | Purpose |
|---|---|---|---|---|---|
| `CreateUser` | POST | `/` | v1.0 | Anonymous + OTP | User registration |
| `CheckUser` | POST | `/check` | v1.0 | Anonymous | Check if username exists |
| `CheckUserV2` | POST | `/check` | v2.0 | Anonymous | V2 user check with additional info |
| `Login` | POST | `/login` | v1.0 | Anonymous | Authenticate and get tokens |
| `LoginV2` | POST | `/login` | v2.0 | Anonymous | V2 login |
| `Logout` | POST | `/logout` | v1.0 | Authorized | Revoke tokens, log out |
| `RefreshToken` | POST | `/refresh-token` | v1.0 | Anonymous | Refresh access token |
| `CheckPasscode` | POST | `/passcode/check` | v1.0 | Authorized | Validate current passcode |
| `VerifyPasscode` | POST | `/passcode/verify` | v1.0 | Authorized | Verify passcode (lighter check) |
| `ChangePasscode` | POST | `/passcode/change` | v1.0 | Authorized + OTP | Change passcode (returns new tokens) |
| `ChangePasscodeV2` | POST | `/passcode/change` | v2.0 | Authorized + OTP | V2 change (204 No Content) |
| `RecoverPasscode` | POST | `/passcode/recover` | v1.0 | Anonymous | Recover passcode with SCA |
| `RecoverPasscodeV2` | POST | `/passcode/recover` | v2.0 | Anonymous | V2 recover (204 No Content) |
| `GetUserType` | GET | `/type` | v1.0 | Anonymous | Get user type/state info |
| `GetUserEmail` | GET | `/email` | v1.0 | Authorized | Get user's email |
| `UpdateUserEmail` | POST | `/update-email` | v1.0 | Authorized | Update email, send confirmation |
| `ConfirmUserEmail` | POST | `/confirm-email` | v1.0 | ApiKey | Confirm email via link token |
| `ResendEmailConfirmation` | POST | `/resend-email-confirmation` | v1.0 | Authorized | Resend confirmation email |
| `ChangeUserStatus` | POST | `/change-status` | v1.0 | EntraId + ApiKey + Permission | CRM: change user status |
| `BlockUser` | POST | `/block` | v1.0 | EntraId + Permission | CRM: block user |
| `UnblockUser` | POST | `/unblock` | v1.0 | EntraId + Permission | CRM: unblock user |
| `PhoneNumberChange` | POST | `/phone-number-change` | v2.0 | Anonymous | Change phone number with SCA |
| `CrmPhoneNumberChange` | POST | `/crm-phone-number-change` | v1.0 | EntraId + ApiKey | CRM: admin phone change |
| `RemoveUser` | DELETE | `/remove` | v1.0 | Authorized | Soft-delete user account |
| `GetUserLanguage` | GET | `/language` | v1.0 | Authorized | Get preferred language |
| `SetUserLanguage` | POST | `/language` | v1.0 | Authorized | Set preferred language |
| `CheckLoginAsync` | POST | `/tmx-session/check` | v1.0 | Authorized | Validate TMX fraud session |
| `FakeLogin` | POST | `/fake-login` | v1.0 | NonProduction | Test: create tokens without real auth |
| `DeleteUser` | DELETE | `/` | v1.0 | NonProduction | Test: hard-delete user |
| `LoggedOutPhoneNumberChange` | POST | `/logged-out-phone-number-change` | v1.0 | Anonymous | *Obsolete*: legacy phone change |

### Request/Response Patterns

- **DTOs**: Feature-specific, co-located with their command/query (e.g., `CreateUserResponse`, `LoginResponse`, `GenerateOtpResponse`)
- **Envelope**: Controllers return `CreatedResult(object)` (201) or `OkResult(object)` (200) via `ApiControllerBase` helpers
- **Validation errors**: Global via `ValidationBehavior` pipeline + FluentValidation; `SuppressModelStateInvalidFilter = true` (custom handling)
- **Sensitive data**: `[SensitiveData]` attribute on DTOs masks values in logs (`*** HIDDEN ***`)

---

## 5. Middleware & Pipeline

### HTTP Request Pipeline (exact order from `ApiExtensions.ConfigureAPI`)

```
1. UseForwardedHeaders()          — Handle X-Forwarded-Proto behind reverse proxy
2. UsePathBase("/identity")       — Strip path base prefix (configured via PATH_BASE)
3. UseLocalization()              — Request culture resolution (en-US, ru-RU, uz-Latn-UZ)
4. UseHttpsRedirection()          — Force HTTPS
5. UseRouting()                   — Endpoint routing
6. UseHttpMetrics()               — Prometheus HTTP request metrics collection
7. UseIdentityServer()            — Duende IdentityServer middleware (token endpoints, discovery)
8. UseStaticFiles()               — Serve wwwroot/ static content
9. UseAuthorization()             — ASP.NET Core authorization
10. UseMiddlewares()              — Space.Service.Common.Middlewares (correlation ID, exception handling, request/response logging)
11. UseHealthCheckMiddleware()    — Health check endpoints
12. UseEventEndpoints()           — EventBus consumer webhook endpoints
13. UseVersionEndpoint()          — Service version info endpoint
14. MapControllers()              — Controller endpoint routing
15. MapMetrics()                  — Prometheus /metrics endpoint
16. UseWorkerTriggerEndpoints()   — Manual worker trigger endpoints (HTTP-triggered background jobs)
17. UseSwagger()                  — Swagger UI (environment-aware, with path base)
```

### MediatR Pipeline Behaviors (execution order)

```csharp
cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));    // 1st: Log request/response with sensitive data masking
cfg.AddOpenBehavior(typeof(ValidationBehavior<,>)); // 2nd: FluentValidation before handler execution
```

1. **`LoggingBehavior<TRequest, TResponse>`** — Logs serialized request (with `[SensitiveData]` masking) and response. From `Space.Service.Common.Mediator`.
2. **`ValidationBehavior<TRequest, TResponse>`** — Runs all registered `IValidator<TRequest>` validators. Throws validation exception on failure. From `Space.Service.Common.Mediator`.

### Global Exception Handling

Handled by `Space.Service.Common.Middlewares` (registered via `UseMiddlewares()`). Catches `AppException`, `NotFoundException`, validation exceptions and maps them to standardized HTTP error responses.

### Request Validation

- **FluentValidation**: Auto-discovered from Application assembly via `services.AddValidatorsFromAssembly()`
- **Display name convention**: `ValidatorOptions.Global.DisplayNameResolver` uses `ToCamelCase()` for JSON-friendly error property names
- **Options validation**: `IOptions<T>` with custom `Validate()` callbacks (e.g., `LockoutOptions.Validate()`, `OtpOptions.ValidateExpiredInSeconds()`)
- **Model state**: `SuppressModelStateInvalidFilter = true` — validation handled by MediatR pipeline, not ASP.NET model binding

### Correlation ID / Request Tracing

Propagated via `Space.Service.Common.Middlewares` middleware. `RequestMetadata` is registered as scoped and populated per-request.

---

## 6. Data Layer

### Primary Database: PostgreSQL

| Aspect | Detail |
|---|---|
| **Provider** | Npgsql (`UseNpgsql`) |
| **DbContext** | `IdentityDbContext` inherits `IdentityDbContext<User>` (ASP.NET Identity) + `IDataProtectionKeyContext` |
| **Connection String** | `ConnectionStrings:NpgSql` from configuration |
| **DbSets** | 22 entity sets (see [Key Entities](#key-entities--domain-models)) |

### Secondary Database: MongoDB

| Aspect | Detail |
|---|---|
| **Provider** | `MongoDB.Driver` 3.5.0 |
| **Context** | `DigitalSignatureMongoDbContext` |
| **Database** | `"DigitalSignature"` |
| **Collection** | `EimzoSignatureRecords` (stores E-imzo digital signature verification records) |
| **Connection** | `ConnectionStrings:Mongo` |

### ORM Configuration

**Entity Configurations** — 21 `IEntityTypeConfiguration<T>` classes in `Persistence/Configurations/`:

| Configuration | Notable Settings |
|---|---|
| `UserConfiguration` | Unique index on `UserName`, index on `Email` |
| `CustomerConfiguration` | Required `UserId`, unique index on `UserId`, index on `CoreBankingCorrelationId` |
| `OneTimePasswordConfiguration` | Composite index `(PhoneNumber, OtpIdentifier, Action)`, unique index `(OtpIdentifier)`, descending index `(PhoneNumber, Timestamp)` |
| `ScaCodeConfiguration` | All factor columns required, FK to User (Cascade), index on `Timestamp` |
| `ScaCodeArchiveConfiguration` | Composite PK `(Id, ArchivedTimestamp)`, default `ArchivedTimestamp = NOW()` |
| `UserDevicesConfiguration` | Default `DeviceTrustMethod = Automatic`, unique index `(DeviceUniqueId, UserId)`, FK Cascade |
| `LocalAuthenticationConfiguration` | Required columns, index `(DeviceUniqueId, UserId)` |
| `TelecomOneTimePasswordConfiguration` | `Data` column stored as Postgres `jsonb` |
| `UserLoginLogsConfiguration` | Unique index `(DeviceUniqueId, UserId)`, composite index `(UserId, TenantId, IsWebPlatform)` |
| `DeviceMappingConfiguration` | Index on `Model` |

**Conventions**: All `decimal` properties → precision `(18, 4)`.

**SaveChanges Override** (`IdentityDbContext.SaveChangesAsync`):
- **Added entities**: Sets `Timestamp = UtcNow`; if `SequentialEntityBase` → `Id = RT.Comb.Provider.PostgreSql.Create()` (sequential GUID)
- **Modified entities**: Prevents `Timestamp` modification; sets `UpdateTimestamp = UtcNow`
- **Deleted entities (soft-delete)**: If `ISoftDeletedEntity` → sets `IsDeleted = true`, `DeleteTimestamp = UtcNow`, changes state to `Modified`

**ASP.NET Identity table renaming**: `Users`, `Roles`, `UserClaims`, `UserRoles`, `UserLogins`, `RoleClaims`, `UserTokens` (simplified from default `AspNet*` names).

### Migration Strategy

- **EF Core Migrations**: ~125 migration files from `20230214_Init` through `20260220_AddUserLoginLogBuildVersion`
- **Migrations Assembly**: `Space.Service.Identity.Persistence`
- **Design-time factories**: `ConfigurationDbContextFactory` and `PersistedGrantDbContextFactory` for Duende IdentityServer migrations
- **Additional migration folders**: `ConfigurationDb/` and `PersistedGrantDb/` for IdentityServer operational store
- **Manual SQL scripts**: `scripts/` folder with environment-specific SQL (`dev/`, `qa/`, `preprod/`, `prod/`, `automation/`, `tbc_uz/`)

### Repository Pattern

**Generic base**: `RepositoryBase<TEntity, TEntityId>` implements standard CRUD with `SaveChangesAsync` per operation.

**17 repository implementations** in `Persistence/Repositories/`:

| Repository | Extra Capabilities |
|---|---|
| `UserRepository` | Uses **Dapper** for raw SQL (e.g., `GetScaCache` with complex joins), `UserManager<User>` for Identity operations |
| `ScaArchiveRepository` | Raw SQL transactions: `BEGIN; WITH deleted AS (DELETE ... RETURNING *) INSERT INTO archive; COMMIT` |
| `TelecomOneTimePasswordRepository` | Raw SQL for archival, `ExecuteUpdateAsync` for partial updates |
| `ProviderDeactivatedPhoneNumberArchiveRepository` | Raw SQL `WITH DELETE/INSERT` for archive moves |

### Connection Resilience

Password hashing uses `PasswordHasherOptions.IterationCount = 10000` (PBKDF2). `User.RehashNeeded()` checks if existing hashes need re-hashing.

---

## 7. Messaging & Event Handling

### Message Broker

**Kafka** (via `Space.Service.Common.EventBus`). Registered in `InfrastructureExtensions.cs`:
```csharp
services.AddEventBus(configuration, typeof(IdentityDbContext))
```
Custom CA certificates for Kafka are installed in the Docker image (`ca_cert_kafka.pem`).

### Published Events (Outbound)

| Event Class | Topic Pattern | Purpose |
|---|---|---|
| `UserCreatedEvent` | `identity` / `user-created` | New user registered |
| `UserLoggedInEvent` | `identity-login` / `user-logged-in-event` | User authenticated successfully |
| `UserLoggedOutEvent` | `identity` / `user-logged-out` | User logged out |
| `UserStatusChangedEvent` | `identity` / `user-status-changed` | User blocked/unblocked/status change |
| `UserPhoneNumberProvidedEvent` | `identity` / `phone-number-provided` | User phone number confirmed |
| `UserUpdatedEvent` | `identity` / `user-updated` | User record updated |
| `UserCheckedEvent` | `dwh.identity` / `dwh.user.checked` | DWH: user existence check audit |
| `UserLanguageChangeEvent` | `identity` / `user-changed-language` | User changed preferred language |
| `UserUnblockedEvent` | `identity` / `crm-user-unblocked` | CRM user unblocked |
| `UserAgreementsCreatedEvent` | `identity` / `user-agreements-created` | User signed agreements |
| `TrustedDeviceCreatedEvent` | `identity` / `user-trusted-device-created` | Device trusted |
| `TrustedDeviceDeactivatedEvent` | `identity` / `trusted-device-deactivated` | Device trust removed |
| `DeviceVerifiedEvent` | (identity) | Device verified via face comparison |
| `LocalAuthenticationDataUpdatedEvent` | `identity` / `local-authentication-updated` | Biometric enrollment updated |
| `LocalAuthenticationDataDeletedEvent` | `identity` / `local-authentication-deleted` | Biometric enrollment removed |
| `OtpVerifiedEvent` | `dwh.identity` / `dwh.otp.verified` | DWH: OTP verification audit |
| `DetectAuthorizationThreatEvent` | `threatdetection` / `detect-authorization-threat-v2` | Fraud detection trigger |
| `CreateAutomaticCrmCaseEvent` | `customercase` / `create-automatic-case` | Auto-create CRM case |
| `SendSmsNotificationCommand` | `notification` / `send-sms` | Send SMS notification |
| `SendOtpBlockNotificationEvent` | `notification` / `send-sms-to-phonenumber` | Send OTP block SMS |
| `SendEmailCommand` | (notification) | Send email (confirmation, reports) |
| `SendSimpleTypePushNotificationCommand` | (notification) | Push notification for auto-trust |

### Consumed Events (Inbound)

| Consumer Command | Event Key | Action Triggered |
|---|---|---|
| `CreateCustomerCommand` (Sync) | `customer-created` | Create local Customer record |
| `CreateCoreBankingCustomerCommand` | `corebanking-customer-created` | Link core-banking correlation ID |
| `CreateProcessingCenterCustomerCommand` | `processingcenter-customer-created` | Set processing center ID |
| `UpdateCustomerCommand` | `customer-updated` | Update customer data |
| `VerifyCustomerCommand` | `customer-verified` | Mark customer as verified |
| `UpdateCustomerProfileLegacyCommand` | `customer-email-updated-legacy` | Legacy: update email |
| `UserCreatedCommand` (Sync) | `user-created` | Store registration device info |
| `UserLoggedInCommand` | `user-logged-in-event` | Update login logs, store device info |
| `UserStatusUpdatedCommand` | `user-status-updated` | Sync user status from external source |
| `UserLockoutEndUpdatedCommand` | `user-lockout-end-updated` | Update lockout end date |
| `UserLoggedOutCommand` | `user-logged-out` | Update logout timestamp in login logs |
| `UserBlockedCommand` | `user-blocked` | Block user from external trigger |
| `UserBlacklistedCommand` | `user-blacklisted` | Blacklist user (revoke tokens + block) |
| `IncrementResetPasswordFailedCountCommand` | `increment-recover-passcode-failed-count` | Increment failed recovery counter |
| `BaasCreateUserCommand` | `baas-user-created` | Create user from BaaS platform |
| `ResetPasswordCommand` | `password-reseted` | Reset password from external |
| `UpdatePasswordCommand` | `password-changed` | Sync password change |
| `UpdateUserPhoneNumberCommand` | `phonenumber-changed` | Sync phone number change |
| `SpoilPhoneNumberCommand` | `phonenumber-spoiled` | Invalidate phone number |
| `AddBusinessProfileCommand` | `business-profile-created` | Create business profile |
| `BusinessProfileStatusChangeCommand` | `business-profile-status-changed` | Update business profile status |
| `TrustedDeviceCreatedCommand` | `trusted-device-created` | Sync trusted device from event |
| `TrustedDeviceDeactivatedCommand` | `trusted-device-deactivated` | Sync device trust removal |
| `UntrustedDeviceVerifiedCommand` | `untrusted-device-verified` | Record untrusted device verification |
| `UntrustedDeviceUnverifiedCommand` | `untrusted-devices-unverified` | Remove all unverified devices |
| `UpdateLocalAuthenticationSyncCommand` | `localAuthentication-updated` | Sync biometric enrollment |
| `DeleteLocalAuthenticationSyncCommand` | `localAuthentication-deleted` | Sync biometric removal |
| `UserPhoneNumberRequestedCommand` | `phone-number-requested` | Provide phone number to requester |

### Event Handling Patterns

- **Outbox pattern**: EventBus integrates with `IdentityDbContext` (`AddEventBus(configuration, typeof(IdentityDbContext))`) for transactional outbox
- **Unit of Work**: `IUnitOfWork` + `BeginTransactionAsync` used for operations combining repository writes + event publishing
- **Consumer endpoints**: Exposed via `UseEventEndpoints()` middleware — Kafka consumer webhook pattern rather than background polling

---

## 8. Background Jobs & Scheduled Tasks

All workers inherit from `CronBackgroundServiceBase` (cron-scheduled) and are registered in `InfrastructureExtensions.cs`.

| Worker | Schedule Source | Purpose | Notes |
|---|---|---|---|
| `DeleteExpiredOtpsWorker` | `DeleteExpiredOtpsWorkerOptions.Cron` (IncludeSeconds) | Delete OTPs older than `OlderThanInHours` | Always active |
| `ArchiveScaCodesWorker` | `ArchiveScaCodesOptions.Cron` (default `"0 0 * * *"`) | Move expired SCA codes to archive table | `Enabled` flag, default `false` |
| `ArchiveTelecomOneTimePasswordsWorker` | `ArchiveTelecomOneTimePasswordsOptions.Cron` | Archive telecom OTPs older than threshold | `Enabled` flag, default `false` |
| `UsersUnlockTmxLockoutWorker` | `UsersUnlockTmxLockoutWorkerOptions.Cron` | Unlock users blocked by ThreatMetrix; batches of 50, produces `UserStatusChangedEvent` per user within a DB transaction | Always active |
| `GenerateTelecomFailuresReportWorker` | `GenerateTelecomFailuresReportWorkerOptions.Cron` | Generate CSV report of failed telecom verifications, upload to storage, email to configured recipient | Always active |
| `AutoTrustUserDeviceWorker` | `AutoTrustUserDeviceWorkerOptions.Cron` | Auto-trust devices after minimum login hours | **Currently stubbed** — handler commented out, logs "disabled" |
| `FetchDeviceNameMappingWorker` | `FetchDeviceNameMappingWorkerOptions.Cron` | Fetch device manufacturer/model CSV from external URL, parse and store mappings | `Enabled` flag |
| `ProviderDeactivatePhoneNumberWorker` | `ProviderDeactivatePhoneNumberWorkerOptions.Cron` | Process pending provider-deactivated phone numbers; calls `ProviderSpoilPhoneNumberCommand` per item with retry up to `MaxFailedAttempts` | Always active |
| `ProviderDeactivatePhoneNumberArchiveWorker` | `ProviderDeactivatePhoneNumberWorkerOptions.CronArchive` | Move completed/failed deactivations to archive table | Always active |
| `ProviderDeactivatePhoneNumberReportWorker` | `ProviderDeactivatePhoneNumberReportWorkerOptions.Cron` | Generate and email report of provider deactivated phone numbers | `Enabled` flag |

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Framework**: Serilog (configured via `UseSerilog()` in `Program.cs`)
- **Structured logging**: All log entries are structured; `LoggingBehavior` in MediatR pipeline logs serialized request/response
- **Sensitive data masking**: `[SensitiveData]` attribute (from `Space.Service.Common.Logging`) masks PII in logs as `"*** HIDDEN ***"`
- **Log sinks**: Configured externally (likely Elasticsearch/Kibana based on `create-kibana-alert-rules.yaml` workflow)
- **APM**: Elastic APM spans instrumented in `ScaGrantValidator`

### Health Checks

Registered via `services.AddHealthChecks(configuration)` and exposed via `UseHealthCheckMiddleware(env)`. From `Space.Service.Common.HealthChecks`.

### Metrics & Monitoring

- **Prometheus**: `prometheus-net.AspNetCore` 8.2.1 with `UseHttpMetrics()` middleware and `MapMetrics()` endpoint
- **Static labels**: `PrometheusUtils.SetPrometheusStaticLabels()` for service identification

### Feature Toggles

- **Provider**: GrowthBook via `Space.Service.Common.FeatureToggle`
- **Registration**: `services.AddFeatureToggle(configuration)` in `ApplicationExtensions.cs`
- **Constants**: `Feature.LoginWhitelist = "modernization-login-whitelist"` in `Application/Features/Feature.cs`
- **Runtime toggle in infrastructure**: `detect_authorization_threat_by_formica` checked in `AuthorizationFraudCheckService`

### Configuration Management

**Configuration sources** (in `Program.cs`, non-local environments):
```
/settings/globalsettings.json     — shared platform settings (watched for live reload)
/settings/appsettings.json        — service-specific settings (watched)
/settings/dbsettings.json         — database connection strings (watched)
```

**Options pattern**: 30+ strongly-typed options classes in `Application/Options/`, each bound via `services.Configure<T>()` or `services.AddOptions<T>()` with validation.

**Key configuration groups**:

| Options Class | Purpose |
|---|---|
| `OtpOptions` | OTP generation/verification params: length, max tries, expiry, supported symbols |
| `LockoutOptions` | Temporary lockout thresholds, duration, permanent block threshold |
| `PasswordOptions` | Password length, blacklist |
| `PhoneNumberOptions` | Phone format: length, regex, prefix |
| `IdentityServerOptions` | Token lifetimes, signing cert, license key |
| `ScaOptions` | SCA cache TTL, device registration minimum hours |
| `CacheTllOptions` | Redis TTLs for trusted devices, lockout duration |
| `RecoverPasscodeOptions` | Daily limits for passcode recovery attempts |
| `AIphoriaTokenOptions` | Encryption keys and expiry for AI tokens |
| `TelecomAntiFraudTenantBasedAuthClientOptions` | Per-tenant telecom auth credentials |
| `EmailConfirmationOptions` | Email confirmation base URL |
| Various `*WorkerOptions` | Cron schedules, enabled flags, thresholds for background jobs |

### Localization

Three supported locales with resource files in `Application/Resources/`:
- `SharedResources.en-US.resx`
- `SharedResources.ru-RU.resx` (embedded resource)
- `SharedResources.uz-Latn-UZ.resx`

Used via `IStringLocalizer<SharedResources>` for validation/error messages.

### Data Protection

ASP.NET Core Data Protection keys persisted to PostgreSQL via `PersistKeysToDbContext<IdentityDbContext>()` (`DataProtectionKeys` DbSet).

### Thread Pool Tuning

```csharp
ThreadPool.SetMinThreads(minWorkerThreads, minCompletionPortThreads);
```
Configured from `ThreadPool:MinWorkerThreads` / `ThreadPool:MinCompletionPortThreads` settings.

---

## 10. Testing

### Test Projects Overview

| Project | Type | Framework | Purpose |
|---|---|---|---|
| `Space.Service.Identity.UnitTests` | Unit | xUnit | Test handlers, services, repositories in isolation |
| `Space.Service.Identity.ComponentTests` | Integration/Component | xUnit | Test full API flows with real DB |
| `Space.Service.Identity.ArchitectureTests` | Structural | xUnit + NetArchTest | Enforce layer dependency rules |

### Testing Frameworks & Libraries

| Library | Version | Role |
|---|---|---|
| xUnit | (latest) | Test framework |
| NSubstitute | 5.3.0 | Mocking framework |
| FluentAssertions | 7.2.0 | Assertion library |
| AutoFixture | 4.18.1 | Test data generation |
| NetArchTest.Rules | 1.3.2 | Architecture rule enforcement |
| Microsoft.AspNetCore.Mvc.Testing | 9.0.9 | `WebApplicationFactory<Program>` for integration tests |
| Testcontainers.PostgreSql | 4.7.0 | Real PostgreSQL 15-alpine for component tests |
| Testcontainers.MongoDb | 4.7.0 | Real MongoDB for digital signature repo unit tests |
| WireMock.Net | 1.14.0 | HTTP mock server for external service calls |
| RichardSzalay.MockHttp | — | HTTP message handler mocking |
| Serilog.Sinks.TestCorrelator | — | Log assertion in tests |
| EF Core InMemory | 9.0.9 | Lightweight DB for unit tests |

### Test Conventions

- **Naming**: `MethodName_Condition_ExpectedResult`
- **Pattern**: AAA (Arrange, Act, Assert) with explicit comments
- **Collection sharing**: `[Collection("SharedFixtures")]` with `SharedFixtureCollection`

### Unit Test Fixtures

| Fixture | Purpose |
|---|---|
| `InMemoryDbContextFixture` | EF Core InMemory provider + seeded data via `IdentityDbInitializer` |
| `UserManagerFixture` | NSubstitute mock of `UserManager<User>` with `IUserPasswordStore<User>` and `IPasswordHasher<User>` |
| `MapperFixture` | Object mapping configuration |
| `LocalizerFixture` | `IStringLocalizer<SharedResources>` setup |
| `TestMongoDbContextFixture` | Real MongoDB via Testcontainers for `EimzoSignatureRecordRepository` tests |

### Component Test Infrastructure

| Component | Detail |
|---|---|
| `CustomWebApplicationFactory<Program>` | Replaces `IdentityDbContext` with real Testcontainers PostgreSQL; stubs `IAuthorizationHandler` (all-allow), `IEventBus`, `ISuperCache`, `ICachingService`, `IScaService`, `RequestMetadata` |
| `PostgresTestContainerFixture` | `postgres:15-alpine` Testcontainer, xUnit `IAsyncLifetime` |
| `WireMockServerFixture` | WireMock on port 5981 for mocking CoreApiFacade, IdentityServer, ThreatDetection |
| `IdentityDbInitializer` | Seeds ~13 users, devices, OTPs, local auths, registration devices into real PostgreSQL |
| `DbContextExtensions.Truncate<TEntity>` | `TRUNCATE TABLE "X" RESTART IDENTITY CASCADE` for test isolation |

### Architecture Tests

17 rules enforced via `NetArchTest.Rules`:

| Rule Category | Examples |
|---|---|
| **Layer isolation** | Controllers cannot depend on Persistence, Domain, or Infrastructure |
| **Dependency direction** | Domain depends on nothing; Application depends on no outer layer |
| **Naming conventions** | Controllers end with `Controller`; Handlers end with `CommandHandler`/`QueryHandler`; `[ConsumeEvent]` types end with `Command` |
| **Inheritance** | All controllers extend `ApiControllerBase`; controllers depend on MediatR |

### Test Coverage by Feature

```
UnitTests/Application/Features/
├── Agreement/             — CreateAgreements, Queries
├── AIphoria/              — Token generation
├── Customer/              — CreateCustomer
├── Device/                — SetTrusted, Deactivate, Verify, Forget, AutoTrust, FetchMapping
├── DeviceAuthFlow/        — GenerateCodes, CheckUserCode, LoginWithDeviceCode
├── DigitalSignature/      — InitiateMobileSignature
├── ExternalAuth/          — CapCallback
├── LocalAuthentication/   — Update, Delete
├── Otp/                   — Generate, Verify, V2 variants
├── Provider/              — DeactivatePhoneNumber
├── Sca/                   — StartFlow, CheckFactors, GenerateCode
├── Telecom/               — SmsDeliveryStatus, GenerateReport
└── User/                  — Create, Login, Logout, ChangePasscode, RecoverPasscode, PhoneNumberChange, Block/Unblock, etc.

UnitTests/Persistence/Repositories/
├── 14 repository test classes with InMemory DB

ComponentTests/Controllers/
├── CustomerControllerTests, DeviceControllerTests, LocalAuthenticationControllerTests
├── OtpControllerTests, ScaControllerTests, UserControllerTests

ComponentTests/Events/
├── ResetUserPasswordTests, UpdateUserPasswordTests, UpdateUserPhoneNumberTests
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
ENTRYPOINT ["dotnet", "Space.Service.Identity.Api.dll"]
```

| Aspect | Detail |
|---|---|
| **Base image** | `mcr.microsoft.com/dotnet/aspnet:9.0` (runtime-only, no SDK) |
| **Multi-stage** | Build is done externally (CI pipeline); Dockerfile only packages the publish output |
| **Custom CA certs** | Installs `ca_cert.pem` (general) + `ca_cert_kafka.pem` (Kafka broker TLS) |
| **Port** | Listens on port 80 (HTTP internally; TLS terminated at load balancer) |

### CI/CD Pipelines

All workflows delegate to reusable workflows in `SpaceBank/Space.Service.Workflows`:

#### `ci-cd.yaml` — Main Pipeline (push to `master`)

| Aspect | Detail |
|---|---|
| **Trigger** | Push to `master` (excludes `.github/`, `scripts/`, `tools/`, docs) + manual dispatch |
| **Docker image** | `space-service-identity` |
| **ArgoCD app** | `space-service-identity` |
| **Environments** | `dev-uz` → `automation-uz` → `qa-uz` → `preprod-uz` → `prod-uz` |
| **Pact** | Publishes provider + consumer contracts, can-I-deploy check, records deployment |
| **Sanity check** | Enabled |

#### `cd.yaml` — Manual Deploy

| Aspect | Detail |
|---|---|
| **Trigger** | `workflow_dispatch` with environment choice |
| **Environments** | Same 5 environments |
| **Sanity check** | Enabled |

#### `pull-request.yaml` — PR Checks

| Aspect | Detail |
|---|---|
| **Trigger** | Pull request (all types) |
| **Steps** | Build, test, Pact contract validation |

#### Other Workflows

| Workflow | Purpose |
|---|---|
| `stryker.yaml` | Mutation testing with Stryker.NET |
| `zaproxy.yaml` | OWASP ZAP security scanning |
| `update-packages.yaml` | Automated NuGet package updates |
| `dora.yaml` | DORA metrics tracking |
| `notify.yaml` | Deployment notifications |
| `generate-readme.yaml` | Auto-generate README |
| `create-kibana-alert-rules.yaml` | Kibana alerting rules provisioning |
| `sync-copilot-configs.yaml` | Sync GitHub Copilot customization files |
| `assign-copilot.yaml` | Assign Copilot seats |

### Environment Configurations

| Environment | Config Source |
|---|---|
| **Local** | `appsettings.Local.json` + User Secrets; dev signing credential for IdentityServer |
| **Non-Local** | Mounted JSON files at `/settings/globalsettings.json`, `/settings/appsettings.json`, `/settings/dbsettings.json` with live-reload |

### Orchestration

- **ArgoCD**: GitOps-based Kubernetes deployment (`argocd_app_name: space-service-identity`)
- **Docker**: Single-container deployment (no Docker Compose in repo)
- **Per-environment SQL scripts**: `scripts/tbc_uz/{env}/` for environment-specific database operations

---

## 12. External Service Dependencies

### HTTP Clients (via `AddRestClient<T>()` — RestEase)

| Interface | Type | Base URL Source | Description |
|---|---|---|---|
| `ICoreApiFacadeClient` | Internal | `CoreApiFacadeClientOptions` | Create users in core banking facade; `POST api/v1/user` |
| `IThreatDetectionClient` | Internal | `ThreatDetectionClientOptions` | Fraud checks: user registration, phone change, passcode change, local auth change, business banking login |
| `IVerificationClient` | Internal | `VerificationClientOptions` | Session management: phone number change sessions, customer onboarding, document verification (`POST api/v3/verification/checkdocument`) |
| `ICoreBankingForwardProxyClient` | External | `CoreBankingForwardProxyClientOptions` | Core banking (IABS) operations: get/update customer by personal number or phone, update phone number |
| `IEimzoClient` | External | `EimzoClientOptions` | E-imzo digital signatures: generate document ID, check upload status, verify mobile signature, PKCS7 timestamp & verify |
| `ITelecomAntiFraudClient` | External | `TelecomAntiFraudClientOptions` | Telecom anti-fraud: send/verify OTPs, check account status, confirm face |
| `ITelecomAntiFraudAuthClient` | External | `TelecomAntiFraudAuthClientOptions` | OAuth token acquisition for telecom anti-fraud API |
| `IDeviceNameSyncClient` | External | `FetchDeviceNameMappingWorkerOptions.SourceUrl` | Fetch device model/branding CSV |

### Named HTTP Client

| Name | Purpose |
|---|---|
| `"IdentityServer"` | Internal IdentityServer token/revocation calls; adds `X-Source: Space.Service.Identity.Api` header |

### Client Configuration Pattern

All clients use `AddRestClient<TInterface>(configuration, "OptionsKey")` from `Space.Service.Common.RestClient`:
- `[InternalApiClient("ServiceName")]` — service discovery–based URL resolution for internal services
- `[ExternalApiClient]` — explicit base URL from options

### Resilience Policies

The telecom anti-fraud service (`TelecomAntiFraudService`) implements:
- Token caching in Redis to avoid excessive OAuth calls
- Feature toggle–based circuit breaking (disable telecom integration via toggle)
- Error handling with custom `AppException` wrapping

General HTTP resilience is configured at the `Space.Service.Common.RestClient` level (shared platform library).

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Reference Table

| Pattern | Where Used | Why |
|---|---|---|
| **Clean Architecture** | Project structure (Api → Application → Domain) | Enforce dependency inversion; domain purity; testability |
| **CQRS** | `Application/Features/*/Commands/` and `Queries/` | Separate read/write concerns; single-responsibility handlers |
| **MediatR** | All controllers dispatch via `IMediator` | Decouple controllers from business logic; enable pipeline behaviors |
| **Repository Pattern** | `Application/Repositories/` (interfaces) + `Persistence/Repositories/` (impl) | Abstract data access; enable unit testing with InMemory DB |
| **Outbox Pattern** | `AddEventBus(config, typeof(IdentityDbContext))` | Transactional consistency between DB writes and Kafka events |
| **Event-Driven Architecture** | 22+ produced events, 27+ consumed events via Kafka | Loose coupling with downstream services; eventual consistency |
| **Feature Toggles (GrowthBook)** | `IFeatureToggle` in handlers and services | Runtime feature control without redeployment |
| **Soft Delete** | `SoftDeletedEntityBase<T>` → `LocalAuthentication` | Preserve audit trail for biometric enrollments |
| **Sequential GUIDs** | `SequentialEntityBase` → `RT.Comb.Provider.PostgreSql` | Reduce index fragmentation on PostgreSQL |
| **SCA (Strong Customer Authentication)** | `Features/Sca/` + Redis cache + custom grant validator | PSD2-compliant multi-factor authentication |
| **Custom OAuth Grant Types** | `ScaGrantValidator` (sca), `UserIdGrantValidator` (userId) | Domain-specific token issuance flows |
| **Architecture Tests** | `ArchitectureTests.cs` with 17 NetArchTest rules | Prevent architectural drift; enforce naming conventions |
| **Sensitive Data Masking** | `[SensitiveData]` attribute throughout DTOs and entities | PII protection in logs per GDPR/banking regulations |
| **Options Validation** | Custom `Validate()` + `ValidateOnBuild = true` | Fail-fast on misconfiguration at startup |
| **Testcontainers** | PostgreSQL 15 + MongoDB in tests | Real database behavior in CI without external dependencies |
| **WireMock** | Component tests for external HTTP calls | Deterministic external service simulation |
| **Background Workers (Cron)** | 10 `CronBackgroundServiceBase` workers | Scheduled maintenance: OTP cleanup, archival, reports, unlocking |
| **Multi-tenancy** | `TenantId` in login logs, tenant-based telecom auth config | Support multiple banking brands (TBC UZ, business banking) |

### Notable Deviations

| Observation | Detail |
|---|---|
| **Infrastructure references Persistence** | `Infrastructure` project directly references `Persistence` (for `IdentityDbContext` in workers). Strict Clean Architecture would route through Application interfaces only. This is a pragmatic trade-off for worker classes that need direct DB access. |
| **Some raw SQL** | `ScaArchiveRepository`, `TelecomOneTimePasswordRepository`, `ProviderDeactivatedPhoneNumberArchiveRepository` use raw SQL for bulk archive operations — acceptable for performance-critical bulk moves not expressible in EF Core LINQ. |
| **IdentityServer config in Persistence** | `ProfileService`, `ScaGrantValidator`, `CustomTokenRequestValidator` live in Persistence layer rather than Infrastructure. These classes need direct access to `IdentityDbContext` and `UserManager<User>`. |
| **Dapper in UserRepository** | `GetScaCache` uses Dapper for complex joins — practical choice when EF Core query would be overly complex. |
| **AutoTrustUserDeviceWorker is stubbed** | Handler commented out, logs "disabled". Feature was built but not yet activated. |

### Technical Debt & Improvement Opportunities

| Area | Observation |
|---|---|
| **Obsolete endpoint** | `LoggedOutPhoneNumberChange` is marked `[Obsolete]` — candidate for removal |
| **V1/V2 duplication** | Several commands have V1 and V2 variants with near-identical code (e.g., `GenerateOtpCommand`/`GenerateOtpV2Command`, `ChangePasscodeCommand`/`ChangePasscodeV2Command`) — could potentially be consolidated with version-specific behavior injection |
| **Stubbed worker** | `AutoTrustUserDeviceWorker` is fully implemented but disabled — either enable or remove dead code |
| **Password hashing** | PBKDF2 with 10,000 iterations is below modern recommendations (≥600,000 for PBKDF2-SHA256 per OWASP 2023). `RehashNeeded()` exists but targets same 10,000 count |
| **ShowPII flag** | `IdentityModelEventSource.ShowPII = true` in non-production — ensure this is properly toggled off in production |
| **Mixed raw SQL** | Some repositories use raw SQL strings (archive operations) — these bypass EF Core change tracking and migrations. Consider maintaining as stored procedures or at minimum as SQL resources |
| **`ValidateScopes = false`** | DI scope validation disabled in `Program.cs` — could mask scoped-in-singleton bugs |
| **Template SQL scripts** | `scripts/template.sql` and per-environment SQL scripts outside EF migrations — risk of migration divergence |

---

*Generated from codebase analysis on 2026-04-02. Based on commit state at time of `git pull`.*
