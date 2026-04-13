import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ScrollService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly activeSection = signal<string>('hero');

  private observers = new Map<string, IntersectionObserver>();

  observeSection(id: string, element: Element): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeSection.set(id);
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    this.observers.set(id, observer);
  }

  unobserveSection(id: string, element: Element): void {
    const observer = this.observers.get(id);
    if (observer) {
      observer.unobserve(element);
      observer.disconnect();
      this.observers.delete(id);
    }
  }

  scrollTo(sectionId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
