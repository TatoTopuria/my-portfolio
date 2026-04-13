import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="border-t border-slate-800 bg-slate-900 text-slate-300">
      <div class="section-container py-12">
        <div class="flex flex-col items-center gap-6">
          <!-- Copyright -->
          <p class="text-center text-sm text-slate-500">&copy; {{ currentYear }} Tato Topuria.</p>

          <!-- Back to top -->
          <button
            (click)="scrollToTop()"
            class="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-white"
            aria-label="Back to top"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            Back to top
          </button>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
