import { AchievementsComponent, ONE_TIME_LABEL } from './achievements.component';
import { AchievementStatus } from '../shared/models/dashboard.model';

function makeAchievements(): AchievementStatus[] {
  return [
    { id: 'run-b', tier: 'bronze', name: 'First Strides', description: 'Run 10km', xpReward: 50,
      requirementType: 'total_km', unlocked: true, unlockedAt: '2026-06-01', sport: 'running',
      requirementValue: 10, progress: 32, ownedByPercent: 80 },
    { id: 'run-g', tier: 'gold', name: 'Marathoner', description: 'Run 100km', xpReward: 300,
      requirementType: 'total_km', unlocked: false, unlockedAt: null, sport: 'running',
      requirementValue: 100, progress: 32, ownedByPercent: 5 },
    { id: 'steps-b', tier: 'bronze', name: 'First Steps', description: '10k steps', xpReward: 50,
      requirementType: 'total_steps', unlocked: true, unlockedAt: '2026-06-02', sport: null,
      requirementValue: 10000, progress: 12000, ownedByPercent: 70 },
    { id: 'first-activity', tier: 'bronze', name: 'Getting Started', description: 'Log your first activity',
      xpReward: 20, requirementType: 'first_activity', unlocked: true, unlockedAt: '2026-05-01',
      sport: null, requirementValue: 1, progress: 1, ownedByPercent: 99 },
  ];
}

describe('AchievementsComponent mobile filtering', () => {
  let component: AchievementsComponent;

  beforeEach(() => {
    component = new AchievementsComponent({} as any);
    component.achievements = makeAchievements();
  });

  it('defaults to all tiers and all categories', () => {
    expect(component.activeTier).toBe('all');
    expect(component.activeCategory).toBeNull();
    expect(component.mobileFiltered.map(a => a.id).sort()).toEqual(
      ['first-activity', 'run-b', 'run-g', 'steps-b']
    );
  });

  it('filters to the matching section when a category chip is set', () => {
    component.setCategory('Sport Distance Milestones');
    expect(component.mobileFiltered.map(a => a.id).sort()).toEqual(['run-b', 'run-g']);
  });

  it('filters to one-time feats via the sentinel category', () => {
    component.setCategory(ONE_TIME_LABEL);
    expect(component.mobileFiltered.map(a => a.id)).toEqual(['first-activity']);
  });

  it('combines category and tier filters', () => {
    component.setCategory('Sport Distance Milestones');
    component.setTier('gold');
    expect(component.mobileFiltered.map(a => a.id)).toEqual(['run-g']);
  });

  it('toggles a category off when clicked twice', () => {
    component.setCategory('Sport Distance Milestones');
    component.setCategory('Sport Distance Milestones');
    expect(component.activeCategory).toBeNull();
  });

  it('lists section labels plus the one-time sentinel', () => {
    expect(component.mobileCategories).toContain('Sport Distance Milestones');
    expect(component.mobileCategories).toContain(ONE_TIME_LABEL);
  });
});
