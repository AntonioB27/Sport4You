import { Injectable, signal } from '@angular/core';
import { XpInfo } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class UserStateService {
  private readonly xpSignal = signal<XpInfo | null>(null);
  readonly xp = this.xpSignal.asReadonly();

  setXp(xp: XpInfo): void {
    this.xpSignal.set(xp);
  }
}
