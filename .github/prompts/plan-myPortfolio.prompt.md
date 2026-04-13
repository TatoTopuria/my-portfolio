# Plan: Portfolio Website — Full Implementation

Build a single-page scrolling portfolio for a Software Engineer & Test Automation Engineer using Angular 21, Tailwind CSS v4, and TypeScript strict mode. Hybrid layout: all 10 sections on a scrollable homepage with `@defer` lazy loading, plus dedicated detail routes (e.g., `/projects/:slug`) lazy-loaded via `loadComponent()`. Deploy to Vercel with SSR/prerendering, PWA support, full CI/CD, accessibility (WCAG 2.1 AA), and rich animations. Data from local TS constants + public GitHub REST API (`tatotopuria`).

## Confirmed Decisions

| Decision | Choice |
|---|---|
| Angular | 21.2.0 (keep existing) |
| Tailwind | v4.1 CSS-based config with `@theme` |
| Unit tests | Vitest (keep existing) + Angular TestBed |
| E2E | Playwright |
| Builder | Angular CLI esbuild (keep existing) |
| Deploy | Vercel |
| Fonts | Inter (body) + JetBrains Mono (code) |
| Palette | Indigo primary + Teal accent |
| Layout | Hybrid — scrollable home + detail routes |
| Content | Placeholder data with typed models |
| Animations | Rich (parallax, stagger, 3D, typewriter, particles) |

---

## Phase 1 — Project Scaffold & Tooling

### 1.1 Add Missing Dependencies

Angular additions (via `ng add`, which also configures files):
- `ng add @angular/ssr` — SSR with Express, prerender config
- `ng add @angular/localize` — i18n polyfill
- `@angular/service-worker` — manual PWA setup for full control

NPM installs:
- `npm install @emailjs/browser`
- `npm install -D @angular-eslint/schematics` → then `ng add @angular-eslint/schematics`
- `npm install -D eslint-config-prettier eslint-plugin-prettier`
- `npm install -D @playwright/test` → then `npx playwright install`
- `npm install -D husky lint-staged`
- `npm install -D source-map-explorer`

### 1.2 ESLint

After `ng add @angular-eslint/schematics`, extend generated `eslint.config.js`: integrate `eslint-config-prettier`, enable `@angular-eslint/prefer-on-push-component-change-detection`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/explicit-function-return-type`

### 1.3 Prettier

Update existing `.prettierrc` with `tabWidth: 2`, `semi: true`, `trailingComma: "all"`, `arrowParens: "always"`

### 1.4 Husky + lint-staged

`npx husky init`, configure `.husky/pre-commit` → `npx lint-staged`. Add `lint-staged` config in `package.json`: run `eslint --fix` + `prettier --write` on staged `.ts`, `.html`, `.css` files

### 1.5 TypeScript

Add `noUncheckedIndexedAccess: true` and `noImplicitOverride: true` to `tsconfig.json`

### 1.6 Scripts

Add to `package.json`: `lint`, `lint:fix`, `format`, `format:check`, `test:e2e`, `test:unit`, `build:prod`, `analyze`

---

## Phase 2 — Folder Structure

```
src/app/
├── core/
│   ├── services/
│   │   ├── theme.service.ts            ← signal-based dark/light, localStorage sync
│   │   ├── github-api.service.ts       ← typed HttpClient wrapper, retry, error handling
│   │   ├── seo.service.ts             ← Meta + Title service wrapper
│   │   ├── scroll.service.ts          ← active section tracking, smooth scroll
│   │   └── emailjs.service.ts         ← EmailJS send wrapper
│   ├── directives/
│   │   ├── animate-on-scroll.directive.ts  ← IntersectionObserver-based
│   │   └── parallax.directive.ts           ← scroll-speed parallax
│   ├── interceptors/
│   │   └── http-error.interceptor.ts
│   ├── tokens/
│   │   └── environment.token.ts            ← InjectionToken<Environment>
│   └── models/
│       ├── project.model.ts
│       ├── experience.model.ts
│       ├── skill.model.ts
│       ├── certification.model.ts
│       ├── article.model.ts
│       ├── social-link.model.ts
│       └── github.model.ts
├── data/
│   ├── projects.data.ts       ← typed const arrays with `as const satisfies`
│   ├── experience.data.ts
│   ├── skills.data.ts
│   ├── certifications.data.ts
│   ├── articles.data.ts
│   └── social-links.data.ts
├── shared/
│   ├── components/
│   │   ├── section-header/     (title + subtitle, reused every section)
│   │   ├── tech-badge/         (pill tag for tech names)
│   │   ├── loading-skeleton/   (pulse placeholder for @defer)
│   │   ├── particle-background/(canvas particles for hero)
│   │   └── code-snippet/       (syntax-highlighted code block)
│   ├── pipes/
│   │   ├── truncate.pipe.ts
│   │   └── relative-time.pipe.ts
│   └── animations/
│       ├── route-animations.ts
│       ├── fade.animations.ts
│       ├── stagger.animations.ts
│       └── slide.animations.ts
├── layout/
│   ├── header/     ← sticky nav, theme toggle, mobile hamburger
│   ├── footer/     ← social links, copyright, back-to-top
│   └── skip-link/  ← sr-only focus:visible skip-to-content
├── features/
│   ├── home/                  ← scroll container, @defer all sections below fold
│   ├── hero/                  ← name, animated tagline, CTA, particles
│   │   └── typewriter.directive.ts
│   ├── about/                 ← bio, photo, testing philosophy
│   ├── skills/                ← category tabs + skill cards grid
│   │   └── skill-card.ts
│   ├── projects/              ← filterable grid + detail route
│   │   ├── project-card.ts
│   │   ├── project-filter.ts
│   │   └── project-detail.ts  ← routed: /projects/:slug
│   ├── experience/            ← animated vertical timeline
│   │   └── timeline-item.ts
│   ├── test-automation/       ← framework diagram, code carousel, metrics
│   │   ├── framework-diagram.ts
│   │   ├── code-carousel.ts
│   │   └── metrics-display.ts
│   ├── github-activity/       ← live contribution graph + repos
│   │   └── contribution-graph.ts
│   ├── certifications/        ← cert card grid
│   │   └── cert-card.ts
│   ├── blog/                  ← external article link cards
│   │   └── article-card.ts
│   └── contact/               ← EmailJS form + social links
│       └── contact-form.ts
├── pages/
│   └── not-found/             ← 404 page
└── environments/
    ├── environment.ts
    └── environment.prod.ts
```

**Naming**: kebab-case files, PascalCase classes, `app-` selector prefix, signals in camelCase

---

## Phase 3 — Core Architecture Patterns

### 3.1 Signals Strategy

| Signal | Location | Purpose |
|---|---|---|
| `isDarkMode` | `ThemeService` | Dark/light state, synced to `localStorage` + `<html>` class via `effect()` |
| `themeIcon` | `ThemeService` | `computed()` → `'sun'` or `'moon'` |
| `activeSection` | `ScrollService` | Tracked via IntersectionObserver on `<section>` elements; header highlights active nav |
| `activeFilter` | `ProjectsComponent` | Current tech filter; resets to `'all'` |
| `filteredProjects` | `ProjectsComponent` | `computed()` from projects data + `activeFilter()` + `searchQuery()` |
| `searchQuery` | `ProjectsComponent` | Text search input |
| `activeCategory` | `SkillsComponent` | Currently selected skill category tab |
| `activeSlide` | `CodeCarouselComponent` | Current code snippet index, auto-advances |
| `formState` | `ContactComponent` | `'idle' \| 'sending' \| 'success' \| 'error'` |
| `repos`, `contributions`, `loading` | `GithubActivityComponent` | API data via `toSignal()` from observables |

### 3.2 Environment InjectionToken

`ENVIRONMENT` token in `core/tokens/environment.token.ts` typed with `Environment` interface (`githubApiUrl`, `githubUsername`, `emailjsServiceId`, `emailjsTemplateId`, `emailjsPublicKey`). Provided in `app.config.ts`.

### 3.3 AnimateOnScroll Directive

Standalone, selector `[appAnimateOnScroll]`. Inputs: `animationClass` (default `'animate-fade-in-up'`), `threshold` (default `0.1`), `delay` (ms for stagger), `once` (default `true`). Creates IntersectionObserver on host element, adds class + `animationDelay` on entry. Cleans up via `DestroyRef`.

### 3.4 Parallax Directive

Standalone, selector `[appParallax]`. Input: `speed` (default `0.5`). Listens to scroll with `requestAnimationFrame` throttle, translates host Y by `scrollY * speed`.

### 3.5 GitHub API Service

Injects `HttpClient` + `ENVIRONMENT`. Methods:
- `fetchRepos()` → GET `/users/{username}/repos?sort=updated&per_page=30`
- `fetchUserProfile()` → GET `/users/{username}`
- `fetchRecentEvents()` → GET `/users/{username}/events/public?per_page=100`
- `fetchContributions()` → GET from `https://github-contributions-api.jogruber.de/v4/{username}` (third-party, no auth needed)
- All methods: `pipe(retry({ count: 2, delay: 1000 }), catchError(handleError))` returning typed observables
- Components consume via `toSignal()` or Angular 21's `httpResource()` if available

### 3.6 Route Configuration

`app.routes.ts`:
- `/` → `loadComponent(() => import('./features/home/home.ts'))`
- `/projects/:slug` → `loadComponent(() => import('./features/projects/project-detail.ts'))`
- `**` → `loadComponent(() => import('./pages/not-found/not-found.ts'))`

`app.config.ts` providers:
- `provideRouter(routes, withPreloading(PreloadAllModules), withViewTransitions(), withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }))`
- `provideHttpClient(withInterceptors([httpErrorInterceptor]), withFetch())`
- `provideAnimationsAsync()`
- `provideClientHydration(withEventReplay())`
- `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`

### 3.7 Home Page @defer Strategy

Hero rendered immediately (above fold). All other sections wrapped in `@defer (on viewport) { ... } @placeholder { <app-loading-skeleton /> }`. Each deferred block becomes a separate JS chunk.

---

## Phase 4 — Component Plan

| # | Component | Selector | Key Inputs/Outputs | Signals | Tailwind Strategy | Notes |
|---|---|---|---|---|---|---|
| L1 | `HeaderComponent` | `app-header` | — | `activeSection()`, `isDarkMode()` | `sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80` | Responsive hamburger, smooth-scroll nav, theme toggle |
| L2 | `FooterComponent` | `app-footer` | — | — | `bg-slate-900 text-slate-300` | Social links, copyright, back-to-top |
| L3 | `SkipLinkComponent` | `app-skip-link` | — | — | `sr-only focus:not-sr-only` | First DOM element |
| 1 | `HeroComponent` | `app-hero` | — | `typedText` | `min-h-screen flex items-center perspective-1000` | TypewriterDirective, ParticleBackground, 2 CTA buttons |
| 2 | `AboutComponent` | `app-about` | — | — | `grid md:grid-cols-2 gap-12` | `NgOptimizedImage` for photo, testing philosophy subsection |
| 3 | `SkillsComponent` | `app-skills` | — | `activeCategory` | `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4` | Category tabs (Frontend/Backend/Testing/DevOps/Tools), stagger |
| 3a | `SkillCardComponent` | `app-skill-card` | `skill: input<Skill>()` | — | `group hover:scale-105 transition-transform` | Icon + name + proficiency bar |
| 4 | `ProjectsComponent` | `app-projects` | — | `activeFilter`, `filteredProjects`, `searchQuery` | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | Featured flag → `ring-2 ring-primary-500` |
| 4a | `ProjectCardComponent` | `app-project-card` | `project: input<Project>()` | — | `group hover:-translate-y-2 transition-all` | Image, badges, GitHub + demo links |
| 4b | `ProjectFilterComponent` | `app-project-filter` | `filters: input()`, `activeFilter: model()` | — | Active chip: `bg-primary-500 text-white` | ARIA `role="tablist"` |
| 4c | `ProjectDetailComponent` | `app-project-detail` | route `:slug` | project from data lookup | Full-width prose | Lazy-loaded route |
| 5 | `ExperienceComponent` | `app-experience` | — | — | `relative` timeline line | Alternating left/right desktop, single-column mobile |
| 5a | `TimelineItemComponent` | `app-timeline-item` | `item: input()`, `index: input()` | — | `even:flex-row-reverse`, stagger delay | Animate-on-scroll |
| 6 | `TestAutomationComponent` | `app-test-automation` | — | `activeSlide` | `bg-gradient-to-br from-slate-900 to-slate-800` | Three sub-components below |
| 6a | `FrameworkDiagramComponent` | `app-framework-diagram` | — | — | CSS grid + connection lines | SVG/CSS test architecture diagram |
| 6b | `CodeCarouselComponent` | `app-code-carousel` | `snippets: input()` | `activeIndex`, auto-advance | `overflow-hidden` + translateX slides | `aria-roledescription="carousel"` |
| 6c | `MetricsDisplayComponent` | `app-metrics-display` | `metrics: input()` | — | `grid grid-cols-2 md:grid-cols-4` | Animated count-up numbers |
| 7 | `GithubActivityComponent` | `app-github-activity` | — | `repos`, `contributions`, `loading` | `grid gap-6` | Fetches via `GithubApiService`, `toSignal()` |
| 7a | `ContributionGraphComponent` | `app-contribution-graph` | `data: input()` | — | CSS grid of colored squares | Heatmap from contribution API |
| 8 | `CertificationsComponent` | `app-certifications` | — | — | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | Cert card grid |
| 8a | `CertCardComponent` | `app-cert-card` | `cert: input()` | — | `border rounded-xl p-6` | Issuer logo, name, date, verify link |
| 9 | `BlogComponent` | `app-blog` | — | — | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | External link cards |
| 9a | `ArticleCardComponent` | `app-article-card` | `article: input()` | — | `group hover:shadow-xl transition-shadow` | Platform icon, title, link |
| 10 | `ContactComponent` | `app-contact` | — | `formState` | `grid md:grid-cols-2` | EmailJS + social sidebar |
| 10a | `ContactFormComponent` | `app-contact-form` | `formState: model()` | `name`, `email`, `message` | Reactive Forms validation | ARIA live region for status |
| S1 | `SectionHeaderComponent` | `app-section-header` | `title: input()`, `subtitle: input()` | — | `text-center mb-16` | Reused every section |
| S2 | `TechBadgeComponent` | `app-tech-badge` | `name: input()`, `color: input()` | — | `inline-flex rounded-full text-xs` | Pill tag |
| S3 | `LoadingSkeletonComponent` | `app-loading-skeleton` | `variant: input<'card'\|'text'\|'graph'>()` | — | `animate-pulse bg-slate-200` | @defer placeholder |
| S4 | `CodeSnippetComponent` | `app-code-snippet` | `code: input()`, `language: input()` | — | `bg-slate-900 font-mono text-sm` | Highlighted code block |
| S5 | `ParticleBackgroundComponent` | `app-particle-background` | — | — | `absolute inset-0 -z-10` | Canvas-based particles |

---

## Phase 5 — Tailwind Design System

### 5.1 Color Palette

Defined in `src/styles.css` `@theme` block:

| Token | Scale | Usage |
|---|---|---|
| `--color-primary-*` | Indigo (50: #eef2ff → 500: #6366f1 → 950: #1e1b4b) | Primary actions, links, active states |
| `--color-accent-*` | Teal (50: #f0fdfa → 500: #14b8a6 → 950: #042f2e) | Secondary highlights, badges, decorative |
| Neutral | Built-in `slate` | Text, backgrounds, borders |
| `--color-success` | #10b981 | Success states |
| `--color-warning` | #f59e0b | Warning states |
| `--color-error` | #ef4444 | Error states, form validation |

### 5.2 Typography

`--font-sans: 'Inter'`, `--font-mono: 'JetBrains Mono'`

| Element | Classes |
|---|---|
| Hero title | `text-5xl md:text-7xl font-bold tracking-tight` |
| Section title | `text-3xl md:text-4xl font-bold` |
| Section subtitle | `text-lg md:text-xl text-slate-600 dark:text-slate-400` |
| Body | `text-base leading-relaxed` |
| Card title | `text-xl font-semibold` |
| Caption/badge | `text-xs font-medium uppercase tracking-wide` |

### 5.3 Dark Mode

`@custom-variant dark (&:where(.dark, .dark *));` in `src/styles.css`. `ThemeService` toggles `dark` class on `<html>`. Base layer sets `body { @apply bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300; }`

### 5.4 Custom Animations

Defined in `@theme` (keyframes) and `@utility` (classes):
- `animate-fade-in-up` / `animate-fade-in-down` — scroll reveal
- `animate-slide-in-left` / `animate-slide-in-right` — timeline items
- `animate-scale-in` — card entrance
- `animate-typewriter` — hero tagline typing effect
- `animate-float` — subtle up/down for decorative elements
- `animate-glow` — pulsing accent glow
- `animate-stagger-1` through `animate-stagger-8` — incremental delay utilities
- `perspective-1000`, `backface-hidden` — 3D card effects

### 5.5 Breakpoints

Mobile-first: single-column < 640px → `md:` 2-column grids, timeline alternates → `lg:` 3-column project grid → `xl:` `max-w-7xl mx-auto` container

---

## Phase 6 — Performance Strategy

### 6.1 Images

`NgOptimizedImage` for all images. AVIF primary + WebP fallback. Explicit `width`/`height` on every `<img>`. Hero/profile photo gets `priority` attribute. All others lazy-loaded.

### 6.2 Fonts

Preconnect hints in `index.html` for Google Fonts. Load Inter (400,500,600,700) + JetBrains Mono (400,700) with `display=swap`. Alternative: self-host in `src/assets/fonts/`.

### 6.3 Code Splitting

`@defer (on viewport)` for below-fold sections (each becomes a chunk). `loadComponent()` for detail routes. `ParticleBackgroundComponent` deferred since it's heavy (canvas).

### 6.4 Bundle Analysis

`source-map-explorer` via `npm run analyze`. Target: initial bundle < 200kB gzipped.

### 6.5 Prerendering

Configure via `angular.json` under `prerender` options: routes `/` and `/projects/:slug` for each project. Static HTML for instant FCP. GitHub API sections hydrate client-side.

### 6.6 PWA

`ngsw-config.json`: app shell prefetched, assets lazy-loaded, GitHub API responses cached with `performance` strategy (maxAge 1h).

---

## Phase 7 — Testing Strategy

### 7.1 Unit Tests (Vitest)

| Target | Assertions |
|---|---|
| `ThemeService` | Toggle persists to localStorage, signal updates, DOM class toggle |
| `GithubApiService` | Correct URLs, retry on failure, error handling (HttpTestingController) |
| `SeoService` | Title/meta tag updates |
| `ScrollService` | Active section signal updates |
| `EmailjsService` | Sends with correct params, handles errors |
| `HeaderComponent` | Nav links render, active highlight, theme toggle, mobile menu |
| `ProjectsComponent` | Filter changes update grid, search works |
| `ContactFormComponent` | Validation (required/email), disabled submit when invalid, success/error states |
| `SkillsComponent` | Category tabs switch, correct skills per category |
| All shared components | Render with various inputs, accessibility attributes present |

### 7.2 E2E Tests (Playwright)

| Flow | File |
|---|---|
| Navigation & scroll | `e2e/navigation.spec.ts` |
| Dark mode toggle + persistence | `e2e/dark-mode.spec.ts` |
| Project filter + search | `e2e/projects-filter.spec.ts` |
| Contact form validation + submit | `e2e/contact-form.spec.ts` |
| Mobile hamburger menu | `e2e/mobile-nav.spec.ts` |
| Keyboard-only + skip link | `e2e/accessibility.spec.ts` |
| GitHub activity loads | `e2e/github-activity.spec.ts` |

Playwright config: `http://localhost:4200`, projects for Chromium/Firefox/WebKit/mobile, screenshot on failure.

---

## Phase 8 — CI/CD Pipeline

### 8.1 GitHub Actions

`.github/workflows/ci.yml`

| Job | Depends On | Action |
|---|---|---|
| **lint** | — | `npm run lint` + `npm run format:check` |
| **unit-test** | *parallel with lint* | `npm run test:unit -- --coverage`, upload report |
| **build** | lint + unit-test | `npm run build:prod`, upload dist artifact |
| **e2e** | build | Install Playwright, serve built app, run tests, upload screenshots |
| **deploy** | e2e *(main only)* | `vercel deploy --prod --prebuilt` |

Cache: `node_modules` (keyed on `package-lock.json`), `.angular/cache`, Playwright browsers.

### 8.2 Vercel

`vercel.json` with security headers (`X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `CSP`, `Permissions-Policy`), SPA rewrites, immutable caching for hashed assets.

### 8.3 Environment Variables

Vercel secrets: `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`. GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. No `GITHUB_TOKEN` needed (public API, 60 req/hr sufficient).

---

## Phase 9 — Accessibility Checklist

- **Skip-to-content** link as first focusable element
- **Semantic HTML**: `<header>`, `<nav>`, `<main>`, `<section aria-labelledby>`, `<article>`, `<footer>`
- **Focus ring**: `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2` globally
- **Color contrast**: ≥ 4.5:1 in both themes
- **Nav**: `<nav aria-label="Main navigation">`, mobile hamburger with `aria-expanded`, `aria-controls`
- **Theme toggle**: `aria-label="Toggle dark mode"`, `aria-pressed` bound to signal
- **Skill/project tabs**: `role="tablist"` + `role="tab"` + `aria-selected` + `role="tabpanel"` + `aria-labelledby`
- **Timeline**: `<ol>` with `<li>` + `<time datetime="">`, section `aria-label`
- **Code carousel**: `aria-roledescription="carousel"`, prev/next with `aria-label`, `aria-live="polite"` region
- **Contact form**: `<label>` with `for`/`id`, `aria-describedby` for errors, `aria-live="polite"` for status, `aria-disabled` on submit
- **Contribution graph**: `role="img"` + `aria-label` + text fallback
- **Keyboard**: Tab through all, arrow keys for tablists, Escape closes mobile menu, focus trap in mobile nav
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables parallax, reduces transitions

---

## Phase 10 — Launch Checklist

- **robots.txt** + **sitemap.xml** generated at build time
- **Meta tags**: `SeoService` sets per-route `<title>`, `<meta description>`, OG and Twitter Card tags
- **Structured data**: JSON-LD `Person` schema in `index.html`
- **Analytics**: Plausible (privacy-first, no cookies, no consent banner needed)
- **Domain**: custom domain in Vercel, HTTPS automatic, HSTS enabled
- **CSP**: allows `'self'`, Google Fonts, `api.github.com`, contribution API, EmailJS, Plausible
- **PWA**: Lighthouse PWA audit passes, `manifest.webmanifest` with icons, installable

---

## Implementation Order & Dependencies

```
Phase 1  (Scaffold & tooling)  ─────────────────────────┐
Phase 2  (Folders + models + data)                       │ sequential
Phase 3  (Core services, directives, config) ────────────┘
    │
    ├─ Phase 4a  (Layout: header, footer, skip-link)
    ├─ Phase 4b  (Shared components)     ── parallel ──┐
    │                                                    │
    ├─ Phase 4c  (Hero, About, Skills)       depends on 4a+4b
    ├─ Phase 4d  (Projects, Experience)
    ├─ Phase 4e  (Test Automation, GitHub, Certs)
    ├─ Phase 4f  (Blog, Contact)
    │
Phase 5  (SSR + PWA)            ── depends on Phase 4
Phase 6  (Performance tuning)   ── depends on Phase 5
    │
    ├─ Phase 7a  (Unit tests)    ── parallel ──┐
    ├─ Phase 7b  (E2E tests)                    │
    │
Phase 8  (CI/CD pipeline)       ── depends on Phase 7
Phase 9  (Accessibility audit)  ── parallel with Phase 8
Phase 10 (Launch prep)          ── depends on all above
```

**~30+ standalone components, ~6 services, ~3 directives, ~2 pipes, ~7 e2e test files**

---

## Verification

1. After Phase 1: `ng lint`, `format:check`, `test:unit` all pass zero errors
2. After Phase 3: ThemeService toggles dark mode, GitHub API returns data in dev
3. After Phase 4: All sections render on homepage, `@defer` loads on scroll, `/projects/:slug` works
4. After Phase 5: `@theme` tokens apply in both themes, animations fire, responsive all breakpoints
5. After Phase 6: Lighthouse ≥ 90 across Performance, Accessibility, Best Practices, SEO
6. After Phase 7: ≥ 85% unit coverage, all e2e tests green on 3 browsers
7. After Phase 8: Push to main → full CI → auto-deploy to Vercel
8. After Phase 9: Axe DevTools = 0 critical violations, keyboard-only nav works end-to-end
9. After Phase 10: robots.txt + sitemap accessible, OG tags render in social previews, Plausible live
