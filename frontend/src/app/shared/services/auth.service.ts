import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface AuthResponse {
  token: string; userId: string; username: string; firstName: string; lastName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = 'http://localhost:5262/api/auth';

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null { return localStorage.getItem('token'); }
  get userId(): string | null { return localStorage.getItem('userId'); }
  get isLoggedIn(): boolean { return !!this.token; }

  register(firstName: string, lastName: string, username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, { firstName, lastName, username, password })
      .pipe(tap(res => this.store(res)));
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/login`, { username, password })
      .pipe(tap(res => this.store(res)));
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    this.router.navigate(['/login']);
  }

  private store(res: AuthResponse): void {
    localStorage.setItem('token', res.token);
    localStorage.setItem('userId', res.userId);
  }
}
