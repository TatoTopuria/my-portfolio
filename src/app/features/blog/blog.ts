import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { AnimateOnScrollDirective } from '../../core/directives/animate-on-scroll.directive';
import { TechBadgeComponent } from '../../shared/components/tech-badge/tech-badge';
import { ARTICLES } from '../../data/articles.data';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [SectionHeaderComponent, AnimateOnScrollDirective, TechBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="blog" class="section-padding" aria-labelledby="blog-heading">
      <div class="section-container">
        <app-section-header
          title="Articles & Writing"
          subtitle="Sharing knowledge and insights about engineering"
        />

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          @for (article of articles; track article.id; let i = $index) {
            <a
              [href]="article.url"
              target="_blank"
              rel="noopener noreferrer"
              appAnimateOnScroll
              animationClass="animate-fade-in-up"
              [delay]="i * 100"
              class="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800/50"
              [attr.aria-label]="'Read article: ' + article.title + ' on ' + article.platform"
            >
              <div class="mb-3 flex items-center justify-between">
                <span
                  class="rounded-full bg-accent-100 px-3 py-1 text-xs font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"
                >
                  {{ article.platform }}
                </span>
                @if (article.readTimeMinutes) {
                  <span class="text-xs text-slate-400">{{ article.readTimeMinutes }} min read</span>
                }
              </div>

              <h3
                class="text-base font-semibold text-slate-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400"
              >
                {{ article.title }}
              </h3>
              <p class="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {{ article.summary }}
              </p>

              <div
                class="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-700"
              >
                @for (tag of article.tags.slice(0, 3); track tag) {
                  <app-tech-badge [name]="tag" />
                }
              </div>

              <p class="mt-3 text-xs text-slate-400">
                {{ article.publishedDate }}
              </p>
            </a>
          }
        </div>
      </div>
    </section>
  `,
})
export class BlogComponent {
  readonly articles = ARTICLES;
}
