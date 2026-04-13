import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-section-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-16 text-center">
      <h2 class="text-3xl font-bold md:text-4xl">{{ title() }}</h2>
      @if (subtitle()) {
        <p class="mt-4 text-lg text-slate-600 dark:text-slate-400 md:text-xl">{{ subtitle() }}</p>
      }
      <div class="mx-auto mt-4 h-1 w-16 rounded-full bg-primary-500"></div>
    </div>
  `,
})
export class SectionHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>('');
}
