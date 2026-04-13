# Space.Service.Common.Misc — Service Analysis

> **Generated:** April 2, 2026  
> **Runtime:** .NET 9.0 / C# (latest major)

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

`Space.Service.Common.Misc` — a shared NuGet class library for the **Space Banking** (SpaceBank / Space Neobank) microservice ecosystem.

### Purpose & Core Business Problem

This is **not a standalone microservice** — it is a **cross-cutting shared library** that provides common types, utilities, encryption services, JSON converters, constants, and enums consumed by all downstream Space Banking microservices. It solves the problem of code duplication across a microservice fleet by centralizing:

- Domain enums and constants (currencies, countries, tenants, card networks, operations, etc.)
- Encryption/decryption services (AES-CBC, AES-GCM) with versioned key rotation
- JSON serialization customization for both `System.Text.Json` and `Newtonsoft.Json`
- ASP.NET Core DataProtection backed by Redis
- Request metadata and distributed tracing propagation
- DateTime/timezone utilities for multi-tenant, multi-country operations
- Localization and culture info management
- YARP reverse-proxy configuration validation
- Maintenance window detection logic

### Domain Context

The library sits within a **banking/fintech bounded context** serving TBC Bank Uzbekistan (`tbc_uz`), TBC UZ Business (`tbc_uz_business`), and Payme UZ (`payme_uz`). It operates across multiple sub-domains:

| Sub-domain | Evidence |
|---|---|
| Cards & Payments | `Enums/Card/`, `ProcessingCenter`, `CardNetwork`, `CardStatus`, `BlockCardReason` |
| Lending / Credit Cards | `Enums/Loan/`, `Enums/CreditCard/`, `CreditCard.ApplicationStatus` |
| Customer Onboarding | `Operation.Registration`, `Operation.CheckCustomer`, `Operation.CreateCustomer` |
| Business Banking | `Enums/BusinessBanking/`, `Operation` range 1000–2000 |
| CRM & Case Management | `Enums/Crm/`, `CrmCaseSubject`, `CrmRejectionReason` |
| Loyalty | `Enums/Loyalty/` |
| Threat Detection | `Enums/ThreatDetection/` |
| Delivery/Logistics | `Enums/Delivery/` |
| Customer Statements | `Enums/CustomerStatement/` |
| User Management | `Enums/User/` |

### Key Entities and Domain Models

| Model | File | Purpose |
|---|---|---|
| `RequestMetadata` | [RequestMetadata.cs](Space.Service.Common.Misc/RequestMetadata.cs) | Encapsulates per-request identity/tracing: `TenantId`, `UserId`, `CustomerId`, `CoreBankingCustomerId`, `BankingPlatformCustomerId`, `Platform`, etc. Auto-propagates values to `Activity.Current` tags. |
| `Money` | [Money.cs](Space.Service.Common.Misc/Money.cs) | Value object representing an amount + currency code with `+` operator (validates matching currencies). |
| `ApiProblemDetails` | [ApiProblemDetails.cs](Space.Service.Common.Misc/ApiProblemDetails.cs) | Extended RFC 7807 problem details with `TraceId` (from Elastic APM or `Activity`), `ValidationErrors`, `Severity`, and `ExternalEndpoint`. |
| `WidgetBase` / `WidgetData` / `WidgetText` | [WidgetBase.cs](Space.Service.Common.Misc/WidgetBase.cs) | UI widget model for mobile app surfaces (title, header, description, background, icon with dark/light mode support). |
| `MaintenanceOptions` / `CardOperationMaintenanceModel` | [Maintenance/](Space.Service.Common.Misc/Maintenance/) | Models for configuring card operation maintenance windows (planned/unplanned) with processing center granularity. |
| `EncryptionOptions` | [Options/EncryptionOptions.cs](Space.Service.Common.Misc/Options/EncryptionOptions.cs) | Hierarchical config mapping: `{serviceName} → {version} → {method, key}` for versioned encryption. |
| `RedisOptions` | [Options/RedisOptions.cs](Space.Service.Common.Misc/Options/RedisOptions.cs) | Redis connection config: hosts, port, database, credentials, SSL toggle. |

### Main Use Cases

1. **Encrypt/decrypt sensitive data** — consumed by all services needing field-level encryption (AES-CBC/GCM with key rotation via `VersionedEncryptionService`).
2. **Serialize/deserialize JSON** — standardized `DateTimeUtcConverter`, `CustomDecimalConverter`, `ConditionalEnumConverterFactory`, `EncryptedStringConverter` used globally.
3. **Propagate request context** — `RequestMetadata` flows tenant, user, customer IDs and platform through the distributed system via `Activity` tags.
4. **Protect ASP.NET DataProtection keys** — custom XML encryption/decryption backed by Redis.
5. **Validate YARP proxy configs** — detects duplicate route IDs, dangling cluster references, and path/method overlaps at startup.
6. **Detect maintenance windows** — `CheckCardOperationMaintenance()` evaluates if card operations are blocked by planned/unplanned outages per processing center.
7. **Convert locale-specific data** — Uzbek Latin ↔ English transliteration, Qaraqalpaq ↔ Uzbek, city/region code mappings (MVD → CBU), country code normalization.
8. **Check End-of-Day (EOD) status** — `CheckEOD()` determines if banking EOD processing is active for a given tenant.
9. **Generate/validate JWTs** — `CreateJwt()` / `ValidateJwt()` using HMAC-SHA256 symmetric keys.
10. **Setup standard ASP.NET Core services** — API versioning, localization, Elastic APM, Prometheus metrics, data protection, controller JSON configuration.

---

## 2. Architecture

### Architectural Pattern

This is a **flat utility library** — not a layered application. There is no Clean Architecture, Hexagonal, or CQRS pattern because this is a **shared NuGet package**, not a deployable service. The organization follows a **feature/concern-based folder structure**.

### Project Structure Breakdown

```
Space.Service.Common.Misc/              # Main library (.NET 9.0 class library, packaged as NuGet)
├── Constants/                           # Static immutable lookup data
│   ├── CityCodes.cs                     #   MVD→CBU city code mapping (ImmutableDictionary)
│   ├── CountryCodes.cs                  #   Country code constants ("UZ")
│   ├── CultureInfos.cs                  #   Supported CultureInfo definitions (uz-Latn, en-US, ru-RU)
│   ├── RegionCodes.cs                   #   MVD→CBU region code mapping
│   └── TenantIds.cs                     #   Tenant ID constants (tbc_uz, tbc_uz_business, payme_uz)
├── DataProtection/                      # ASP.NET Core DataProtection custom encryption
│   ├── CustomXmlDecryptor.cs            #   Decrypts XML key ring elements using AES
│   └── CustomXmlEncryptor.cs            #   Encrypts XML key ring elements using AES
├── Encryption/                          # Field-level encryption services
│   ├── EncryptedAttribute.cs            #   [Encrypted("keyName")] property attribute
│   ├── EncryptionResolver.cs            #   STJ TypeInfo modifier: auto-applies EncryptedStringConverter
│   ├── EncryptionService.cs             #   Simple IConfiguration-based encrypt/decrypt
│   ├── IEncryptionService.cs            #   Abstraction for encrypt/decrypt by key name
│   └── VersionedEncryptionService.cs    #   Versioned encryption with key rotation (AES-CBC + AES-GCM)
├── Enums/                               # Domain enumerations (organized by sub-domain)
│   ├── AccountingType.cs, AgreementType.cs, BankCode.cs, Channel.cs, Color.cs,
│   │   CountryCode.cs (ISO 3166-1), CurrencyCode.cs (ISO 4217), DocumentDeliveryType.cs,
│   │   EncryptionMethods.cs, MaintenanceErrorCode.cs, NotificationChannel.cs,
│   │   Operation.cs, OperationSourceType.cs, OperationStatus.cs, Platform.cs,
│   │   ThirdPartySystem.cs
│   ├── BusinessBanking/                 #   AmlStatus, BusinessProfileStatus
│   ├── Card/                            #   CardStatus, CardNetwork, CardForm, CardType,
│   │                                    #   ProcessingCenter, BlockCardReason, CardOperationType, etc.
│   ├── CreditCard/                      #   ApplicationStatus
│   ├── Crm/                             #   CrmCaseSubject, CrmContactLabel/Labels, CrmRejectionReason
│   ├── CustomerChecks/                  #   (sub-domain enums)
│   ├── CustomerStatement/               #   (sub-domain enums)
│   ├── Delivery/                        #   (sub-domain enums)
│   ├── Loan/                            #   (sub-domain enums)
│   ├── Loyalty/                         #   (sub-domain enums)
│   ├── Questionnaire/                   #   (sub-domain enums)
│   ├── Scoring/                         #   (sub-domain enums)
│   ├── ThreatDetection/                 #   (sub-domain enums)
│   └── User/                            #   (sub-domain enums)
├── JsonConverters/                      # Custom JSON serialization converters
│   ├── ConditionalEnumConverterFactory.cs  # Enum→string or enum→int based on [SerializeAsInt]
│   ├── CustomDecimalConverter.cs           # Configurable decimal precision (STJ)
│   ├── DateTimeUtcConverter.cs             # Forces DateTime to UTC (STJ)
│   ├── EncryptedStringConverter.cs         # Auto-encrypt/decrypt string properties (STJ)
│   ├── EnumConverterWithDefault.cs         # Newtonsoft: unknown enum values → default(0)
│   ├── NumberToDecimalJsonConverter.cs     # Handles infinite float→decimal (STJ)
│   ├── SerializeAsIntAttribute.cs          # Marker attribute for integer enum serialization
│   └── Newtonsoft/
│       └── NumberToDecimalJsonConverter.cs  # Newtonsoft equivalent of above
├── Maintenance/                         # Maintenance window models
│   ├── MaintenanceOptions.cs            #   Top-level options holding CardOperations list
│   └── Models/
│       ├── CardOperationMaintenanceModel.cs  # Per-processing-center maintenance window
│       └── MaintenanceType.cs                # Planned vs Unplanned
├── Options/                             # Configuration POCO classes
│   ├── EncryptionOptions.cs             #   Versioned encryption key config
│   └── RedisOptions.cs                  #   Redis connection parameters
├── Utils/                               # Extension methods and utility classes
│   ├── ApplicationBuilderUtils.cs       #   UseLocalization(), UseVersionEndpoint(), UseEventEndpoints()
│   ├── CityCodeUtils.cs                 #   MVD→CBU city code lookups
│   ├── CommonUtils.cs                   #   JSON config, IP address extraction, JWT create/validate,
│   │                                    #   EOD checks, maintenance checks, file operations, AddJson()
│   ├── ConfigurationUtils.cs            #   Watch() for settings file change detection via hash comparison
│   ├── CountryCodeUtils.cs              #   CBU→ISO country code conversion
│   ├── CustomSystemTextJsonOutputFormatter.cs  # Custom MVC output formatter with nullable annotations
│   ├── DateTimeUtils.cs                 #   ISO formatting, tenant timezone conversion
│   ├── DecimalUtils.cs                  #   ToAmountString(), ToMoneyString(), ToPercentString(), Normalize()
│   ├── EnumUtils.cs                     #   GetEnumMemberValue() via reflection
│   ├── IHostUtils.cs                    #   WarmUp() — eagerly resolves all DI registrations at startup
│   ├── LanguageConversionUtils.cs       #   Uzbek Latin→English and Qaraqalpaq Latin→Uzbek transliteration
│   ├── LocalizationUtils.cs             #   GetLocalizedStringWithDefaultCulture()
│   ├── ProcessingAwaiter.cs             #   Polling retry utility with configurable intervals
│   ├── PrometheusUtils.cs               #   SetPrometheusStaticLabels() — hostname gauge
│   ├── RegionCodeUtils.cs               #   MVD→CBU region code lookups
│   ├── ServiceCollectionUtils.cs        #   AddVersioning(), AddApm(), AddEncryptionService(),
│   │                                    #   AddDataProtection(), ValidateServiceLifetimes(), AddControllers()
│   ├── StringUtils.cs                   #   Encrypt/Decrypt (AES-CBC), EncryptWithAesGcm/DecryptWithAesGcm,
│   │                                    #   EncryptSha256, EncryptDeterministic (AES-ECB+HMAC), ToEnum(),
│   │                                    #   ToCamelCase(), IsJson(), OrNullIfNullOrWhiteSpace()
│   ├── TypeUtils.cs                     #   GetAllPublicConstantValues(), GetAllPublicConstantFieldsAndValues()
│   └── YarpConfigValidationExtensions.cs #  ValidateYarpConfig(), ValidateYarpConfigsForDuplicateIds()
├── ApiProblemDetails.cs                 # Extended ProblemDetails with trace ID and validation errors
├── GuidProvider.cs                      # Testable GUID generation abstraction
├── Money.cs                             # Value object: Amount + CurrencyCode
├── NonProductionAttribute.cs            # Action filter: returns 404 in Production
├── RequestMetadata.cs                   # Per-request identity/tracing context
└── WidgetBase.cs                        # Mobile UI widget model hierarchy

Space.Service.Common.Misc.UnitTests/     # Unit test project
├── CultureInfosTests.cs
├── NonProductionAttributeTests.cs
├── TenantIdsTests.cs
├── DataProtection/
│   ├── CustomXmlDecryptorTests.cs
│   └── CustomXmlEncryptorTests.cs
├── Encryption/
│   ├── EncryptionServiceTests.cs
│   └── VersionedEncryptionServiceTests.cs
├── JsonConverters/
│   ├── ConditionalEnumConverterFactoryTests.cs
│   ├── CustomDecimalConvertersTests.cs
│   ├── DateTimeUtcConverterTests.cs
│   ├── EncryptedStringConverterTests.cs
│   ├── EnumConverterWithDefaultTests.cs
│   ├── NumberToDecimalJsonConverterTests.cs
│   └── Newtonsoft/
│       └── NumberToDecimalJsonConverterTests.cs
└── Utils/
    ├── CityCodesUtilsTests.cs
    ├── CommonUtilsTests.cs
    ├── CountryCodeUtilsTests.cs
    ├── DateTimeUtilsTests.cs
    ├── DecimalUtilsTests.cs
    ├── EnumUtilsTests.cs
    ├── ProcessingAwaiterTests.cs
    ├── RegionCodeUtilsTests.cs
    ├── StringUtilsTests.cs
    ├── TypeUtilsTests.cs
    ├── YarpConfigValidationExtensionsTests.cs
    └── TestEnum.cs
```

### Dependency Flow

```
Space.Service.Common.Misc.UnitTests ──references──▶ Space.Service.Common.Misc
```

This is a two-project solution. The library project has no internal layering — all folders are at the same level within a single assembly. Downstream microservices reference this package via NuGet.

### DDD Patterns

- **Value Object**: `Money` (amount + currency, operator overloads, currency match validation).
- **No Aggregates, Domain Events, or Repositories** — this is a utility library, not a domain service.

---

## 3. Tech Stack & Frameworks

### Runtime & Language

| Property | Value |
|---|---|
| Target Framework | `net9.0` |
| Language Version | `latestmajor` (C# 13+) |
| Implicit Usings | Enabled |

### NuGet Packages — Main Library

| Package | Version | Role |
|---|---|---|
| `Asp.Versioning.Mvc.ApiExplorer` | 8.1.0 | API versioning via URL segments |
| `Elastic.Apm.NetCoreAll` | 1.34.1 | Elastic APM agent for distributed tracing |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 9.0.9 | JWT Bearer token authentication |
| `Microsoft.AspNetCore.DataProtection.StackExchangeRedis` | 9.0.9 | Redis-backed DataProtection key storage |
| `Microsoft.AspNetCore.Mvc.NewtonsoftJson` | 9.0.9 | Newtonsoft.Json integration for MVC |
| `Microsoft.Extensions.Configuration` | 9.0.9 | Configuration abstractions |
| `Microsoft.Extensions.DependencyInjection` | 9.0.9 | DI container |
| `Microsoft.Extensions.Hosting` | 9.0.9 | Generic host support |
| `Microsoft.Extensions.Options.ConfigurationExtensions` | 9.0.9 | Options pattern binding |
| `Microsoft.Extensions.Options.DataAnnotations` | 9.0.9 | Options validation with data annotations |
| `Newtonsoft.Json` | 13.0.4 | Legacy JSON serialization (dual-stack) |
| `prometheus-net` | 8.2.1 | Prometheus metrics instrumentation |
| `Serilog` | 4.3.0 | Structured logging |
| `StyleCop.Analyzers` | 1.1.118 | Code style enforcement (analyzer only) |
| `Space.Service.Common.CodeAnalyzers` | 2.9.6 | Custom organization code analyzers (e.g., `Space_NewtonsoftAnalyzer`) |
| `System.Text.Json` | 9.0.9 | Primary JSON serialization |
| `Microsoft.SourceLink.GitHub` | 8.0.0 | Source link for debuggable NuGet packages |

### NuGet Packages — Test Project

| Package | Version | Role |
|---|---|---|
| `xunit` | 2.9.3 | Test framework |
| `xunit.runner.visualstudio` | 3.1.4 | VS/Rider test runner |
| `NSubstitute` | 5.3.0 | Mocking library |
| `Microsoft.NET.Test.Sdk` | 17.14.1 | Test SDK |
| `coverlet.msbuild` / `coverlet.collector` | 6.0.4 | Code coverage collection |
| `GitHubActionsTestLogger` | 2.4.1 | Test logging for CI |
| `XunitXml.TestLogger` | 6.1.0 | XML test result output |

### Database / Caching

- **Redis**: Used for ASP.NET Core DataProtection key persistence (via `StackExchange.Redis`). Connection is configured through `RedisOptions` with support for multiple hosts, SSL/TLS 1.2, and custom DB selection.
- **No primary database** — this is a library, not a service.

### Logging & Observability

- **Serilog** 4.3.0 — used in `ConfigurationUtils.Watch()` for settings file change logging.
- **Elastic APM** — full agent integration via `Elastic.Apm.NetCoreAll`; trace IDs flow into `ApiProblemDetails.TraceId`, APM transaction filtering (excludes OPTIONS requests and configured URL patterns), `kubernetes.host.name` labels, and sensitive query parameter masking in error messages.
- **Prometheus** (`prometheus-net` 8.2.1) — `PrometheusUtils.SetPrometheusStaticLabels()` creates an `api_host_info` gauge with hostname label.
- **System.Diagnostics.Activity** — `RequestMetadata` properties auto-propagate to `Activity.Current` tags for distributed tracing.

---

## 4. API Layer & Communication

> **Not directly applicable.** This is a shared library, not a deployed API service. However, it provides building blocks consumed by API services:

### Helper Extensions for API Setup

| Extension Method | Location | Purpose |
|---|---|---|
| `services.AddVersioning()` | [ServiceCollectionUtils.cs](Space.Service.Common.Misc/Utils/ServiceCollectionUtils.cs) | Configures URL-segment API versioning (e.g., `/api/v1/...`) |
| `services.AddControllers(respectNullableAnnotations)` | [ServiceCollectionUtils.cs](Space.Service.Common.Misc/Utils/ServiceCollectionUtils.cs) | Adds MVC controllers with optional nullable annotation enforcement via custom `CustomSystemTextJsonOutputFormatter` |
| `mvcBuilder.AddJson()` | [CommonUtils.cs](Space.Service.Common.Misc/Utils/CommonUtils.cs) | Configures both STJ and Newtonsoft.Json with camelCase, enum converters, UTC dates, custom decimal precision |
| `app.UseLocalization()` | [ApplicationBuilderUtils.cs](Space.Service.Common.Misc/Utils/ApplicationBuilderUtils.cs) | Sets up request localization with Uzbek Latin, English, Russian cultures |
| `app.UseVersionEndpoint()` | [ApplicationBuilderUtils.cs](Space.Service.Common.Misc/Utils/ApplicationBuilderUtils.cs) | Exposes `GET /__version` returning `GIT_COMMIT` from config |
| `app.UseEventEndpoints()` | [ApplicationBuilderUtils.cs](Space.Service.Common.Misc/Utils/ApplicationBuilderUtils.cs) | Scans assemblies for `ProduceEventAttribute`/`ConsumeEventAttribute` and registers discovery endpoints under `/events/` and `/commands/` |

### Request/Response Patterns

- **`ApiProblemDetails`** extends `ProblemDetails` (RFC 7807) with `TraceId`, `ValidationErrors` (dictionary of field→messages), `Severity` (LogLevel), and `ExternalEndpoint`.
- **`RequestMetadata`** acts as a scoped request context object carrying identity and tracing data.

### Authentication

- `Microsoft.AspNetCore.Authentication.JwtBearer` is a dependency, and `CommonUtils.CreateJwt()` / `ValidateJwt()` provide HMAC-SHA256 symmetric JWT generation/validation — services consuming this library wire up their own auth pipelines.

---

## 5. Middleware & Pipeline

> **Not directly applicable.** As a library, it does not define a middleware pipeline. It provides components that downstream services use in their pipelines:

| Component | Type | Purpose |
|---|---|---|
| `NonProductionAttribute` | `ActionFilterAttribute` | Returns `404 NotFound` when `IHostEnvironment.IsProduction()` is true — gates test/debug endpoints |
| `UseLocalization()` | Middleware extension | Configures `RequestLocalizationMiddleware` with cultures: `uz-Latn`, `en-US`, `ru-RU` |
| `UseVersionEndpoint()` | Endpoint extension | Registers a minimal API `GET /__version` endpoint |
| `UseEventEndpoints()` | Endpoint extension | Registers event/command discovery endpoints by scanning for attributes |

### Request Validation

- `EncryptionOptions` uses `[Required]` data annotations with `.ValidateDataAnnotations().ValidateOnStart()` for options validation.
- `RedisOptions` uses `[MinLength]` and `[Range]` data annotations.
- File upload validation in `CommonUtils.GetFiles()` validates file count, extension whitelist, and max file size.

---

## 6. Data Layer

> **Not applicable.** This library does not own any database. It does not contain a `DbContext`, entity configurations, migrations, or repositories.

The only data persistence mechanism is:

- **Redis** for ASP.NET Core DataProtection key ring storage, configured in `ServiceCollectionUtils.AddDataProtection()`. Keys are stored under `DataProtection-Keys-{assemblyName}` and encrypted/decrypted using `CustomXmlEncryptor`/`CustomXmlDecryptor` with AES symmetric encryption.

---

## 7. Messaging & Event Handling

> **Not directly applicable.** The library does not publish or consume messages itself. However, it provides infrastructure for messaging:

- **`UseEventEndpoints()`** in [ApplicationBuilderUtils.cs](Space.Service.Common.Misc/Utils/ApplicationBuilderUtils.cs) scans all loaded assemblies for types decorated with `ProduceEventAttribute` or `ConsumeEventAttribute` (discovered by name convention, not by direct type reference) and auto-registers HTTP discovery endpoints:
  - `GET /events/{topic}/{eventType}` — for produced events
  - `POST /commands/{eventType}` — for consumed commands
  - Wildcard fallback routes for ad-hoc discovery

This suggests downstream services use an event-driven architecture (likely with a message broker), and this library provides the OpenAPI discovery mechanism for those events.

---

## 8. Background Jobs & Scheduled Tasks

> **Not applicable.** The library does not contain any `IHostedService`, background workers, or scheduled job definitions.

The `ProcessingAwaiter<TException>` utility in [ProcessingAwaiter.cs](Space.Service.Common.Misc/Utils/ProcessingAwaiter.cs) provides a generic polling/retry mechanism that downstream services can use for awaiting asynchronous processing completion with configurable delay intervals.

---

## 9. Cross-Cutting Concerns

### Logging Strategy

- **Serilog** is a declared dependency. `ConfigurationUtils.Watch()` uses `Log.Logger.Information()` to log settings file reloads.
- **Elastic APM** provides transaction-level tracing with custom filtering.
- **YARP validation** uses `ILogger` with structured log messages at `Warning` and `Error` levels.
- `RequestMetadata` auto-tags `Activity.Current` with identity fields (`TenantId`, `UserId`, `CustomerId`, etc.) for correlation.

### Health Checks / Endpoints

- `GET /__version` endpoint returns the `GIT_COMMIT` configuration value — acts as a basic health/version probe.
- No explicit health check registrations (those would be in consuming services).

### Resilience Patterns

| Pattern | Implementation | Location |
|---|---|---|
| Retry with backoff | `ComputeHash()` retries file reads up to 3 times with exponential backoff (2^n seconds) | [CommonUtils.cs](Space.Service.Common.Misc/Utils/CommonUtils.cs) |
| Polling retry | `ProcessingAwaiter<TException>` retries at configurable intervals, throws custom exception on exhaustion | [ProcessingAwaiter.cs](Space.Service.Common.Misc/Utils/ProcessingAwaiter.cs) |
| Redis connection | `AbortOnConnectFail = false`, `ConnectTimeout = 1000`, `SyncTimeout = 1000` | [ServiceCollectionUtils.cs](Space.Service.Common.Misc/Utils/ServiceCollectionUtils.cs) |
| Encryption fallback | `VersionedEncryptionService.Decrypt()` tries version-tagged key first, then falls back through all versions in descending order | [VersionedEncryptionService.cs](Space.Service.Common.Misc/Encryption/VersionedEncryptionService.cs) |

### Configuration Management

- Standard `IConfiguration` with `Microsoft.Extensions.Configuration`.
- `EncryptionOptions` bound from `appsettings.json` section `"EncryptionOptions"` via `.BindConfiguration()`.
- `RedisOptions` bound from `"RedisOptions"` section.
- Tenant-specific timezone config keys: `TimeZoneId:{tenantId}` (e.g., `"TimeZoneId:tbc_uz" = "West Asia Standard Time"`).
- EOD config: `"EodStartTime"` (e.g., `"23:30"`).
- Elastic APM: `"ElasticApm:ServerUrl"`, `"ElasticApm:RequestUrlPatternsToExclude"`.
- `ConfigurationUtils.Watch()` monitors settings files for changes by computing SHA-256 hashes and logging when they change.
- `KUBERNETES_NODE_NAME` environment variable is read for APM labeling.

### Service Lifetime Validation

`ServiceCollectionUtils.ValidateServiceLifetimes()` inspects the DI container at startup and throws `InvalidOperationException` if a **Singleton** service injects a **Scoped** or **Transient** dependency — preventing the captive dependency anti-pattern.

---

## 10. Testing

### Test Project

| Property | Value |
|---|---|
| Project | `Space.Service.Common.Misc.UnitTests` |
| Type | Unit tests |
| Framework | xunit 2.9.3 |
| Mocking | NSubstitute 5.3.0 |
| Coverage | Coverlet (msbuild + collector) 6.0.4 |
| CI Loggers | `GitHubActionsTestLogger` 2.4.1, `XunitXml.TestLogger` 6.1.0 |

### Test Coverage by Component

| Component | Test File(s) | Key Areas Tested |
|---|---|---|
| Constants | `CultureInfosTests.cs`, `TenantIdsTests.cs` | Culture separators, supported cultures, default culture per tenant, all tenant IDs |
| NonProductionAttribute | `NonProductionAttributeTests.cs` | Returns 404 in production, passes through in non-production |
| DataProtection | `CustomXmlEncryptorTests.cs`, `CustomXmlDecryptorTests.cs` | Encrypt/decrypt round-trip, missing key errors, null input |
| Encryption | `EncryptionServiceTests.cs`, `VersionedEncryptionServiceTests.cs` | AES-CBC/GCM encrypt/decrypt, versioned key selection, fallback decryption, incorrect format handling |
| JSON Converters | `ConditionalEnumConverterFactoryTests.cs`, `CustomDecimalConvertersTests.cs`, `DateTimeUtcConverterTests.cs`, `EncryptedStringConverterTests.cs`, `EnumConverterWithDefaultTests.cs`, `NumberToDecimalJsonConverterTests.cs`, `Newtonsoft/NumberToDecimalJsonConverterTests.cs` | String↔int enum serialization, decimal precision, UTC enforcement, encrypted field round-trip, unknown enum defaults, float→decimal trimming |
| Utils | `CommonUtilsTests.cs` (~1290 lines), `StringUtilsTests.cs`, `DateTimeUtilsTests.cs`, `DecimalUtilsTests.cs`, `EnumUtilsTests.cs`, `TypeUtilsTests.cs`, `CityCodesUtilsTests.cs`, `RegionCodeUtilsTests.cs`, `CountryCodeUtilsTests.cs`, `ProcessingAwaiterTests.cs`, `YarpConfigValidationExtensionsTests.cs` | IP address extraction, environment checks, JWT create/validate, EOD logic, maintenance window detection, all string operations, timezone conversions, decimal formatting, enum member values, type reflection, YARP config validation |

### Testing Patterns

- **Arrange-Act-Assert** pattern used consistently.
- **Theory/InlineData** for parameterized tests.
- **MemberData** for complex test data generation (e.g., `DateTimeUtilsTests`).
- **NSubstitute** for `IConfiguration`, `IHttpContextAccessor`, `IHostEnvironment` mocking.
- **In-memory `IConfiguration`** via `ConfigurationBuilder().AddInMemoryCollection()` for config-dependent tests.
- **No integration tests**, **no `WebApplicationFactory`**, **no Testcontainers** — pure unit tests appropriate for a utility library.

---

## 11. DevOps & Deployment

### No Dockerfile

This is a **NuGet package library**, not a deployable service. There is no Dockerfile, Docker Compose, or container orchestration config.

### CI/CD Pipelines (GitHub Actions)

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| **ci-cd** | [`.github/workflows/ci-cd.yaml`](.github/workflows/ci-cd.yaml) | Push to `master`, manual dispatch | Builds, tests, and publishes the NuGet package. Delegates to shared workflow `SpaceBank/Space.Service.Workflows/.github/workflows/ci-cd-library.yaml@master`. Stryker mutation testing is **skipped** (`skip_stryker: true`). Supports manual version override. |
| **pull-request** | [`.github/workflows/pull-request.yaml`](.github/workflows/pull-request.yaml) | Pull request | Builds and runs tests on PRs. Delegates to `SpaceBank/Space.Service.Workflows/.github/workflows/pull-request-library.yaml@master`. |
| **update-readme** | [`.github/workflows/update-readme.yaml`](.github/workflows/update-readme.yaml) | Weekly schedule (Sun 20:00 UTC), manual dispatch | Detects source code changes since last successful run, generates a diff, and uses **Claude (Anthropic)** to auto-update README.md. Commits and pushes changes. |
| **update-libraries** | [`.github/workflows/update-libraries.yaml`](.github/workflows/update-libraries.yaml) | Manual dispatch | Automated dependency update workflow with optional batch tracking, dry-run mode, and chain execution for cascading updates across the library chain. |

### Code Ownership

[`.github/CODEOWNERS`](.github/CODEOWNERS) enforces review policies:

| Path Pattern | Owner |
|---|---|
| `*` (default) | `@SpaceBank/platform-team-software-architects` |
| `Enums/Card/*.cs` | `@SpaceBank/curiosity-cards-accounts` |
| `Enums/Loan/*.cs`, `Enums/Questionnaire/*.cs` | `@SpaceBank/hubble-cash-loan` |
| `Enums/BusinessBanking/*.cs` | `@SpaceBank/gravity-business-banking` |
| `Enums/Crm/*.cs` | `@GugaGlonti34` |
| `Enums/CreditCard/*.cs` | `@iraklisokhadze` |
| `Enums/Delivery/*.cs` | `@SpaceBank/starship-crm` |

### Local Development Tools

| Tool | File | Purpose |
|---|---|---|
| `localDevSetup.sh` | [tools/localDevSetup.sh](tools/localDevSetup.sh) | Pre-build hook (Debug only): installs Talisman secret scanner pre-commit hook, copies commit-msg hook |
| `commit-msg` hook | [tools/hooks/commit-msg](tools/hooks/commit-msg) | Enforces commit message format `<ABBR-123> \| message \| <author>`, runs `dotnet build` and `dotnet test` before allowing commit |
| Code coverage | [tools/codeCoverage/run-tests-with-coverage-local.sh](tools/codeCoverage/run-tests-with-coverage-local.sh) | Runs tests with OpenCover/Cobertura coverage, generates HTML report via `reportgenerator` |
| SonarQube scan | [tools/sonarqube/run-sonar-scan.sh](tools/sonarqube/run-sonar-scan.sh) | Local SonarQube analysis with `dotnet-sonarscanner` against `sonarqube.shared.int.spaceneobank.com` |
| Talisman | [tools/talisman/talisman-precommit.sh](tools/talisman/) | Secret scanning pre-commit hook |
| TruffleHog | [tools/trufflehog/trufflehog_exclude_patterns.txt](tools/trufflehog/) | Secret scanning exclusion patterns |

### Build Configuration

- **Deterministic builds** enabled in inner [Directory.Build.props](Space.Service.Common.Misc/Directory.Build.props).
- **SourceLink** via `Microsoft.SourceLink.GitHub` — enables source debugging of NuGet packages.
- **Continuous Integration Build** mode enabled when `GITHUB_ACTIONS == true`.
- PDB files embedded in NuGet output (`AllowedOutputExtensionsInPackageBuildOutputFolder` includes `.pdb`).

---

## 12. External Service Dependencies

> **Not directly applicable.** As a library, it does not make HTTP calls. However, it references external systems:

| External System | Evidence | Interaction Type |
|---|---|---|
| **Elastic APM Server** | `Elastic.Apm.NetCoreAll`, `Agent.AddFilter()`, config key `ElasticApm:ServerUrl` | APM agent reports to Elastic APM server |
| **Redis** | `StackExchange.Redis`, `RedisOptions`, `PersistKeysToStackExchangeRedis()` | DataProtection key storage |
| **IABS (Core Banking)** | `CoreBankingCustomerId`, `ThirdPartySystem.Iabs`, `IABS_PLANNED_MAINTENANCE` | Referenced in models/enums |
| **Mambu (Banking Platform)** | `BankingPlatformCustomerId`, `BankingPlatformCustomerKey` | Referenced in `RequestMetadata` |
| **Humo / Uzcard / UFC / Visa Global processing centers** | `ProcessingCenter` enum, `ThirdPartySystem` enum, `CardNetwork` enum | Referenced in maintenance and card models |
| **SonarQube** | `tools/sonarqube/run-sonar-scan.sh` → `sonarqube.shared.int.spaceneobank.com` | Code quality analysis (dev tooling) |
| **MinIO (object storage)** | `WidgetBase.IconUrl` comments reference `minio.tbcbank.uz` | Widget icon/background image URLs |

---

## 13. Key Technical Decisions & Patterns Summary

### Pattern Table

| Pattern | Where It's Used | Why |
|---|---|---|
| **Versioned Encryption** | `VersionedEncryptionService` | Supports key rotation without re-encrypting existing data. Encrypted values are prefixed with `enc.{version}.{payload}` for fast key lookup; unversioned payloads fall back through all keys. |
| **Dual JSON Serializer Support** | `CommonUtils.AddJson()`, `JsonConverters/` | Both `System.Text.Json` and `Newtonsoft.Json` converters exist because the ecosystem is transitioning from Newtonsoft to STJ (custom `Space_NewtonsoftAnalyzer` warns against Newtonsoft usage). |
| **Activity-based Tracing** | `RequestMetadata` property setters | Every identity field auto-propagates to `Activity.Current` tags, ensuring distributed tracing context is always consistent without explicit plumbing. |
| **Deterministic Encryption** | `StringUtils.EncryptDeterministic()` | AES-ECB + HMAC-SHA256 for use cases requiring searchable encrypted values (e.g., indexed database fields). |
| **Custom DataProtection Encryption** | `CustomXmlEncryptor`, `CustomXmlDecryptor` | Encrypts DataProtection XML key ring at rest using application-managed AES keys rather than DPAPI/X.509, suitable for containerized deployments. |
| **Conditional Enum Serialization** | `ConditionalEnumConverterFactory`, `[SerializeAsInt]` | Most enums serialize as strings (standard), but specific enums marked with `[SerializeAsInt]` serialize as integers — useful for integration with legacy systems. |
| **Multi-Tenant Timezone Handling** | `DateTimeUtils.ToTenantLocalTime()` | All DateTime operations normalized to UTC internally, converted to tenant-local time via `TimeZoneId:{tenantId}` configuration. |
| **Service Lifetime Validation** | `ValidateServiceLifetimes()` | Prevents captive dependency anti-pattern by scanning DI container at startup for Singleton→Scoped/Transient injection violations. |
| **YARP Config Validation** | `YarpConfigValidationExtensions` | Comprehensive startup validation of YARP reverse-proxy configs: duplicate route/cluster IDs, dangling cluster references, path/method overlaps, misplaced destinations. |
| **GuidProvider Abstraction** | `GuidProvider.Default` / override | Allows unit tests to inject deterministic GUIDs. |
| **Code Ownership by Domain** | `.github/CODEOWNERS` | Enum files gated by respective domain teams — prevents accidental breaking changes to shared contracts. |
| **Commit-time Quality Gate** | `tools/hooks/commit-msg` | Enforces message format, builds, and runs all tests before allowing commits — shift-left quality. |
| **AI-assisted Documentation** | `.github/workflows/update-readme.yaml` | Claude (Anthropic) auto-updates README when source changes, keeping documentation synchronized with code. |

### Notable Deviations

1. **ECB Mode in Deterministic Encryption**: `StringUtils.Encrypt()` (the deterministic variant) uses AES-ECB mode, which is inherently less secure than CBC/GCM. This is an intentional trade-off for searchability — HMAC verification provides integrity assurance.

2. **`CompareArrays()` Bug**: In [StringUtils.cs](Space.Service.Common.Misc/Utils/StringUtils.cs), the `CompareArrays()` helper always returns `false` (last line `return false;` instead of `return true;`). This means HMAC verification in `DecryptDeterministic()` / `DecryptLowercaseDeterministic()` will **always throw** `CryptographicException("Invalid HMAC.")`, making deterministic decryption non-functional.

3. **`Thread.Sleep()` in `ComputeHash()`**: The retry logic in `CommonUtils.ComputeHash()` uses blocking `Thread.Sleep()` rather than `Task.Delay()` — acceptable since it's called during configuration watching, not in request paths.

4. **Deprecated `CreateJwt()` Overload**: An `[Obsolete]` overload of `CreateJwt()` uses `DateTime.UtcNow` directly; the replacement takes a `TimeProvider` parameter for testability.

### Technical Debt & Improvement Opportunities

| Issue | Severity | Details |
|---|---|---|
| **`CompareArrays()` bug** | 🔴 Critical | Method always returns `false` — deterministic decryption HMAC validation is broken. Line: `return false;` should be `return true;` after the loop. |
| **ECB mode usage** | 🟡 Medium | AES-ECB in `EncryptDeterministic()` leaks patterns in equal plaintext blocks. Consider AES-SIV or HMAC-based lookup with CBC encryption. |
| **Obsolete JWT method** | 🟢 Low | The `[Obsolete]` `CreateJwt()` overload without `TimeProvider` should be removed once all consumers migrate. |
| **Newtonsoft dependency** | 🟢 Low | Active migration to STJ (custom analyzer warns against Newtonsoft usage), but `EnumConverterWithDefault<T>` and `NumberToDecimalJsonConverter` still exist in Newtonsoft flavor. |
| **Missing nullable annotations** | 🟢 Low | While `RespectNullableAnnotations` is configured in the output formatter, the library itself doesn't use `#nullable enable` globally. |
| **Hardcoded tenant list** | 🟡 Medium | `TenantIds`, `CultureInfos.GetDefaultCulture()`, `RequestMetadata.CountryCode` all hardcode 3 tenants — adding a new tenant requires code changes to this library, creating a deployment dependency. |
| **Large `CommonUtils.cs`** | 🟢 Low | At 300+ lines, this file mixes JSON config, JWT, EOD, maintenance, IP extraction, file handling — could benefit from splitting into focused utility classes. |
