import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  name = '';
  password = '';
  confirmPassword = '';
  isSignup = false;
  error = '';
  loading = false;

  get passwordsDoNotMatch(): boolean {
    return this.isSignup
      && this.confirmPassword.length > 0
      && this.password !== this.confirmPassword;
  }

  signIn(): void {
    this.error = '';
    this.loading = true;
    this.auth.signIn(this.email.trim(), this.password).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (error: HttpErrorResponse) => {
        this.error = error.error?.message ?? 'Unable to sign in. Check that the API is running.';
        this.loading = false;
      },
      complete: () => this.loading = false
    });
  }

  signUp(): void {
    this.error = '';
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.auth.signUp(this.name.trim(), this.email.trim(), this.password).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (error: HttpErrorResponse) => {
        this.error = error.error?.message ?? 'Unable to create your account. Please try again.';
        this.loading = false;
      },
      complete: () => this.loading = false
    });
  }

  toggleMode(): void {
    this.isSignup = !this.isSignup;
    this.error = '';
    this.password = '';
    this.confirmPassword = '';
  }
}
