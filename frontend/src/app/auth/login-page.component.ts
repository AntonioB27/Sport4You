import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  styles: [`
    :host {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; width: 100%;
      background: radial-gradient(120% 100% at 50% 0%, #16295a 0%, #0f1e3b 55%, #0a1530 100%);
      font-family: 'Nunito', system-ui, sans-serif;
      padding: 24px; box-sizing: border-box;
    }

    .panel {
      width: 100%; max-width: 420px;
      background: linear-gradient(160deg, rgba(255,255,255,.06), rgba(255,255,255,.02)), #142547;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 24px;
      padding: 36px 32px 28px;
      box-shadow: 0 30px 60px -20px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.03) inset;
      position: relative;
      overflow: hidden;
    }
    .panel::before {
      content: ''; position: absolute; top: -60px; right: -60px; width: 200px; height: 200px;
      background: radial-gradient(circle, rgba(198,230,59,.25), transparent 70%);
      pointer-events: none;
    }

    .brand { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 8px; }
    .brand img { width: 72px; height: 84px; object-fit: contain; filter: drop-shadow(0 8px 16px rgba(0,0,0,.4)); }
    .brand-title { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 22px; color: #fff; letter-spacing: .5px; }
    .brand-title span { color: #C6E63B; }

    .headline {
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px;
      color: #fff; text-align: center; margin: 18px 0 4px;
    }
    .subline { text-align: center; color: #93a2c4; font-size: 13px; margin-bottom: 22px; }

    form { display: flex; flex-direction: column; gap: 14px; }

    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label {
      font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700;
      letter-spacing: .1em; color: #7d8bab; text-transform: uppercase;
    }
    .field input {
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12);
      border-radius: 12px; padding: 12px 14px; color: #fff; font-size: 14px;
      font-family: 'Nunito', sans-serif; outline: none; transition: border-color .15s, background .15s;
    }
    .field input::placeholder { color: #56628a; }
    .field input:focus { border-color: #C6E63B; background: rgba(255,255,255,.07); }

    .name-row { display: flex; gap: 10px; }
    .name-row .field { flex: 1; }

    .error-banner {
      background: rgba(255,86,86,.12); border: 1px solid rgba(255,86,86,.35);
      color: #ff9d9d; font-size: 13px; border-radius: 10px; padding: 10px 14px; margin-bottom: 4px;
      text-align: center;
    }

    .submit-btn {
      margin-top: 6px;
      background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .04em;
      padding: 14px; border-radius: 14px; border: none; cursor: pointer;
      box-shadow: 0 0 18px rgba(198,230,59,.5), 0 4px 0 #7c9c00;
      transition: transform .1s, box-shadow .1s;
    }
    .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 0 22px rgba(198,230,59,.7), 0 5px 0 #7c9c00; }
    .submit-btn:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 0 14px rgba(198,230,59,.4), 0 2px 0 #7c9c00; }
    .submit-btn:disabled { opacity: .5; cursor: not-allowed; }

    .toggle-link {
      text-align: center; margin-top: 18px; font-size: 13px; color: #93a2c4;
    }
    .toggle-link a { color: #C6E63B; font-weight: 700; cursor: pointer; text-decoration: none; }
    .toggle-link a:hover { text-decoration: underline; }
  `],
  template: `
    <div class="panel">
      <div class="brand">
        <img src="assets/sporty_wave.png" alt="Spotry" />
        <div class="brand-title">SPORT<span>4</span>YOU</div>
      </div>

      <div class="headline">{{ mode === 'login' ? 'Welcome back' : 'Join the Challenge' }}</div>
      <div class="subline">
        {{ mode === 'login' ? 'Log in to keep your streak alive.' : 'Create an account to start earning points.' }}
      </div>

      @if (errorMessage) {
        <div class="error-banner">{{ errorMessage }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        @if (mode === 'register') {
          <div class="name-row">
            <div class="field">
              <label>First Name</label>
              <input formControlName="firstName" placeholder="Alice" />
            </div>
            <div class="field">
              <label>Last Name</label>
              <input formControlName="lastName" placeholder="Smith" />
            </div>
          </div>
        }

        <div class="field">
          <label>Username</label>
          <input formControlName="username" placeholder="e.g. alice" autocomplete="username" />
        </div>

        <div class="field">
          <label>Password</label>
          <input type="password" formControlName="password" placeholder="••••••••" autocomplete="current-password" />
        </div>

        <button type="submit" class="submit-btn" [disabled]="form.invalid || loading">
          {{ loading ? 'One moment…' : (mode === 'login' ? 'Log In' : 'Create Account') }}
        </button>
      </form>

      <div class="toggle-link">
        {{ mode === 'login' ? "New here?" : 'Already have an account?' }}
        <a (click)="toggleMode()">{{ mode === 'login' ? 'Create one' : 'Log in' }}</a>
      </div>
    </div>
  `,
})
export class LoginPageComponent {
  mode: 'login' | 'register' = 'login';
  loading = false;
  errorMessage = '';

  form = new FormGroup({
    firstName: new FormControl(''),
    lastName: new FormControl(''),
    username: new FormControl('', [Validators.required, Validators.minLength(3)]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  constructor(private auth: AuthService, private router: Router) {}

  toggleMode() {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.errorMessage = '';
    const firstName = this.form.get('firstName')!;
    const lastName = this.form.get('lastName')!;
    if (this.mode === 'register') {
      firstName.setValidators([Validators.required]);
      lastName.setValidators([Validators.required]);
    } else {
      firstName.clearValidators();
      lastName.clearValidators();
    }
    firstName.updateValueAndValidity();
    lastName.updateValueAndValidity();
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    const { firstName, lastName, username, password } = this.form.value;

    const request$ = this.mode === 'login'
      ? this.auth.login(username!, password!)
      : this.auth.register(firstName!, lastName!, username!, password!);

    request$.subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.error
          ?? (this.mode === 'register' ? 'Registration failed. Please try again.' : 'Login failed. Please try again.');
      },
    });
  }
}
