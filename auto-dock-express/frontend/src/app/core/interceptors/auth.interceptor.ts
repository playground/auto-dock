/**
 * Auth Interceptor
 * Handles 401 Unauthorized responses (session expiry) and redirects to settings
 */

import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle both 401 (Unauthorized) and 403 (Forbidden) as auth issues
        if (error.status === 401 || error.status === 403) {
          const reason = error.status === 401 ? 'session_expired' : 'access_denied';
          console.warn(`Authentication error (${error.status}). Redirecting to settings...`);
          
          // Only redirect if not already on settings page
          if (!this.router.url.includes('/settings')) {
            this.router.navigate(['/settings'], {
              queryParams: { reason }
            });
          }
        }
        
        return throwError(() => error);
      })
    );
  }
}

// Made with Bob