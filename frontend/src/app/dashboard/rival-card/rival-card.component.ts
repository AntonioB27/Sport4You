import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RivalStatus } from '../../shared/models/dashboard.model';

@Component({
  selector: 'app-rival-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [`
    :host { display: block; }
    .card { background: #fff; border-radius: 18px; padding: 18px 20px; box-shadow: 0 12px 26px -16px rgba(16,32,62,.35); }
    .title { font-family: 'Chakra Petch', sans-serif; font-size: 16px; font-weight: 700; color: #10203E; letter-spacing: .04em; margin-bottom: 14px; }

    .empty { text-align: center; padding: 14px 0; }
    .empty-text { font-size: 13px; color: #8592ad; margin-bottom: 10px; }
    .empty-link {
      display: inline-block; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 12px;
      color: #2E6BE6; background: #EAF1FF; padding: 8px 16px; border-radius: 10px; text-decoration: none;
    }

    .vs-row { display: flex; align-items: center; justify-content: center; gap: 16px; }
    .side { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 84px; }
    .side-av, .side-initial {
      width: 56px; height: 56px; border-radius: 50%; object-fit: cover;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 20px; color: #fff; background: #2E6BE6;
    }
    .side-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 12px; color: #10203E; text-align: center; }
    .vs-chip {
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 12px; letter-spacing: .06em;
      color: #8592ad; background: #F4F6FB; border-radius: 999px; padding: 4px 10px;
    }

    .gap-row { text-align: center; margin-top: 14px; }
    .gap-val { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; }
    .gap-val.ahead { color: #4CAF50; }
    .gap-val.behind { color: #f44336; }
    .gap-sub { font-size: 11px; color: #8592ad; margin-top: 2px; }

    .bar-track { height: 8px; border-radius: 999px; background: #EAEEF6; margin-top: 10px; overflow: hidden; display: flex; }
    .bar-me { background: #2E6BE6; }
    .bar-rival { background: #d0d7e6; }
  `],
  template: `
    <div class="card">
      <div class="title">RIVAL</div>
      @if (!rivalStatus) {
        <div class="empty">
          <div class="empty-text">Pick a rival to track head-to-head.</div>
          <a class="empty-link" routerLink="/leaderboard">CHOOSE ON LEADERBOARD</a>
        </div>
      } @else {
        <div class="vs-row">
          <div class="side">
            @if (myAvatarImagePath) {
              <img class="side-av" [style.border]="myBorderCss ?? 'none'" [src]="myAvatarImagePath" alt="">
            } @else {
              <span class="side-initial">{{ myFirstName[0] }}</span>
            }
            <div class="side-name">{{ myFirstName }} (You)</div>
          </div>
          <div class="vs-chip">VS</div>
          <div class="side">
            @if (rivalStatus.imagePath) {
              <img class="side-av" [style.border]="rivalStatus.borderCss ?? 'none'" [src]="rivalStatus.imagePath" alt="">
            } @else {
              <span class="side-initial">{{ rivalStatus.firstName[0] }}</span>
            }
            <div class="side-name">{{ rivalStatus.firstName }}</div>
          </div>
        </div>
        <div class="gap-row">
          @if (rivalStatus.imAhead) {
            <div class="gap-val ahead">+{{ rivalStatus.pointsGap | number }} pts ahead</div>
          } @else if (rivalStatus.pointsGap === 0) {
            <div class="gap-val">Tied</div>
          } @else {
            <div class="gap-val behind">{{ rivalStatus.pointsGap * -1 | number }} pts behind</div>
          }
          <div class="gap-sub">{{ rivalStatus.myPoints | number }} vs {{ rivalStatus.rivalPoints | number }}</div>
        </div>
        <div class="bar-track">
          <div class="bar-me" [style.width.%]="mySharePercent"></div>
          <div class="bar-rival" [style.width.%]="100 - mySharePercent"></div>
        </div>
      }
    </div>
  `,
})
export class RivalCardComponent {
  @Input() rivalStatus: RivalStatus | null = null;
  @Input() myFirstName = '';
  @Input() myAvatarImagePath: string | null = null;
  @Input() myBorderCss: string | null = null;

  get mySharePercent(): number {
    if (!this.rivalStatus) return 50;
    const total = this.rivalStatus.myPoints + this.rivalStatus.rivalPoints;
    if (total <= 0) return 50;
    return Math.round((this.rivalStatus.myPoints / total) * 100);
  }
}
