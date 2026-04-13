import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { ProjectCardComponent } from './project-card';
import { AnimateOnScrollDirective } from '../../core/directives/animate-on-scroll.directive';
import { PROJECTS } from '../../data/projects.data';
import type { Project } from '../../core/models/project.model';

type Filter = 'all' | Project['category'];

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [FormsModule, SectionHeaderComponent, ProjectCardComponent, AnimateOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="projects"
      class="section-padding bg-slate-50 dark:bg-slate-900/50"
      aria-labelledby="projects-heading"
    >
      <div class="section-container">
        <app-section-header title="Projects" subtitle="A selection of work I'm proud of" />

        <!-- Search + Filter -->
        <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Project category filters" class="flex flex-wrap gap-2">
            @for (filter of filters; track filter.value) {
              <button
                role="tab"
                [attr.aria-selected]="activeFilter() === filter.value"
                (click)="activeFilter.set(filter.value)"
                class="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                [class]="
                  activeFilter() === filter.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                "
              >
                {{ filter.label }}
              </button>
            }
          </div>

          <input
            type="search"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Search projects..."
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-primary-600"
            aria-label="Search projects"
          />
        </div>

        <!-- Grid -->
        @if (filteredProjects().length > 0) {
          <div
            appAnimateOnScroll
            animationClass="animate-fade-in-up"
            class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            @for (project of filteredProjects(); track project.slug) {
              <app-project-card [project]="project" />
            }
          </div>
        } @else {
          <div class="py-16 text-center">
            <p class="text-slate-500">No projects match your search. Try different filters.</p>
          </div>
        }
      </div>
    </section>
  `,
})
export class ProjectsComponent {
  readonly activeFilter = signal<Filter>('all');
  readonly searchQuery = signal('');

  readonly filters: { label: string; value: Filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Web', value: 'web' },
    { label: 'Automation', value: 'automation' },
    { label: 'Tools', value: 'tool' },
  ];

  readonly filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    return PROJECTS.filter((p) => {
      const matchCategory = this.activeFilter() === 'all' || p.category === this.activeFilter();
      const matchQuery =
        !query ||
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.techStack.some((t) => t.toLowerCase().includes(query));
      return matchCategory && matchQuery;
    });
  });
}
