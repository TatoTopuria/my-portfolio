import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'portfolio-theme';

  readonly isDarkMode = signal<boolean>(this.getInitialDarkMode());
  readonly themeIcon = computed(() => (this.isDarkMode() ? 'sun' : 'moon'));

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const html = document.documentElement;
      if (this.isDarkMode()) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      localStorage.setItem(this.storageKey, this.isDarkMode() ? 'dark' : 'light');
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update((v) => !v);
  }

  private getInitialDarkMode(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    const stored = localStorage.getItem(this.storageKey);
    if (stored) return stored === 'dark';
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
