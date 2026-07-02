import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { XpInfo } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class UserStateService {
  private xpSubject = new BehaviorSubject<XpInfo | null>(null);
  readonly xp$ = this.xpSubject.asObservable();

  setXp(xp: XpInfo): void {
    this.xpSubject.next(xp);
  }
}
