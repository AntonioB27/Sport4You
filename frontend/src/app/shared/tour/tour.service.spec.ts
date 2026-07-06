import { TestBed } from '@angular/core/testing';
import { TourService, TOUR_PENDING_KEY } from './tour.service';

describe('TourService', () => {
  let svc: TourService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(TourService);
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it('is inactive until started', () => {
    expect(svc.activeStep()).toBeNull();
  });

  it('start() activates the first step', () => {
    svc.start();
    const a = svc.activeStep();
    expect(a?.index).toBe(0);
    expect(a?.isFirst).toBeTrue();
    expect(a!.total).toBeGreaterThan(1);
  });

  it('next() advances through steps', () => {
    svc.start();
    svc.next();
    expect(svc.activeStep()?.index).toBe(1);
  });

  it('back() is a no-op on the first step', () => {
    svc.start();
    svc.back();
    expect(svc.activeStep()?.index).toBe(0);
  });

  it('next() on the last step runs onComplete and ends the tour', () => {
    const spy = jasmine.createSpy('onComplete');
    svc.start(spy);
    const total = svc.activeStep()!.total;
    for (let i = 0; i < total - 1; i++) svc.next(); // reach last step
    expect(svc.activeStep()?.isLast).toBeTrue();
    svc.next(); // advance past last
    expect(svc.activeStep()).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('skip() ends the tour without calling onComplete', () => {
    const spy = jasmine.createSpy('onComplete');
    svc.start(spy);
    svc.skip();
    expect(svc.activeStep()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('consumePending() returns true once and clears the flag', () => {
    localStorage.setItem(TOUR_PENDING_KEY, '1');
    expect(svc.consumePending()).toBeTrue();
    expect(svc.consumePending()).toBeFalse();
    expect(localStorage.getItem(TOUR_PENDING_KEY)).toBeNull();
  });
});
