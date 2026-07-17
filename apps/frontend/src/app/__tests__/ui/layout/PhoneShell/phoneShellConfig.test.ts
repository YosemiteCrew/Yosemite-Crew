import {
  PHONE_FAB_ACTIONS,
  PHONE_MORE_LINKS,
  PHONE_MORE_SECTIONS,
  PHONE_TABS,
  resolveFabAction,
} from '@/app/ui/layout/PhoneShell/phoneShellConfig';

describe('phoneShellConfig', () => {
  it('defines the five bottom-tab items in order with the More tab last', () => {
    expect(PHONE_TABS.map((tab) => tab.key)).toEqual([
      'home',
      'schedule',
      'patients',
      'chat',
      'more',
    ]);
    const more = PHONE_TABS.find((tab) => tab.key === 'more');
    expect(more?.isMore).toBe(true);
    expect(more?.href).toBeUndefined();
  });

  it('maps the primary tabs to real app routes and marks Chat as the badge tab', () => {
    const byKey = Object.fromEntries(PHONE_TABS.map((tab) => [tab.key, tab]));
    expect(byKey.home.href).toBe('/dashboard');
    expect(byKey.schedule.href).toBe('/appointments');
    expect(byKey.patients.href).toBe('/companions');
    expect(byKey.chat.href).toBe('/chat');
    expect(byKey.chat.hasBadge).toBe(true);
    expect(byKey.home.hasBadge).toBeUndefined();
  });

  it('resolves the FAB action only on the exact list route for that area', () => {
    expect(resolveFabAction('/appointments')?.key).toBe('appointment');
    expect(resolveFabAction('/tasks')?.key).toBe('task');
    expect(resolveFabAction('/companions')?.key).toBe('companion');
    expect(resolveFabAction('/inventory')?.key).toBe('product');
  });

  it('returns null for pages without a creation action (detail routes included)', () => {
    expect(resolveFabAction('/dashboard')).toBeNull();
    expect(resolveFabAction('/chat')).toBeNull();
    expect(resolveFabAction('/finance')).toBeNull();
    expect(resolveFabAction('/appointments/123')).toBeNull();
    expect(resolveFabAction('/companions/abc/history')).toBeNull();
  });

  it('exposes an aria-label and route name for every FAB action', () => {
    PHONE_FAB_ACTIONS.forEach((action) => {
      expect(action.ariaLabel).toMatch(/^New /);
      expect(action.routeName).toBeTruthy();
      expect(action.matchHref.startsWith('/')).toBe(true);
    });
  });

  it('lists the six secondary areas with a context line and route mapping', () => {
    expect(PHONE_MORE_SECTIONS.map((section) => section.label)).toEqual([
      'Tasks',
      'Finance',
      'Inventory',
      'Templates',
      'Integrations',
      'Organization',
    ]);
    expect(PHONE_MORE_SECTIONS.find((section) => section.label === 'Templates')?.href).toBe(
      '/forms'
    );
    PHONE_MORE_SECTIONS.forEach((section) => {
      expect(section.context.length).toBeGreaterThan(0);
      expect(section.routeName).toBeTruthy();
    });
  });

  it('always offers Settings and the Developer portal links', () => {
    expect(PHONE_MORE_LINKS.map((link) => link.href)).toEqual(['/settings', '/developers/home']);
  });
});
