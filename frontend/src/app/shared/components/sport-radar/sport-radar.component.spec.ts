import { TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { SportRadarComponent, radarValues, formatSport } from './sport-radar.component';

describe('sport-radar helpers', () => {
  describe('radarValues', () => {
    const order = ['running', 'walking', 'cycling', 'swimming', 'gym', 'daily_steps'];

    it('aligns points to the fixed axis order, zero-filling missing sports', () => {
      const out = radarValues([
        { sport: 'cycling', points: 400 },
        { sport: 'running', points: 100 },
      ], order);
      expect(out).toEqual([100, 0, 400, 0, 0, 0]);
    });

    it('returns one value per axis regardless of input size', () => {
      expect(radarValues([], order).length).toBe(order.length);
    });
  });

  describe('formatSport', () => {
    it('title-cases and de-underscores', () => {
      expect(formatSport('running')).toBe('Running');
      expect(formatSport('daily_steps')).toBe('Daily Steps');
    });
  });
});

describe('SportRadarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SportRadarComponent],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();
  });

  it('shows the empty state when there is no sport data, without throwing', () => {
    const fixture = TestBed.createComponent(SportRadarComponent);
    fixture.componentRef.setInput('sportBreakdown', []);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.hasData).toBe(false);
  });

  it('builds radar data over all 6 fixed axes when populated', () => {
    const fixture = TestBed.createComponent(SportRadarComponent);
    fixture.componentRef.setInput('sportBreakdown', [{ sport: 'running', points: 200 }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.hasData).toBe(true);
    // running is axis 0; the other five axes zero-fill
    expect(fixture.componentInstance.radarData.datasets[0].data).toEqual([200, 0, 0, 0, 0, 0]);
  });
});
