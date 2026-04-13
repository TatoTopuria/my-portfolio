import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { CodeSnippetComponent } from '../../shared/components/code-snippet/code-snippet';
import { AnimateOnScrollDirective } from '../../core/directives/animate-on-scroll.directive';

@Component({
  selector: 'app-test-automation',
  standalone: true,
  imports: [SectionHeaderComponent, CodeSnippetComponent, AnimateOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="test-automation"
      class="section-padding bg-gradient-to-br from-slate-900 to-slate-800"
      aria-labelledby="test-automation-heading"
    >
      <div class="section-container">
        <app-section-header
          title="Test Automation"
          subtitle="My approach to robust, scalable quality engineering"
        />

        <!-- Metrics -->
        <div
          appAnimateOnScroll
          animationClass="animate-fade-in-up"
          class="mb-16 grid grid-cols-2 gap-6 md:grid-cols-4"
          role="region"
          aria-label="Automation metrics"
        >
          @for (metric of metrics; track metric.label) {
            <div class="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 text-center">
              <p class="text-3xl font-bold text-primary-400">{{ metric.value }}</p>
              <p class="mt-1 text-sm text-slate-400">{{ metric.label }}</p>
            </div>
          }
        </div>

        <!-- Framework + Code -->
        <div class="grid gap-12 md:grid-cols-2">
          <!-- Framework overview -->
          <div appAnimateOnScroll animationClass="animate-slide-in-left" class="space-y-4">
            <h3 class="text-xl font-semibold text-white">Framework Highlights</h3>
            @for (feature of frameworkFeatures; track feature.title) {
              <div class="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <p class="font-medium text-accent-400">{{ feature.title }}</p>
                <p class="mt-1 text-sm text-slate-400">{{ feature.description }}</p>
              </div>
            }
          </div>

          <!-- Code sample -->
          <div appAnimateOnScroll animationClass="animate-slide-in-right" [delay]="200">
            <h3 class="mb-4 text-xl font-semibold text-white">Sample: E2E Test</h3>
            <app-code-snippet [code]="codeExample" language="typescript" />
          </div>
        </div>
      </div>
    </section>
  `,
})
export class TestAutomationComponent {
  readonly metrics = [
    { value: '10k+', label: 'Test Cases Written' },
    { value: '95%', label: 'Pass Rate (CI)' },
    { value: '70%', label: 'Regression Time Saved' },
    { value: '3', label: 'Browsers in Parallel' },
  ];

  readonly frameworkFeatures = [
    {
      title: 'Page Object Model',
      description:
        'Encapsulated page interactions with TypeScript classes for maximum reusability.',
    },
    {
      title: 'Parallel Execution',
      description: 'Tests run across Chromium, Firefox, and WebKit simultaneously in CI.',
    },
    {
      title: 'Allure Reporting',
      description: 'Rich visual reports with step screenshots, videos, and tracing.',
    },
    {
      title: 'API Mocking',
      description: 'Route interception for deterministic testing of UI + API contracts.',
    },
  ];

  readonly codeExample = `import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('should login with valid credentials', async () => {
    await loginPage.fillCredentials('user@test.com', 'password123');
    await loginPage.submit();

    await expect(loginPage.page).toHaveURL('/dashboard');
    await expect(loginPage.welcomeMessage).toBeVisible();
  });

  test('should show error on invalid credentials', async () => {
    await loginPage.fillCredentials('bad@email.com', 'wrong');
    await loginPage.submit();

    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
  });
});`;
}
