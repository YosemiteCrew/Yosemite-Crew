import { aboutPanelOptions, HELP_LINKS, branding } from '../src/ui/branding';

describe('aboutPanelOptions', () => {
  test('returns product metadata with the supplied version and year', () => {
    const options = aboutPanelOptions('1.2.3', 2026);
    expect(options.applicationName).toBe('Yosemite Crew PIMS');
    expect(options.applicationVersion).toBe('1.2.3');
    expect(options.version).toBe('1.2.3');
    expect(options.copyright).toBe('© 2026 Yosemite Crew');
    expect(options.website).toBe('https://yosemitecrew.com');
  });

  test('defaults the year to the current year', () => {
    const options = aboutPanelOptions('1.0.0');
    expect(options.copyright).toMatch(/^© \d{4} Yosemite Crew$/);
  });
});

describe('HELP_LINKS', () => {
  test('are all absolute https links with labels', () => {
    expect(HELP_LINKS.length).toBeGreaterThan(0);
    for (const link of HELP_LINKS) {
      expect(typeof link.label).toBe('string');
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.url).toMatch(/^https:\/\//);
    }
  });

  test('include support and issue-reporting destinations', () => {
    const urls = HELP_LINKS.map((l) => l.url);
    expect(urls).toContain(`${branding.WEBSITE}/contact-us`);
    expect(urls).toContain('https://github.com/YosemiteCrew/Yosemite-Crew/issues');
  });
});
