import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'card') {
      <div class="animate-pulse rounded-xl border border-slate-200 p-6 dark:border-slate-700">
        <div class="mb-4 h-40 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
        <div class="mb-2 h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
        <div class="mb-4 h-4 rounded bg-slate-200 dark:bg-slate-700"></div>
        <div class="flex gap-2">
          <div class="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-6 w-14 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>
      </div>
    } @else if (variant() === 'text') {
      <div class="animate-pulse space-y-3">
        <div class="h-4 w-full rounded bg-slate-200 dark:bg-slate-700"></div>
        <div class="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-700"></div>
        <div class="h-4 w-4/6 rounded bg-slate-200 dark:bg-slate-700"></div>
      </div>
    } @else if (variant() === 'graph') {
      <div class="animate-pulse">
        <div class="h-32 w-full rounded-xl bg-slate-200 dark:bg-slate-700"></div>
      </div>
    }
  `,
})
export class LoadingSkeletonComponent {
  variant = input<'card' | 'text' | 'graph'>('card');
}
