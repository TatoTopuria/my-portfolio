import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Project } from '../../core/models/project.model';
import { TechBadgeComponent } from '../../shared/components/tech-badge/tech-badge';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [RouterLink, TechBadgeComponent, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-2 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/50"
      [class.ring-2]="project().featured"
      [class.ring-primary-500]="project().featured"
    >
      @if (project().featured) {
        <div
          class="absolute right-3 top-3 z-10 rounded-full bg-primary-600 px-2 py-0.5 text-xs font-medium text-white"
        >
          Featured
        </div>
      }

      @if (project().image) {
        <img
          [ngSrc]="project().image!"
          [alt]="project().title + ' project thumbnail'"
          width="1200"
          height="675"
          loading="lazy"
          class="h-40 w-full object-cover"
        />
      } @else {
        <div
          class="flex h-40 items-center justify-center bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30"
        >
          <span class="text-4xl font-bold text-primary-300 dark:text-primary-700">
            {{ project().title.charAt(0) }}
          </span>
        </div>
      }

      <div class="flex flex-1 flex-col p-6">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ project().title }}</h3>
        <p class="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {{ project().description }}
        </p>

        <!-- Tech badges -->
        <div class="mt-4 flex flex-wrap gap-2">
          @for (tech of project().techStack.slice(0, 4); track tech) {
            <app-tech-badge [name]="tech" />
          }
          @if (project().techStack.length > 4) {
            <span class="text-xs text-slate-400">+{{ project().techStack.length - 4 }} more</span>
          }
        </div>

        <!-- Links -->
        <div
          class="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700"
        >
          <a
            [routerLink]="['/projects', project().slug]"
            class="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400"
          >
            View Details →
          </a>
          @if (project().githubUrl) {
            <a
              [href]="project().githubUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="ml-auto text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              [attr.aria-label]="'View ' + project().title + ' on GitHub'"
            >
              GitHub
            </a>
          }
          @if (project().demoUrl) {
            <a
              [href]="project().demoUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              [attr.aria-label]="'Visit website for ' + project().title"
            >
              Website
            </a>
          }
        </div>
      </div>
    </article>
  `,
})
export class ProjectCardComponent {
  project = input.required<Project>();
}
