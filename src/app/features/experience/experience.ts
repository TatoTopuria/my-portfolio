import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { TimelineItemComponent } from './timeline-item';
import { EXPERIENCE } from '../../data/experience.data';

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [SectionHeaderComponent, TimelineItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="experience"
      class="section-padding bg-slate-50 dark:bg-slate-900/50"
      aria-labelledby="experience-heading"
    >
      <div class="section-container">
        <app-section-header
          title="Experience"
          subtitle="My professional journey building software and quality"
        />

        <ol class="relative" aria-label="Work experience timeline">
          @for (item of experience; track item.id; let i = $index) {
            <app-timeline-item [item]="item" [index]="i" />
          }
        </ol>
      </div>
    </section>
  `,
})
export class ExperienceComponent {
  readonly experience = EXPERIENCE;
}
