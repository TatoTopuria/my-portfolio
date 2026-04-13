import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Skill } from '../../core/models/skill.model';

@Component({
  selector: 'app-skill-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:scale-105 hover:border-primary-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-primary-700"
    >
      <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ skill().name }}</p>
    </div>
  `,
})
export class SkillCardComponent {
  skill = input.required<Skill>();
}
