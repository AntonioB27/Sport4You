import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { UnlockSplashComponent } from './unlock-splash.component';
import { UnlockedAchievement, UnlockedAvatar } from '../../models/dashboard.model';

export interface UnlockSplashDialogData {
  achievements: UnlockedAchievement[];
  avatars: UnlockedAvatar[];
}

/**
 * MatDialog host for <app-unlock-splash>. The splash itself is `position: absolute;
 * inset: 0` and expects a sized, positioned ancestor to fill — a dialog panel (like
 * this one) provides that; embedding the splash directly inside a small inline widget
 * does not.
 */
@Component({
  selector: 'app-unlock-splash-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, UnlockSplashComponent],
  styles: [`
    .shell {
      position: relative; width: 400px; max-width: 92vw; min-height: 540px;
      border-radius: 34px; overflow: hidden; background: #0e1a34;
    }
  `],
  template: `
    <div class="shell">
      <app-unlock-splash
        [achievements]="data.achievements"
        [avatars]="data.avatars"
        (finished)="close()"></app-unlock-splash>
    </div>
  `,
})
export class UnlockSplashDialogComponent {
  constructor(
    private ref: MatDialogRef<UnlockSplashDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UnlockSplashDialogData,
  ) {}

  close(): void {
    this.ref.close();
  }
}
