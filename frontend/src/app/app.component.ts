import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, AsyncPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { RegisterDialogComponent } from './shared/components/register-dialog/register-dialog.component';
import { LogActivityDialogComponent } from './shared/components/log-activity-dialog/log-activity-dialog.component';
import { UserStateService } from './shared/services/user-state.service';
import { IconComponent } from './shared/components/icon/icon.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AsyncPipe, IconComponent],
  styles: [`
    :host { display: flex; min-height: 100vh; background: #EEF3FB; font-family: 'Nunito', system-ui, sans-serif; }

    .sidebar {
      width: 230px; background: #fff; border-right: 1px solid #E3EAF5;
      padding: 22px 16px; display: flex; flex-direction: column;
      position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
    }
    .logo { display: flex; align-items: center; gap: 10px; padding: 0 8px 20px; }
    .logo img { width: 34px; height: 40px; object-fit: contain; }
    .logo-text { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; color: #10203E; letter-spacing: .3px; }
    .logo-text span { color: #2E6BE6; }

    .nav-items { display: flex; flex-direction: column; gap: 6px; }
    .nav-item {
      display: flex; align-items: center; gap: 12px; padding: 11px 14px;
      border-radius: 12px; color: #5c6881;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px;
      text-decoration: none; transition: background .15s;
    }
    .nav-item:hover { background: #F4F6FB; }
    .nav-item.active { background: linear-gradient(150deg,#2E6BE6,#1B47AE); color: #fff; box-shadow: 0 10px 20px -10px rgba(46,107,230,.7); }

    .xp-widget { margin-top: auto; border-radius: 16px; padding: 16px; background: radial-gradient(120% 80% at 80% 0%, rgba(198,230,59,.35), transparent), #F4FBE3; border: 1px solid rgba(158,207,16,.5); text-align: center; }
    .xp-label { font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; color: #5f7a00; }
    .xp-value { font-family: 'Chakra Petch', sans-serif; font-size: 26px; font-weight: 700; color: #10203E; }
    .xp-bar { height: 8px; border-radius: 999px; background: #e4eecb; margin-top: 8px; overflow: hidden; }
    .xp-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg,#8CE00E,#C6E63B); box-shadow: 0 0 10px rgba(198,230,59,.9); }

    .log-btn {
      margin-top: 14px; text-align: center;
      background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; letter-spacing: .05em;
      padding: 13px; border-radius: 14px; box-shadow: 0 0 18px rgba(198,230,59,.5), 0 4px 0 #7c9c00;
      cursor: pointer; border: none; width: 100%; transition: transform .1s, box-shadow .1s;
    }
    .log-btn:hover { transform: translateY(-1px); box-shadow: 0 0 22px rgba(198,230,59,.7), 0 5px 0 #7c9c00; }
    .log-btn:active { transform: translateY(1px); box-shadow: 0 0 14px rgba(198,230,59,.4), 0 2px 0 #7c9c00; }

    .sidebar-gap { width: 230px; flex-shrink: 0; }
    .main-content { flex: 1; min-height: 100vh; min-width: 0; overflow-x: hidden; }

    .bottom-nav {
      display: none; position: fixed; bottom: 0; left: 0; right: 0;
      background: #fff; border-top: 1px solid #E3EAF5;
      padding: 10px 8px 20px; justify-content: space-between; align-items: center; gap: 8px; z-index: 100;
    }
    .nav-side { flex: 1 1 0; min-width: 0; display: flex; justify-content: space-around; align-items: center; gap: 4px; }
    .bottom-nav-item {
      display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1 1 0; min-width: 0;
      color: #9aa6bd; font-family: 'Chakra Petch', sans-serif; font-weight: 700;
      font-size: 10px; letter-spacing: .05em; text-decoration: none; transition: color .15s; white-space: nowrap;
    }
    .bottom-nav-item.active { color: #2E6BE6; }
    .bottom-fab {
      width: 52px; height: 52px; margin-top: -28px; border-radius: 16px;
      background: linear-gradient(150deg,#C6E63B,#9ECF10); box-shadow: 0 0 22px rgba(158,207,16,.7);
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; color: #10203E; font-weight: 800; border: none; cursor: pointer;
    }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .sidebar-gap { display: none; }
      .main-content { padding-bottom: 80px; }
      .bottom-nav { display: flex; }
    }
  `],
  template: `
    <aside class="sidebar">
      <div class="logo">
        <img src="assets/sporty_wave.png" alt="Spotry" />
        <div class="logo-text">SPORT<span>4</span>YOU</div>
      </div>
      <nav class="nav-items">
        <a class="nav-item" routerLink="/dashboard" routerLinkActive="active">
          <app-icon name="house" [size]="18" /> HOME
        </a>
        <a class="nav-item" routerLink="/leaderboard" routerLinkActive="active">
          <app-icon name="trophy" [size]="18" /> LEADERBOARD
        </a>
        <a routerLink="/achievements" routerLinkActive="active" class="nav-item">
          <app-icon name="medal" [size]="18" /> BADGES
        </a>
        <a class="nav-item" routerLink="/shop" routerLinkActive="active">
          <app-icon name="coin" [size]="18" /> SHOP
        </a>
        <a class="nav-item" routerLink="/avatars" routerLinkActive="active">
          <app-icon name="crown" [size]="18" /> AVATARS
        </a>
        <a class="nav-item" [routerLink]="profileRoute" routerLinkActive="active">
          <app-icon name="user" [size]="18" /> PROFILE
        </a>
      </nav>
      @if (userState.xp$ | async; as xp) {
        <div class="xp-widget">
          <div class="xp-label">NEXT LEVEL IN</div>
          <div class="xp-value">{{ xp.xpForNextLevel - xp.xpInLevel }} XP</div>
          <div class="xp-bar"><div class="xp-bar-fill" [style.width.%]="xp.xpPercent"></div></div>
        </div>
      } @else {
        <div class="xp-widget">
          <div class="xp-label">NEXT LEVEL IN</div>
          <div class="xp-value">— XP</div>
          <div class="xp-bar"><div class="xp-bar-fill" style="width: 0%"></div></div>
        </div>
      }
      <button class="log-btn" (click)="openLogActivity()">+ LOG ACTIVITY</button>
    </aside>

    <div class="sidebar-gap"></div>
    <div class="main-content">
      <router-outlet />
    </div>

    <nav class="bottom-nav">
      <div class="nav-side">
        <a class="bottom-nav-item" routerLink="/dashboard" routerLinkActive="active">
          <app-icon name="house" [size]="20" /> HOME
        </a>
        <a class="bottom-nav-item" routerLink="/leaderboard" routerLinkActive="active">
          <app-icon name="trophy" [size]="20" /> RANK
        </a>
        <a class="bottom-nav-item" routerLink="/achievements" routerLinkActive="active">
          <app-icon name="medal" [size]="20" /> BADGES
        </a>
      </div>
      <button class="bottom-fab" (click)="openLogActivity()">+</button>
      <div class="nav-side">
        <a class="bottom-nav-item" routerLink="/shop" routerLinkActive="active">
          <app-icon name="coin" [size]="20" /> SHOP
        </a>
        <a class="bottom-nav-item" routerLink="/avatars" routerLinkActive="active">
          <app-icon name="crown" [size]="20" /> AVATARS
        </a>
        <a class="bottom-nav-item" [routerLink]="profileRoute" routerLinkActive="active">
          <app-icon name="user" [size]="20" /> PROFILE
        </a>
      </div>
    </nav>
  `,
})
export class AppComponent implements OnInit {
  constructor(
    private dialog: MatDialog,
    public userState: UserStateService,
  ) {}

  ngOnInit() {
    if (!localStorage.getItem('userId')) {
      this.dialog.open(RegisterDialogComponent, { disableClose: true, width: '400px', panelClass: 's4y-welcome-dialog' })
        .afterClosed().subscribe(userId => {
          // reload so every view picks up the new/recovered account
          if (userId) window.location.reload();
        });
    }
  }

  get profileRoute(): string[] {
    return ['/profile', localStorage.getItem('userId') ?? ''];
  }

  openLogActivity() {
    this.dialog.open(LogActivityDialogComponent, { width: '560px', maxWidth: '95vw', panelClass: 's4y-watch-dialog' });
  }
}
