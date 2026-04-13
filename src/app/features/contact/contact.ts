import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { EmailjsService } from '../../core/services/emailjs.service';
import { SOCIAL_LINKS } from '../../data/social-links.data';

type FormState = 'idle' | 'sending' | 'success' | 'error';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [SectionHeaderComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="contact"
      class="section-padding bg-slate-50 dark:bg-slate-900/50"
      aria-labelledby="contact-heading"
    >
      <div class="section-container">
        <app-section-header title="Get In Touch" subtitle="Have a project in mind? Let's talk." />

        <div class="mx-auto grid max-w-4xl gap-12 md:grid-cols-2">
          <!-- Social sidebar -->
          <div class="space-y-6">
            <div>
              <h3 class="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
                Let's connect
              </h3>
              <p class="text-slate-600 dark:text-slate-400">
                Whether you have a role to fill, a project to discuss, or just want to say hi — my
                inbox is always open.
              </p>
            </div>

            <div class="space-y-3">
              @for (link of socialLinks; track link.label) {
                <a
                  [href]="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="link.ariaLabel"
                  class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-primary-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <span class="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {{ link.label }}
                  </span>
                  <span class="ml-auto text-xs text-slate-400">↗</span>
                </a>
              }
            </div>
          </div>

          <!-- Contact form -->
          <form [formGroup]="contactForm" (ngSubmit)="onSubmit()" novalidate class="space-y-5">
            <!-- Name -->
            <div>
              <label
                for="contact-name"
                class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                formControlName="name"
                autocomplete="name"
                [attr.aria-describedby]="nameError() ? 'name-error' : null"
                [attr.aria-invalid]="nameError() ? 'true' : null"
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              @if (nameError()) {
                <p id="name-error" role="alert" class="mt-1 text-xs text-red-500">
                  Name is required.
                </p>
              }
            </div>

            <!-- Email -->
            <div>
              <label
                for="contact-email"
                class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email <span aria-hidden="true">*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                formControlName="email"
                autocomplete="email"
                [attr.aria-describedby]="emailError() ? 'email-error' : null"
                [attr.aria-invalid]="emailError() ? 'true' : null"
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              @if (emailError()) {
                <p id="email-error" role="alert" class="mt-1 text-xs text-red-500">
                  Please enter a valid email address.
                </p>
              }
            </div>

            <!-- Message -->
            <div>
              <label
                for="contact-message"
                class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Message <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="contact-message"
                formControlName="message"
                rows="5"
                [attr.aria-describedby]="messageError() ? 'message-error' : null"
                [attr.aria-invalid]="messageError() ? 'true' : null"
                class="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              ></textarea>
              @if (messageError()) {
                <p id="message-error" role="alert" class="mt-1 text-xs text-red-500">
                  Message must be at least 10 characters.
                </p>
              }
            </div>

            <!-- Status message -->
            <div aria-live="polite" aria-atomic="true">
              @if (formState() === 'success') {
                <p
                  class="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400"
                >
                  ✓ Message sent! I'll get back to you soon.
                </p>
              } @else if (formState() === 'error') {
                <p
                  class="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400"
                >
                  Something went wrong. Please try emailing me directly.
                </p>
              }
            </div>

            <!-- Submit -->
            <button
              type="submit"
              [disabled]="contactForm.invalid || formState() === 'sending'"
              [attr.aria-disabled]="contactForm.invalid || formState() === 'sending'"
              class="w-full rounded-xl bg-primary-600 px-6 py-3 font-medium text-white transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ formState() === 'sending' ? 'Sending...' : 'Send Message' }}
            </button>
          </form>
        </div>
      </div>
    </section>
  `,
})
export class ContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly emailjsService = inject(EmailjsService);

  readonly socialLinks = SOCIAL_LINKS.filter(
    (link) => link.label !== 'Dev.to' && link.label !== 'Medium',
  );
  readonly formState = signal<FormState>('idle');

  readonly contactForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  nameError(): boolean {
    const c = this.contactForm.controls.name;
    return c.invalid && c.touched;
  }

  emailError(): boolean {
    const c = this.contactForm.controls.email;
    return c.invalid && c.touched;
  }

  messageError(): boolean {
    const c = this.contactForm.controls.message;
    return c.invalid && c.touched;
  }

  async onSubmit(): Promise<void> {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.formState.set('sending');
    const { name, email, message } = this.contactForm.getRawValue();

    try {
      await this.emailjsService.send({ name, email, message });
      this.formState.set('success');
      this.contactForm.reset();
    } catch {
      this.formState.set('error');
    }
  }
}
