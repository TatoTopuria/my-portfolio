import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { AnimateOnScrollDirective } from '../../core/directives/animate-on-scroll.directive';
import { CERTIFICATIONS } from '../../data/certifications.data';

@Component({
  selector: 'app-certifications',
  standalone: true,
  imports: [SectionHeaderComponent, AnimateOnScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="certifications"
      class="section-padding bg-slate-50 dark:bg-slate-900/50"
      aria-labelledby="certifications-heading"
    >
      <div class="section-container">
        <app-section-header
          title="Certifications"
          subtitle="Professional qualifications and continuing education"
        />

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          @for (cert of certifications; track cert.id; let i = $index) {
            <article
              appAnimateOnScroll
              animationClass="animate-scale-in"
              [delay]="i * 100"
              class="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div
                class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30"
              >
                <span class="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {{ cert.issuer.charAt(0) }}
                </span>
              </div>
              <h3 class="text-base font-semibold text-slate-900 dark:text-white">
                {{ cert.name }}
              </h3>
              <p class="mt-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                {{ cert.issuer }}
              </p>
              <p class="mt-2 text-xs text-slate-400">Issued: {{ cert.issueDate }}</p>
              @if (cert.expiryDate) {
                <p class="text-xs text-slate-400">Expires: {{ cert.expiryDate }}</p>
              }
              @if (cert.verifyUrl) {
                <a
                  [href]="cert.verifyUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-auto pt-4 text-sm font-medium text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400"
                  [attr.aria-label]="'Verify ' + cert.name + ' certificate'"
                >
                  Verify credential →
                </a>
              }
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class CertificationsComponent {
  readonly certifications = CERTIFICATIONS;
}
