import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appParallax]',
  standalone: true,
})
export class ParallaxDirective implements OnInit {
  speed = input<number>(0.5);

  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private rafId?: number;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Respect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onScroll = (): void => {
      if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => {
        const translateY = window.scrollY * this.speed();
        this.el.nativeElement.style.transform = `translateY(${translateY}px)`;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    });
  }
}
