import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ParticleBackgroundComponent } from '../../shared/components/particle-background/particle-background';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [ParticleBackgroundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="hero"
      class="relative flex min-h-screen items-center overflow-hidden perspective-1000"
      aria-label="Hero section"
    >
      <app-particle-background />

      <!-- Gradient backdrop -->
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/50 via-transparent to-accent-50/30 dark:from-primary-950/30 dark:to-accent-950/20"
      ></div>

      <div class="section-container relative z-10 py-24">
        <div class="max-w-3xl">
          <p
            class="mb-4 animate-fade-in-up text-sm font-medium uppercase tracking-widest text-primary-600 dark:text-primary-400"
          >
            Hello, I'm
          </p>

          <h1
            class="animate-fade-in-up stagger-1 text-5xl font-bold tracking-tight text-slate-900 dark:text-white md:text-7xl"
          >
            Tato Topuria
          </h1>

          <div
            class="animate-fade-in-up stagger-2 mt-4 text-2xl font-medium text-slate-600 dark:text-slate-300 md:text-3xl"
            aria-live="polite"
            aria-label="Software Engineer & Test Automation Lead"
          >
            <span #typewriter></span>
            <span class="animate-pulse text-primary-500">|</span>
          </div>

          <p
            class="animate-fade-in-up stagger-3 mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400"
          >
            Full-cycle Software Engineer and SDET with 6+ years of experience delivering production
            systems and quality platforms across .NET/C#, Spring/Java, Node.js, Angular, React, and
            Next.js.
          </p>

          <div class="animate-fade-in-up stagger-4 mt-10 flex flex-wrap gap-4">
            <a
              href="#projects"
              (click)="scrollToProjects($event)"
              class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-medium text-white shadow-lg shadow-primary-500/30 transition-all hover:bg-primary-700 hover:-translate-y-0.5 hover:shadow-primary-500/40"
            >
              View Projects
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
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </a>
            <a
              href="#contact"
              (click)="scrollToContact($event)"
              class="inline-flex items-center gap-2 rounded-xl border-2 border-primary-300 px-6 py-3 font-medium text-primary-700 transition-all hover:bg-primary-50 hover:-translate-y-0.5 dark:border-primary-700 dark:text-primary-300 dark:hover:bg-primary-950/30"
            >
              Get In Touch
            </a>
          </div>

          <!-- Stats -->
          <div
            class="animate-fade-in-up stagger-5 mt-16 flex flex-wrap gap-8 border-t border-slate-200 pt-8 dark:border-slate-800"
          >
            @for (stat of stats; track stat.label) {
              <div>
                <p class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {{ stat.value }}
                </p>
                <p class="text-sm text-slate-500 dark:text-slate-400">{{ stat.label }}</p>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Scroll indicator -->
      <div
        class="animate-fade-in-down stagger-6 absolute bottom-8 left-1/2 -translate-x-1/2 animate-float"
        aria-hidden="true"
      >
        <div
          class="flex h-10 w-6 items-start justify-center rounded-full border-2 border-slate-400 p-1"
        >
          <div class="h-2 w-1 animate-bounce rounded-full bg-slate-400"></div>
        </div>
      </div>
    </section>
  `,
})
export class HeroComponent implements AfterViewInit {
  @ViewChild('typewriter') typewriterEl!: ElementRef<HTMLSpanElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly stats = [
    { value: '6+', label: 'Years Experience' },
    { value: '7+', label: 'Core Stacks Delivered' },
    { value: '10k+', label: 'Automated Test Cases' },
    { value: '2', label: 'Markets Served' },
  ];

  private readonly phrases = [
    'Software Engineer',
    'SDET Engineer',
    '.NET / C# Backend Developer',
    'Spring / Java Engineer',
    'Angular, React & Next.js Developer',
    'Node.js API Developer',
  ];

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.startTypewriter();
  }

  private startTypewriter(): void {
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const type = (): void => {
      const phrase = this.phrases[phraseIndex % this.phrases.length] ?? '';
      const el = this.typewriterEl?.nativeElement;
      if (!el) return;

      if (!deleting) {
        el.textContent = phrase.slice(0, charIndex + 1);
        charIndex++;
        if (charIndex === phrase.length) {
          timeout = setTimeout(() => {
            deleting = true;
            type();
          }, 2000);
          return;
        }
      } else {
        el.textContent = phrase.slice(0, charIndex - 1);
        charIndex--;
        if (charIndex === 0) {
          deleting = false;
          phraseIndex++;
        }
      }
      timeout = setTimeout(type, deleting ? 50 : 100);
    };

    type();
    this.destroyRef.onDestroy(() => clearTimeout(timeout));
  }

  scrollToProjects(e: Event): void {
    e.preventDefault();
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
  }

  scrollToContact(e: Event): void {
    e.preventDefault();
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  }
}
