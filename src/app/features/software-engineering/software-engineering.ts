import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { AnimateOnScrollDirective } from '../../core/directives/animate-on-scroll.directive';
import { ENGINEERING_PROJECTS } from '../../data/engineering-projects.data';

@Component({
  selector: 'app-software-engineering',
  standalone: true,
  imports: [SectionHeaderComponent, AnimateOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="software-engineering"
      class="section-padding bg-slate-50 dark:bg-slate-900/50"
      aria-labelledby="software-engineering-heading"
    >
      <div class="section-container">
        <app-section-header
          title="Software Engineering"
          subtitle="Architecture, distributed systems, and regulated-domain platforms built for production scale"
        />

        <div
          appAnimateOnScroll
          animationClass="animate-fade-in-up"
          class="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4"
          role="region"
          aria-label="Software engineering summary metrics"
        >
          <div
            class="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-800/60"
          >
            <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {{ totalProjects }}
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Systems Analyzed</p>
          </div>
          <div
            class="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-800/60"
          >
            <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {{ microserviceCount }}
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Microservices</p>
          </div>
          <div
            class="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-800/60"
          >
            <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {{ architecturePatterns }}
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Architecture Patterns</p>
          </div>
          <div
            class="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-800/60"
          >
            <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {{ integrationDomains }}
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Integration Domains</p>
          </div>
        </div>

        <div
          class="mb-12 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60"
        >
          <h3 class="mb-4 text-xl font-semibold text-slate-900 dark:text-white">
            Cross-Project Engineering Themes
          </h3>
          <div class="grid gap-4 md:grid-cols-2">
            @for (theme of themes; track theme.title) {
              <div
                class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <p class="font-medium text-primary-700 dark:text-primary-300">{{ theme.title }}</p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {{ theme.description }}
                </p>
              </div>
            }
          </div>
        </div>

        <div
          class="grid grid-cols-1 gap-6 lg:grid-cols-2"
          role="list"
          aria-label="Software engineering project highlights"
        >
          @for (project of projects; track project.id) {
            <article
              appAnimateOnScroll
              animationClass="animate-fade-in-up"
              class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/70"
              role="listitem"
            >
              <div class="mb-3 flex items-center justify-between gap-3">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
                  {{ project.name }}
                </h3>
                <span
                  class="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:border-primary-700/60 dark:bg-primary-900/30 dark:text-primary-300"
                >
                  {{ project.type }}
                </span>
              </div>

              <p class="mb-2 text-sm text-slate-500 dark:text-slate-400">{{ project.domain }}</p>
              <p class="mb-4 text-sm text-slate-700 dark:text-slate-300">
                <span class="font-medium">Architecture:</span> {{ project.architecture }}
              </p>

              <div class="mb-4">
                <p
                  class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  Tech stack
                </p>
                <div class="flex flex-wrap gap-2">
                  @for (item of project.stack; track item) {
                    <span
                      class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-700/70 dark:text-slate-200"
                      >{{ item }}</span
                    >
                  }
                </div>
              </div>

              <div class="mb-4">
                <p
                  class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  Integrations
                </p>
                <ul class="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  @for (integration of project.integrations.slice(0, 3); track integration) {
                    <li>• {{ integration }}</li>
                  }
                </ul>
              </div>

              <div class="mb-4">
                <p
                  class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  Scale highlights
                </p>
                <div class="flex flex-wrap gap-2">
                  @for (item of project.scale.slice(0, 3); track item) {
                    <span
                      class="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
                      >{{ item }}</span
                    >
                  }
                </div>
              </div>

              <p class="text-sm text-slate-700 dark:text-slate-300">{{ project.impact }}</p>
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class SoftwareEngineeringComponent {
  readonly projects = ENGINEERING_PROJECTS;

  readonly totalProjects = this.projects.length;
  readonly microserviceCount = this.projects.filter((p) => p.type === 'Microservice').length;
  readonly architecturePatterns = 4;
  readonly integrationDomains = 9;

  readonly themes = [
    {
      title: 'Clean Architecture + CQRS',
      description:
        'Service boundaries are organized around commands, queries, and explicit domain contracts for maintainability and change safety.',
    },
    {
      title: 'Regulated Integrations',
      description:
        'Projects integrate identity, KYC, AML, and government systems with auditable workflows and policy-driven controls.',
    },
    {
      title: 'Platform Reuse',
      description:
        'Shared template and utility services accelerate delivery by standardizing architecture decisions and cross-cutting concerns.',
    },
    {
      title: 'Production Scale Delivery',
      description:
        'Systems are built for high endpoint counts, multi-tenant behavior, and resilient orchestration across external providers.',
    },
  ];
}
