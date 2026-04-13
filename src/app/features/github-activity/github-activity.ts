import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { catchError, of } from 'rxjs';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton';
import { GithubApiService } from '../../core/services/github-api.service';
import { ENVIRONMENT } from '../../core/tokens/environment.token';

@Component({
  selector: 'app-github-activity',
  standalone: true,
  imports: [SectionHeaderComponent, LoadingSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="github-activity" class="section-padding" aria-labelledby="github-heading">
      <div class="section-container">
        <app-section-header
          title="GitHub Activity"
          subtitle="Contribution insights and coding consistency"
        />

        @if (loading()) {
          <div class="grid gap-6 lg:grid-cols-2">
            <app-loading-skeleton variant="card" />
            <app-loading-skeleton variant="card" />
          </div>
        } @else if (error()) {
          <div
            class="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/20"
          >
            <p class="text-red-600 dark:text-red-400">
              Could not load GitHub data. Please check back later.
            </p>
          </div>
        } @else {
          <div class="mb-8 grid gap-5 lg:grid-cols-2">
            <a
              [href]="activityGraphLink()"
              target="_blank"
              rel="noopener noreferrer"
              class="group overflow-hidden rounded-3xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-4 shadow-md shadow-cyan-100/70 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-cyan-900/40 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950/40 dark:shadow-none"
              aria-label="Open GitHub activity graph"
            >
              <p
                class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300"
              >
                Activity Graph
              </p>
              <img
                [src]="activityGraphUrl()"
                alt="GitHub activity graph"
                loading="lazy"
                class="w-full rounded-xl border border-cyan-100/80 dark:border-slate-700"
              />
            </a>

            <a
              [href]="streakLink"
              target="_blank"
              rel="noopener noreferrer"
              class="group overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-4 shadow-md shadow-emerald-100/70 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-emerald-900/40 dark:from-slate-900 dark:via-slate-800 dark:to-cyan-950/40 dark:shadow-none"
              aria-label="Open GitHub streak stats"
            >
              <p
                class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300"
              >
                Streak Stats
              </p>
              <img
                [src]="streakUrl()"
                alt="GitHub contribution streak"
                loading="lazy"
                class="w-full rounded-xl border border-emerald-100/80 dark:border-slate-700"
              />
            </a>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Total Contributions
              </p>
              <p class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {{ contributionTotal() }}
              </p>
            </div>
            <div
              class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Active Days
              </p>
              <p class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {{ activeDays() }}
              </p>
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class GithubActivityComponent implements OnInit {
  private readonly githubService = inject(GithubApiService);
  private readonly env = inject(ENVIRONMENT);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly contributionTotal = signal(0);
  readonly activeDays = signal(0);
  readonly placeholder = [1, 2, 3, 4];

  readonly username = computed(() => this.env.githubUsername);
  readonly activityGraphLink = computed(
    () => `https://github.com/${encodeURIComponent(this.username())}/github-readme-activity-graph`,
  );
  readonly activityGraphUrl = computed(
    () =>
      `https://github-readme-activity-graph.vercel.app/graph?username=${encodeURIComponent(this.username())}&theme=react-dark&count_private=true`,
  );
  readonly streakLink = 'https://git.io/streak-stats';
  readonly streakUrl = computed(
    () =>
      `https://streak-stats.demolab.com/?user=${encodeURIComponent(this.username())}&theme=transparent&count_private=true`,
  );

  ngOnInit(): void {
    this.githubService
      .fetchContributions()
      .pipe(catchError(() => of({ total: {}, contributions: [] })))
      .subscribe((data) => {
        const total = Object.values(data.total).reduce((sum, value) => sum + value, 0);
        const activeDays = data.contributions.filter((d) => d.count > 0).length;

        this.contributionTotal.set(total);
        this.activeDays.set(activeDays);
        this.loading.set(false);
      });
  }
}
