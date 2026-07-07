import { AvatarLockerComponent } from './avatar-locker.component';
import { AvatarStatus } from '../shared/models/dashboard.model';

function makeAvatars(): AvatarStatus[] {
  return [
    { id: 'a1', name: 'Starter Sporty', description: 'Default', imagePath: 'a1.png',
      unlockType: 'default', unlockValue: 0, unlocked: true, unlockedAt: '2026-01-01', isActive: true },
    { id: 'a2', name: 'Athletic Sporty', description: 'Reach level 10', imagePath: 'a2.png',
      unlockType: 'level_reached', unlockValue: 10, unlocked: true, unlockedAt: '2026-02-01', isActive: false },
    { id: 'a3', name: 'Elite Sporty', description: 'Reach level 20', imagePath: 'a3.png',
      unlockType: 'level_reached', unlockValue: 20, unlocked: false, unlockedAt: null, isActive: false },
  ];
}

describe('AvatarLockerComponent mobile grouping', () => {
  let component: AvatarLockerComponent;

  beforeEach(() => {
    component = new AvatarLockerComponent();
    component.avatars = makeAvatars();
  });

  it('shows every non-empty group by default', () => {
    expect(component.activeGroup).toBeNull();
    expect(component.mobileSections.map(s => s.label)).toEqual(['STARTER', 'LEVEL UP']);
  });

  it('filters to a single group when set', () => {
    component.setGroup('LEVEL UP');
    expect(component.mobileSections.map(s => s.label)).toEqual(['LEVEL UP']);
    expect(component.mobileSections[0].items.map(a => a.id)).toEqual(['a2', 'a3']);
  });

  it('toggles a group off when clicked twice', () => {
    component.setGroup('LEVEL UP');
    component.setGroup('LEVEL UP');
    expect(component.activeGroup).toBeNull();
  });
});
