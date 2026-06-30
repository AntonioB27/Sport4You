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
    <h2 mat-dialog-title>Welcome to Sport4You 🏃</h2>
    <mat-dialog-content>
      <p style="color: #666; margin-bottom: 16px;">
        Enter your name to join the fitness challenge and start competing on the leaderboard.
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
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-raised-button
        color="primary"
        [disabled]="form.invalid || loading"
        (click)="register()"
      >
        {{ loading ? 'Joining...' : 'Join the Challenge' }}
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

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<RegisterDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  register() {
    if (this.form.invalid) return;
    this.loading = true;
    const { firstName, lastName } = this.form.value;
    this.api.registerUser(firstName!, lastName!).subscribe({
      next: ({ userId }) => {
        localStorage.setItem('userId', userId);
        this.dialogRef.close(userId);
      },
      error: (err) => {
        this.loading = false;
        const message = err.status === 409
          ? 'That name is already taken — try a different one'
          : 'Registration failed. Please try again.';
        this.snackBar.open(message, 'OK', { duration: 4000 });
      },
    });
  }
}
