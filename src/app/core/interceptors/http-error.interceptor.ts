import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: unknown) => {
      const status = (error as { status?: number })?.status;
      if (status === 429) {
        console.warn('GitHub API rate limit reached. Retrying later.');
      } else if (status === 404) {
        console.warn(`Resource not found: ${req.url}`);
      } else {
        console.error('HTTP error:', error);
      }
      return throwError(() => error);
    }),
  );
};
