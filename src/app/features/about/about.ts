import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { AnimateOnScrollDirective } from '../../core/directives/animate-on-scroll.directive';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [SectionHeaderComponent, AnimateOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="about"
      class="section-padding bg-slate-50 dark:bg-slate-900/50"
      aria-labelledby="about-heading"
    >
      <div class="section-container">
        <app-section-header
          title="About Me"
          subtitle="Software Engineer and SDET focused on delivery speed, quality, and scale"
        />

        <div class="grid gap-12 md:grid-cols-2">
          <!-- Photo + details -->
          <div appAnimateOnScroll animationClass="animate-slide-in-left" class="space-y-6">
            <div class="relative mx-auto w-fit">
              <div
                class="h-64 w-64 overflow-hidden rounded-2xl border-4 border-primary-200 bg-gradient-to-br from-primary-100 to-accent-100 dark:border-primary-800 dark:from-primary-900/40 dark:to-accent-900/40"
              >
                <img
                  src="/images/tato-topuria.jpeg"
                  alt="Tato Topuria"
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <!-- Floating badge -->
              <div
                class="absolute -bottom-3 -right-3 rounded-xl bg-primary-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg"
              >
                🚀 Available for hire
              </div>
            </div>

            <!-- Quick facts -->
            <div class="grid grid-cols-2 gap-4">
              @for (fact of quickFacts; track fact.label) {
                <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {{ fact.label }}
                  </p>
                  <p class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {{ fact.value }}
                  </p>
                </div>
              }
            </div>
          </div>

          <!-- Bio -->
          <div
            appAnimateOnScroll
            animationClass="animate-slide-in-right"
            [delay]="200"
            class="space-y-6"
          >
            <div class="prose prose-slate max-w-none dark:prose-invert">
              <p class="text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                I'm a Software Engineer with over
                <span class="font-semibold text-primary-600 dark:text-primary-400"
                  >5 years of experience</span
                >
                building scalable products and robust quality pipelines across backend, frontend,
                and automation engineering.
              </p>
              <p class="text-slate-600 dark:text-slate-400">
                My stack includes .NET/C#, Spring/Java, Node.js, JavaScript/TypeScript, Angular,
                React, and Next.js. I combine software engineering with SDET practices to deliver
                reliable releases through strong architecture, test strategy, and CI/CD discipline.
              </p>
            </div>

            <!-- Testing Philosophy -->
            <div
              class="rounded-2xl border border-accent-200 bg-accent-50/50 p-6 dark:border-accent-800 dark:bg-accent-950/20"
            >
              <h3 class="mb-3 font-semibold text-accent-800 dark:text-accent-300">
                ⚙️ Engineering Principles
              </h3>
              <ul class="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                @for (principle of testingPrinciples; track principle) {
                  <li class="flex items-start gap-2">
                    <span class="mt-1 text-accent-500">✓</span>
                    <span>{{ principle }}</span>
                  </li>
                }
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class AboutComponent {
  readonly quickFacts = [
    { label: 'Location', value: 'Tbilisi, Georgia' },
    { label: 'Experience', value: '6+ Years' },
    { label: 'Focus', value: 'Software Engineering + SDET' },
    { label: 'Open to', value: 'New Opportunities' },
  ];

  readonly testingPrinciples = [
    'Design software with quality in mind: architecture, observability, and automated validation',
    'Build resilient services and APIs with domain-focused, maintainable code',
    'Shift testing left with reliable API, integration, and UI automation pipelines',
    'Deliver predictable releases through CI/CD, code review, and traceable test strategy',
    'Collaborate across product, engineering, and QA to turn requirements into reliable outcomes',
  ];
}
