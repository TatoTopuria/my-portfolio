import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      id="main-content"
      class="flex min-h-screen flex-col items-center justify-center section-container py-20 text-center"
    >
      <p class="text-8xl font-bold text-primary-200 dark:text-primary-900">404</p>
      <h1 class="mt-4 text-3xl font-bold text-slate-900 dark:text-white">Page Not Found</h1>
      <p class="mt-2 text-slate-500 dark:text-slate-400">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a
        routerLink="/"
        class="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-medium text-white transition-colors hover:bg-primary-700"
      >
        ← Back to Home
      </a>
    </main>
  `,
})
export class NotFoundComponent implements OnInit {
  private readonly seoService = inject(SeoService);

  ngOnInit(): void {
    this.seoService.updateSeo({
      title: '404 — Page Not Found',
      description: 'The page you are looking for does not exist or has been moved.',
      noIndex: true,
    });
  }
}
