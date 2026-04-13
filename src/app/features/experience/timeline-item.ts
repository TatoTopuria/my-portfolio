import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Experience } from '../../core/models/experience.model';
import { TechBadgeComponent } from '../../shared/components/tech-badge/tech-badge';
import { AnimateOnScrollDirective } from '../../core/directives/animate-on-scroll.directive';

@Component({
  selector: 'app-timeline-item',
  standalone: true,
  imports: [TechBadgeComponent, AnimateOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <li
      appAnimateOnScroll
      [animationClass]="index() % 2 === 0 ? 'animate-slide-in-left' : 'animate-slide-in-right'"
      [delay]="index() * 150"
      class="relative flex gap-6 pb-12 last:pb-0"
    >
      <!-- Timeline line & dot -->
      <div class="flex flex-col items-center">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary-500 bg-white dark:bg-slate-900"
        >
          <div class="h-3 w-3 rounded-full bg-primary-500"></div>
        </div>
        <div class="mt-2 w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 last:hidden"></div>
      </div>

      <!-- Content -->
      <div class="flex-1 pb-2">
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
                {{ item().role }}
              </h3>
              <p class="font-medium text-primary-600 dark:text-primary-400">{{ item().company }}</p>
            </div>
            <div class="text-right">
              <time class="text-sm text-slate-500" [attr.datetime]="item().startDate">
                {{ item().startDate }} – {{ item().endDate }}
              </time>
              <p class="text-xs text-slate-400">{{ item().location }}</p>
            </div>
          </div>

          <p class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {{ item().description }}
          </p>

          <ul class="mt-3 space-y-1">
            @for (highlight of item().highlights; track highlight) {
              <li class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span class="mt-1 text-accent-500">▸</span>
                <span>{{ highlight }}</span>
              </li>
            }
          </ul>

          <div class="mt-4 flex flex-wrap gap-2">
            @for (tech of item().techStack; track tech) {
              <app-tech-badge [name]="tech" />
            }
          </div>
        </div>
      </div>
    </li>
  `,
})
export class TimelineItemComponent {
  item = input.required<Experience>();
  index = input<number>(0);
}
