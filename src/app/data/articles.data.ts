import { Article } from '../core/models/article.model';

export const ARTICLES: Article[] = [
  {
    id: 'angular-signals-guide',
    title: 'A Practical Guide to Angular Signals in 2025',
    summary:
      'Deep dive into Angular signals, computed values, and effects. Learn how to migrate from RxJS-heavy patterns to a signal-first architecture.',
    url: 'https://dev.to/tatotopuria/angular-signals-guide',
    platform: 'Dev.to',
    publishedDate: '2025-01-15',
    tags: ['Angular', 'TypeScript', 'Signals', 'Performance'],
    readTimeMinutes: 10,
  },
  {
    id: 'playwright-best-practices',
    title: 'playwright Best Practices for Enterprise E2E Testing',
    summary:
      'How to structure your Playwright test suite for maximum maintainability, reliability, and CI/CD integration at scale.',
    url: 'https://medium.com/@tatotopuria/playwright-best-practices',
    platform: 'Medium',
    publishedDate: '2024-09-10',
    tags: ['Playwright', 'Testing', 'E2E', 'CI/CD'],
    readTimeMinutes: 8,
  },
  {
    id: 'angular-ssr-vercel',
    title: 'Deploying Angular SSR to Vercel — From Zero to Production',
    summary:
      'Step-by-step guide to deploying an Angular 21 app with SSR to Vercel, including prerendering, environment variables, and security headers.',
    url: 'https://dev.to/tatotopuria/angular-ssr-vercel',
    platform: 'Dev.to',
    publishedDate: '2024-06-22',
    tags: ['Angular', 'SSR', 'Vercel', 'DevOps'],
    readTimeMinutes: 12,
  },
  {
    id: 'tailwind-v4-angular',
    title: 'Tailwind CSS v4 with Angular — CSS-First Configuration',
    summary:
      'Integrating Tailwind CSS v4 (CSS-based config with @theme) into an Angular project and building a full design system.',
    url: 'https://dev.to/tatotopuria/tailwind-v4-angular',
    platform: 'Dev.to',
    publishedDate: '2025-03-05',
    tags: ['Tailwind CSS', 'Angular', 'Design System', 'CSS'],
    readTimeMinutes: 7,
  },
];
