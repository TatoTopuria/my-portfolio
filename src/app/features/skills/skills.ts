import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { SkillCardComponent } from './skill-card';
import { AnimateOnScrollDirective } from '../../core/directives/animate-on-scroll.directive';
import { SKILLS } from '../../data/skills.data';
import type { SkillCategory } from '../../core/models/skill.model';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [SectionHeaderComponent, SkillCardComponent, AnimateOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="skills" class="section-padding" aria-labelledby="skills-heading">
      <div class="section-container">
        <app-section-header
          title="Skills & Expertise"
          subtitle="Technologies and tools I work with professionally"
        />

        <!-- Category tabs -->
        <div
          role="tablist"
          aria-label="Skill categories"
          class="mb-10 flex flex-wrap justify-center gap-2"
        >
          @for (cat of categories; track cat) {
            <button
              role="tab"
              [attr.aria-selected]="activeCategory() === cat"
              [attr.aria-controls]="'skills-panel-' + cat"
              (click)="activeCategory.set(cat)"
              class="rounded-full px-5 py-2 text-sm font-medium transition-all"
              [class]="
                activeCategory() === cat
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              "
            >
              {{ cat }}
            </button>
          }
        </div>

        <!-- Skills grid -->
        <div
          [id]="'skills-panel-' + activeCategory()"
          role="tabpanel"
          [attr.aria-labelledby]="'tab-' + activeCategory()"
          appAnimateOnScroll
          animationClass="animate-fade-in-up"
          class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
        >
          @for (skill of filteredSkills(); track skill.name) {
            <app-skill-card [skill]="skill" />
          }
        </div>
      </div>
    </section>
  `,
})
export class SkillsComponent {
  readonly activeCategory = signal<SkillCategory>('Frontend');

  readonly categories: SkillCategory[] = ['Frontend', 'Backend', 'Testing', 'DevOps', 'Tools'];

  readonly filteredSkills = computed(() =>
    SKILLS.filter((s) => s.category === this.activeCategory()),
  );
}
