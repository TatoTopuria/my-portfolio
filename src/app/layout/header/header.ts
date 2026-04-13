import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { ScrollService } from '../../core/services/scroll.service';

interface NavItem {
  label: string;
  section: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="sticky top-0 z-50 border-b border-slate-200/60 backdrop-blur-md dark:border-slate-800/60"
      style="background: rgba(255,255,255,0.85)"
    >
      <nav
        aria-label="Main navigation"
        class="section-container flex h-16 items-center justify-between"
      >
        <!-- Logo -->
        <button
          (click)="scrollTo('hero')"
          class="text-lg font-bold text-primary-600 dark:text-primary-400"
          aria-label="Back to top"
        >
          TT
        </button>

        <!-- Desktop nav -->
        <ul class="hidden items-center gap-6 md:flex" role="list">
          @for (item of navItems; track item.section) {
            <li>
              <button
                (click)="scrollTo(item.section)"
                [attr.aria-current]="activeSection() === item.section ? 'true' : null"
                class="text-sm font-medium transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                [class.text-primary-600]="activeSection() === item.section"
                [class.dark:text-primary-400]="activeSection() === item.section"
                [class.text-slate-600]="activeSection() !== item.section"
                [class.dark:text-slate-400]="activeSection() !== item.section"
              >
                {{ item.label }}
              </button>
            </li>
          }
        </ul>

        <!-- Theme toggle + mobile hamburger -->
        <div class="flex items-center gap-3">
          <button
            (click)="toggleTheme()"
            [attr.aria-label]="'Toggle dark mode, currently ' + (isDarkMode() ? 'dark' : 'light')"
            [attr.aria-pressed]="isDarkMode()"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            @if (isDarkMode()) {
              <!-- Sun icon -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
                />
              </svg>
            } @else {
              <!-- Moon icon -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            }
          </button>

          <!-- Hamburger (mobile) -->
          <button
            (click)="toggleMobileMenu()"
            [attr.aria-expanded]="mobileMenuOpen()"
            aria-controls="mobile-menu"
            aria-label="Toggle mobile navigation"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              @if (mobileMenuOpen()) {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              } @else {
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              }
            </svg>
          </button>
        </div>
      </nav>

      <!-- Mobile menu -->
      @if (mobileMenuOpen()) {
        <div
          id="mobile-menu"
          class="border-t border-slate-200 bg-white/95 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
        >
          <ul class="flex flex-col gap-2" role="list">
            @for (item of navItems; track item.section) {
              <li>
                <button
                  (click)="scrollTo(item.section); closeMobileMenu()"
                  class="w-full rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  [class.text-primary-600]="activeSection() === item.section"
                  [class.dark:text-primary-400]="activeSection() === item.section"
                >
                  {{ item.label }}
                </button>
              </li>
            }
          </ul>
        </div>
      }
    </header>
  `,
})
export class HeaderComponent {
  private readonly themeService = inject(ThemeService);
  private readonly scrollService = inject(ScrollService);

  readonly isDarkMode = this.themeService.isDarkMode;
  readonly activeSection = this.scrollService.activeSection;
  readonly mobileMenuOpen = signal(false);

  readonly navItems: NavItem[] = [
    { label: 'About', section: 'about' },
    { label: 'Skills', section: 'skills' },
    { label: 'Projects', section: 'projects' },
    { label: 'Experience', section: 'experience' },
    { label: 'Software Engineering', section: 'software-engineering' },
    { label: 'Test Automation', section: 'test-automation' },
    { label: 'GitHub', section: 'github-activity' },
    { label: 'Contact', section: 'contact' },
  ];

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  scrollTo(section: string): void {
    this.scrollService.scrollTo(section);
  }
}
