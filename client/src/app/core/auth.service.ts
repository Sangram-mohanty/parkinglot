import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';
import { User } from './models';

interface LoginResponse {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenKey = 'parking.accessToken';
  private readonly userKey = 'parking.user';
  private readonly userSubject = new BehaviorSubject<User | null>(this.readUser());
  readonly user$ = this.userSubject.asObservable();

  get token(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  signIn(email: string, password: string) {
    return this.saveSession(this.http.post<LoginResponse>('/api/auth/login', { email, password }));
  }

  signUp(name: string, email: string, password: string) {
    return this.saveSession(this.http.post<LoginResponse>('/api/auth/signup', { name, email, password }));
  }

  private saveSession(request: import('rxjs').Observable<LoginResponse>) {
    return request.pipe(
      tap(({ token, user }) => {
        sessionStorage.setItem(this.tokenKey, token);
        sessionStorage.setItem(this.userKey, JSON.stringify(user));
        this.userSubject.next(user);
      })
    );
  }

  signOut(): void {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
    this.userSubject.next(null);
  }

  private readUser(): User | null {
    try {
      const serialized = sessionStorage.getItem(this.userKey);
      return serialized ? JSON.parse(serialized) as User : null;
    } catch {
      return null;
    }
  }
}
