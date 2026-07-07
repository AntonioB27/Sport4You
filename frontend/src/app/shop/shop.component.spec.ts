import { ShopComponent } from './shop.component';

describe('ShopComponent mobile segment', () => {
  let component: ShopComponent;

  beforeEach(() => {
    component = new ShopComponent({} as any, {} as any, {} as any);
  });

  it('defaults to the boosters segment', () => {
    expect(component.activeSegment).toBe('boosters');
  });

  it('switches segments', () => {
    component.setSegment('avatars');
    expect(component.activeSegment).toBe('avatars');
    component.setSegment('boxes');
    expect(component.activeSegment).toBe('boxes');
    component.setSegment('boosters');
    expect(component.activeSegment).toBe('boosters');
  });
});
