import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-register-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatSnackBarModule],
  styles: [`
    @keyframes floaty { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-8px) rotate(2deg); } }

    :host { display: block; font-family: 'Nunito', system-ui, sans-serif; }

    .card {
      width: 380px; max-width: 90vw; background: #fff; border-radius: 24px;
      overflow: hidden; box-shadow: 0 40px 80px -24px rgba(10,20,44,.5);
    }

    /* ── Hero band ── */
    .hero-band {
      position: relative; padding: 26px 24px 20px; text-align: center;
      background: linear-gradient(150deg, #2E6BE6, #173B92);
    }
    .mascot { width: 76px; height: 76px; object-fit: contain; animation: floaty 4s ease-in-out infinite; filter: drop-shadow(0 10px 14px rgba(0,0,0,.3)); }
    .brand { margin-top: 6px; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .12em; color: #fff; }
    .brand span { color: #C6E63B; }

    /* ── Body ── */
    .body { padding: 24px 24px 26px; }
    .title { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 21px; color: #10203E; margin: 0 0 6px; text-align: center; }
    .subtitle { font-size: 13px; color: #8592ad; text-align: center; margin: 0 0 20px; line-height: 1.5; }

    .field { margin-bottom: 12px; }
    .field label {
      display: block; font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700;
      letter-spacing: .12em; color: #8592ad; margin-bottom: 6px;
    }
    .field input {
      width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px;
      border: 1px solid #E3EAF5; background: #F9FBFF; font-family: 'Nunito', sans-serif; font-size: 14px;
      color: #10203E; outline: none; transition: border-color .15s, background .15s;
    }
    .field input:focus { border-color: #2E6BE6; background: #fff; }
    .field input::placeholder { color: #b0bcd4; }

    .cta {
      width: 100%; margin-top: 8px; border: none; cursor: pointer;
      background: linear-gradient(150deg, #C6E63B, #9ECF10); color: #10203E;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; letter-spacing: .04em;
      padding: 13px; border-radius: 13px; box-shadow: 0 5px 0 #7c9c00, 0 10px 20px -10px rgba(158,207,16,.7);
      transition: transform .1s, box-shadow .1s;
    }
    .cta:hover:not(:disabled) { transform: translateY(-1px); }
    .cta:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 3px 0 #7c9c00; }
    .cta:disabled { opacity: .5; cursor: not-allowed; }

    .toggle-link {
      display: block; text-align: center; margin-top: 16px;
      font-size: 12.5px; color: #2E6BE6; font-weight: 700; cursor: pointer;
    }
  `],
  template: `
    <div class="card">
      <div class="hero-band">
        <img class="mascot" src="assets/sporty_wave.png" alt="Spotry">
        <div class="brand">SPORT<span>4</span>YOU</div>
      </div>
      <div class="body">
        <h2 class="title">{{ mode === 'register' ? 'Welcome!' : 'Welcome back' }}</h2>
        <p class="subtitle">
          {{ mode === 'register'
            ? 'Enter your name to join the fitness challenge and start competing on the leaderboard.'
            : 'Enter the name you registered with to recover your account.' }}
        </p>
        <form [formGroup]="form">
          <div class="field">
            <label>FIRST NAME</label>
            <input formControlName="firstName" placeholder="e.g. Alice" (keyup.enter)="submit()">
          </div>
          <div class="field">
            <label>LAST NAME</label>
            <input formControlName="lastName" placeholder="e.g. Smith" (keyup.enter)="submit()">
          </div>
        </form>
        <button class="cta" [disabled]="form.invalid || loading" (click)="submit()">
          {{ loading ? 'One moment…' : (mode === 'register' ? 'Join the Challenge' : 'Welcome back') }}
        </button>
        <a class="toggle-link" (click)="toggleMode()">
          {{ mode === 'register' ? 'Already have an account? Log back in' : 'New here? Create an account' }}
        </a>
      </div>
    </div>
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
