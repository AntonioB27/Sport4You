import { TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { StatsPanelComponent, densifyDaily } from './stats-panel.component';

describe('stats-panel helpers', () => {
  describe('densifyDaily', () => {
    const today = new Date('2026-07-07T12:00:00Z');

    it('returns exactly `days` entries ending at today (UTC), ascending', () => {
      const out = densifyDaily([], 14, today);
      expect(out.length).toBe(14);
      expect(out[0].date).toBe('2026-06-24');
      expect(out[13].date).toBe('2026-07-07');
    });

    it('zero-fills days with no activity', () => {
      const out = densifyDaily([{ date: '2026-07-05', points: 300 }], 14, today);
      const jul5 = out.find(d => d.date === '2026-07-05')!;
      const jul4 = out.find(d => d.date === '2026-07-04')!;
      expect(jul5.points).toBe(300);
      expect(jul4.points).toBe(0);
    });

    it('drops points that fall outside the window', () => {
      const out = densifyDaily([{ date: '2026-06-01', points: 999 }], 14, today);
      expect(out.some(d => d.points === 999)).toBe(false);
    });
  });
});

describe('StatsPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsPanelComponent],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();
  });

  it('renders empty state when both series are empty without throwing', () => {
    const fixture = TestBed.createComponent(StatsPanelComponent);
    fixture.componentRef.setInput('sportBreakdown', []);
    fixture.componentRef.setInput('pointsOverTime', []);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.hasBreakdown).toBe(false);
    expect(fixture.componentInstance.hasVolume).toBe(false);
  });

  it('flags breakdown and builds the 14-day bar data when populated', () => {
    const fixture = TestBed.createComponent(StatsPanelComponent);
    fixture.componentRef.setInput('sportBreakdown', [{ sport: 'running', points: 200 }]);
    fixture.componentRef.setInput('pointsOverTime', [{ date: '2026-07-05', points: 300 }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.hasBreakdown).toBe(true);
    expect(fixture.componentInstance.barData.datasets[0].data.length).toBe(14);
  });
});
