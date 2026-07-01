import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RegisterDialogComponent } from './shared/components/register-dialog/register-dialog.component';
import { LogActivityDialogComponent } from './shared/components/log-activity-dialog/log-activity-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar color="primary">
      <span style="font-weight: 700; letter-spacing: 1px;">Sport4You 🏆</span>
      <span style="flex: 1"></span>
      <button mat-button routerLink="/leaderboard">Leaderboard</button>
      <button mat-button routerLink="/dashboard">My Dashboard</button>
      <button
        mat-stroked-button
        (click)="openLogActivity()"
        style="margin-left: 8px; color: white; border-color: rgba(255,255,255,0.5);"
      >
        + Log Activity
      </button>
    </mat-toolbar>
    <router-outlet />
  `,
})
export class AppComponent implements OnInit {
  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    if (!localStorage.getItem('userId')) {
      this.dialog.open(RegisterDialogComponent, { disableClose: true, width: '400px' });
    }
  }

  openLogActivity() {
    this.dialog.open(LogActivityDialogComponent, { width: '480px' });
  }
}
