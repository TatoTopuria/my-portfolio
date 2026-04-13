import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  OnInit,
  PLATFORM_ID,
  Renderer2,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appAnimateOnScroll]',
  standalone: true,
})
export class AnimateOnScrollDirective implements OnInit {
  animationClass = input<string>('animate-fade-in-up');
  threshold = input<number>(0.1);
  delay = input<number>(0);
  once = input<boolean>(true);

  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.renderer.setStyle(this.el.nativeElement, 'opacity', '0');

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (this.delay() > 0) {
              this.renderer.setStyle(this.el.nativeElement, 'animation-delay', `${this.delay()}ms`);
            }
            this.renderer.addClass(this.el.nativeElement, this.animationClass());
            this.renderer.setStyle(this.el.nativeElement, 'opacity', '');
            if (this.once() && this.observer) {
              this.observer.unobserve(this.el.nativeElement);
            }
          } else if (!this.once()) {
            this.renderer.removeClass(this.el.nativeElement, this.animationClass());
            this.renderer.setStyle(this.el.nativeElement, 'opacity', '0');
          }
        }
      },
      { threshold: this.threshold() },
    );

    this.observer.observe(this.el.nativeElement);

    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
    });
  }
}
