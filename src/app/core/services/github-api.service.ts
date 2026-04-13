import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, retry, throwError } from 'rxjs';
import { ENVIRONMENT } from '../tokens/environment.token';
import { ContributionData, GithubRepo, GithubUser } from '../models/github.model';

@Injectable({ providedIn: 'root' })
export class GithubApiService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(ENVIRONMENT);

  fetchRepos(): Observable<GithubRepo[]> {
    const url = `${this.env.githubApiUrl}/users/${this.env.githubUsername}/repos?sort=updated&per_page=30`;
    return this.http
      .get<GithubRepo[]>(url)
      .pipe(retry({ count: 2, delay: 1000 }), catchError(this.handleError));
  }

  fetchUserProfile(): Observable<GithubUser> {
    const url = `${this.env.githubApiUrl}/users/${this.env.githubUsername}`;
    return this.http
      .get<GithubUser>(url)
      .pipe(retry({ count: 2, delay: 1000 }), catchError(this.handleError));
  }

  fetchContributions(): Observable<ContributionData> {
    const url = `https://github-contributions-api.jogruber.de/v4/${this.env.githubUsername}`;
    return this.http
      .get<ContributionData>(url)
      .pipe(retry({ count: 2, delay: 1000 }), catchError(this.handleError));
  }

  private handleError(error: unknown): Observable<never> {
    console.error('GitHub API error:', error);
    return throwError(() => new Error('Failed to fetch GitHub data. Please try again later.'));
  }
}
