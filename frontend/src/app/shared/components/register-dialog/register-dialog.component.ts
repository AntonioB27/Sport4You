import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-register-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ mode === 'register' ? 'Welcome to Sport4You 🏃' : 'Welcome back 👋' }}</h2>
    <mat-dialog-content>
      <p style="color: #666; margin-bottom: 16px;">
        {{ mode === 'register'
          ? 'Enter your name to join the fitness challenge and start competing on the leaderboard.'
          : 'Enter the name you registered with to recover your account.' }}
      </p>
      <form [formGroup]="form" style="display: flex; flex-direction: column; gap: 8px;">
        <mat-form-field appearance="outline">
          <mat-label>First Name</mat-label>
          <input matInput formControlName="firstName" placeholder="e.g. Alice" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Last Name</mat-label>
          <input matInput formControlName="lastName" placeholder="e.g. Smith" />
        </mat-form-field>
      </form>
      <a style="font-size: 13px; color: #2E6BE6; cursor: pointer;" (click)="toggleMode()">
        {{ mode === 'register' ? 'Already have an account? Log back in' : 'New here? Create an account' }}
      </a>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-raised-button
        color="primary"
        [disabled]="form.invalid || loading"
        (click)="submit()"
      >
        {{ loading ? 'One moment…' : (mode === 'register' ? 'Join the Challenge' : 'Welcome back') }}
      </button>
    </mat-dialog-actions>
  `,
})
export class RegisterDialogComponent {
  form = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
  });
  loading = false;
  mode: 'register' | 'login' = 'register';

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<RegisterDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  toggleMode() {
    this.mode = this.mode === 'register' ? 'login' : 'register';
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const { firstName, lastName } = this.form.value;

    if (this.mode === 'register') {
      this.api.registerUser(firstName!, lastName!).subscribe({
        next: ({ userId }) => this.finish(userId),
        error: (err) => {
          this.loading = false;
          if (err.status === 409) {
            // rescue path: same name already registered — offer to log back in
            this.snackBar
              .open('That name is already registered.', "That's me — log in", { duration: 6000 })
              .onAction()
              .subscribe(() => { this.mode = 'login'; this.submit(); });
          } else {
            this.snackBar.open('Registration failed. Please try again.', 'OK', { duration: 4000 });
          }
        },
      });
    } else {
      this.api.loginUser(firstName!, lastName!).subscribe({
        next: ({ userId }) => this.finish(userId),
        error: (err) => {
          this.loading = false;
          const message = err.status === 404
            ? 'No user found with that name.'
            : 'Login failed. Please try again.';
          this.snackBar.open(message, 'OK', { duration: 4000 });
        },
      });
    }
  }

  private finish(userId: string) {
    localStorage.setItem('userId', userId);
    this.dialogRef.close(userId);
  }
}
