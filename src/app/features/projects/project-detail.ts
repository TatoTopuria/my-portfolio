import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PROJECTS } from '../../data/projects.data';
import { TechBadgeComponent } from '../../shared/components/tech-badge/tech-badge';
import { SeoService } from '../../core/services/seo.service';
import type { Project } from '../../core/models/project.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, TechBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="main-content" class="section-padding section-container">
      @if (project) {
        <article>
          <a
            routerLink="/"
            class="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-primary-600 dark:text-slate-400"
          >
            ← Back to home
          </a>

          <header class="mb-10">
            @if (project.featured) {
              <span
                class="mb-4 inline-block rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
              >
                Featured Project
              </span>
            }
            <h1 class="text-4xl font-bold text-slate-900 dark:text-white md:text-5xl">
              {{ project.title }}
            </h1>
            <p class="mt-4 text-xl text-slate-600 dark:text-slate-400">{{ project.description }}</p>
          </header>

          <!-- Tech stack -->
          <section aria-label="Technology stack" class="mb-8">
            <h2 class="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
              Tech Stack
            </h2>
            <div class="flex flex-wrap gap-2">
              @for (tech of project.techStack; track tech) {
                <app-tech-badge [name]="tech" color="primary" />
              }
            </div>
          </section>

          <!-- Long description -->
          @if (project.longDescription) {
            <section aria-label="Project details" class="mb-8">
              <h2 class="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
                About this project
              </h2>
              <p class="leading-relaxed text-slate-600 dark:text-slate-400">
                {{ project.longDescription }}
              </p>
            </section>
          }

          <!-- Links -->
          <div class="flex flex-wrap gap-4">
            @if (project.githubUrl) {
              <a
                [href]="project.githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                View on GitHub
              </a>
            }
            @if (project.demoUrl) {
              <a
                [href]="project.demoUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-medium text-white transition-colors hover:bg-primary-700"
              >
                Live Demo
              </a>
            }
          </div>
        </article>
      } @else {
        <div class="py-20 text-center">
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Project Not Found</h1>
          <p class="mt-2 text-slate-500">The project you're looking for doesn't exist.</p>
          <a
            routerLink="/"
            class="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-medium text-white"
          >
            ← Back to home
          </a>
        </div>
      }
    </main>
  `,
})
export class ProjectDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly seoService = inject(SeoService);

  project: Project | undefined;

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    this.project = PROJECTS.find((p) => p.slug === slug);

    if (this.project) {
      this.seoService.updateSeo({
        title: this.project.title,
        description: this.project.description,
        image: this.project.image
          ? `https://tatotopuria.vercel.app${this.project.image}`
          : undefined,
        url: `/projects/${this.project.slug}`,
      });
    }
  }
}
