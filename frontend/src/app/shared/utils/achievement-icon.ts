export function achievementIconPath(a: { tier: string; name: string }): string {
  const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  return `assets/achievements/${a.tier}-${slug}.png`;
}
