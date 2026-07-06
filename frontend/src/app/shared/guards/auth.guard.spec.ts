import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const run: CanActivateFn = (...args) =>
    TestBed.runInInjectionContext(() => authGuard(...args));

  const noop = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  afterEach(() => localStorage.clear());

  it('blocks activation when no userId is stored', () => {
    localStorage.removeItem('userId');
    expect(run(noop, state)).toBe(false);
  });

  it('allows activation once a userId is stored', () => {
    localStorage.setItem('userId', '11111111-1111-1111-1111-111111111111');
    expect(run(noop, state)).toBe(true);
  });
});
