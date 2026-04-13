import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-tech-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide"
      [class]="colorClass()"
    >
      {{ name() }}
    </span>
  `,
})
export class TechBadgeComponent {
  name = input.required<string>();
  color = input<'primary' | 'accent' | 'neutral'>('neutral');

  colorClass(): string {
    const map: Record<'primary' | 'accent' | 'neutral', string> = {
      primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
      accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
      neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };
    return map[this.color()];
  }
}
