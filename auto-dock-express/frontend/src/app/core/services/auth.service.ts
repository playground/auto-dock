import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private readonly TOKEN_KEY = 'bob_desktop_auth_token';
  private readonly USER_KEY = 'bob_desktop_user';

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const storedUser = localStorage.getItem(this.USER_KEY);
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.currentUserSubject.next(user);
      } catch (error) {
        console.error('Failed to parse stored user', error);
        this.logout();
      }
    }
  }

  public get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  public get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  public get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  login(email: string, password: string): Observable<User> {
    // In a real app, this would make an API call
    // For now, we'll simulate a successful login
    return of({
      id: '1',
      email,
      name: 'Demo User'
    }).pipe(
      tap(user => {
        // Store token and user
        localStorage.setItem(this.TOKEN_KEY, 'demo_token');
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
    
    // Real implementation would be:
    // return this.http.post<{token: string, user: User}>(`${environment.apiUrl}/auth/login`, { email, password })
    //   .pipe(
    //     tap(response => {
    //       localStorage.setItem(this.TOKEN_KEY, response.token);
    //       localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    //       this.currentUserSubject.next(response.user);
    //     }),
    //     map(response => response.user)
    //   );
  }

  register(email: string, password: string, name: string): Observable<User> {
    // In a real app, this would make an API call
    // For now, we'll simulate a successful registration
    return of({
      id: '1',
      email,
      name
    }).pipe(
      tap(user => {
        // Store token and user
        localStorage.setItem(this.TOKEN_KEY, 'demo_token');
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
    
    // Real implementation would be:
    // return this.http.post<{token: string, user: User}>(`${environment.apiUrl}/auth/register`, { email, password, name })
    //   .pipe(
    //     tap(response => {
    //       localStorage.setItem(this.TOKEN_KEY, response.token);
    //       localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    //       this.currentUserSubject.next(response.user);
    //     }),
    //     map(response => response.user)
    //   );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
  }

  updateProfile(userData: Partial<User>): Observable<User> {
    const currentUser = this.currentUser;
    if (!currentUser) {
      return of(null as unknown as User);
    }

    // In a real app, this would make an API call
    // For now, we'll simulate a successful update
    const updatedUser = { ...currentUser, ...userData };
    
    return of(updatedUser).pipe(
      tap(user => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
    
    // Real implementation would be:
    // return this.http.put<User>(`${environment.apiUrl}/users/profile`, userData)
    //   .pipe(
    //     tap(user => {
    //       localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    //       this.currentUserSubject.next(user);
    //     })
    //   );
  }
}

// Made with Bob
