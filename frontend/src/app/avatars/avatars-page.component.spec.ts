import { AvatarsPageComponent } from './avatars-page.component';
import { AvatarStatus } from '../shared/models/dashboard.model';

describe('AvatarsPageComponent mobile view toggle', () => {
  let component: AvatarsPageComponent;

  beforeEach(() => {
    component = new AvatarsPageComponent({} as any, {} as any);
  });

  it('defaults to the avatars view', () => {
    expect(component.activeView).toBe('avatars');
  });

  it('switches to borders and back', () => {
    component.setView('borders');
    expect(component.activeView).toBe('borders');
    component.setView('avatars');
    expect(component.activeView).toBe('avatars');
  });

  it('exposes the currently equipped avatar', () => {
    const active: AvatarStatus = {
      id: 'a1', name: 'Starter Sporty', description: 'Default', imagePath: 'a1.png',
      unlockType: 'default', unlockValue: 0, unlocked: true, unlockedAt: '2026-01-01', isActive: true,
    };
    component.avatars = [active];
    expect(component.equippedAvatar).toEqual(active);
  });

  it('returns null when no avatar is equipped', () => {
    component.avatars = [];
    expect(component.equippedAvatar).toBeNull();
  });
});
