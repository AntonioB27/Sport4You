import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TodayStepsCardComponent } from './today-steps-card.component';

describe('TodayStepsCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TodayStepsCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('syncs displaySteps from the todaySteps input on load without throwing NG0600', () => {
    const fixture = TestBed.createComponent(TodayStepsCardComponent);
    fixture.componentRef.setInput('todaySteps', 4200);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.displaySteps()).toBe(4200);
  });
});
