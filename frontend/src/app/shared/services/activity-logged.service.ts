import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActivityLoggedService {
  readonly activityLogged$ = new Subject<void>();

  notify() {
    this.activityLogged$.next();
  }
}
