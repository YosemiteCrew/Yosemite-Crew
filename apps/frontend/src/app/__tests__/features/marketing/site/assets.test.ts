import {
  DISCORD_INVITE_URL,
  GITHUB_STAR_CTA_STYLE,
  ctaBandContainerStyle,
} from '@/app/features/marketing/site/assets';

describe('marketing site shared styles', () => {
  it('exposes the solid GitHub CTA style as a light pill', () => {
    expect(GITHUB_STAR_CTA_STYLE.background).toBe('#f7f3ec');
    expect(GITHUB_STAR_CTA_STYLE.color).toBe('#1d1c1b');
    expect(GITHUB_STAR_CTA_STYLE.borderRadius).toBe('9999px');
    expect(GITHUB_STAR_CTA_STYLE.padding).toBe('16px 32px');
  });

  it('builds a centered CTA-band container with the supplied padding', () => {
    const style = ctaBandContainerStyle('clamp(96px, 13vw, 170px) 0');
    expect(style.padding).toBe('clamp(96px, 13vw, 170px) 0');
    expect(style.width).toBe('min(880px, calc(100% - 48px))');
    expect(style.display).toBe('flex');
    expect(style.flexDirection).toBe('column');
    expect(style.alignItems).toBe('center');
    expect(style.textAlign).toBe('center');
  });
});

describe('marketing site community links', () => {
  // The `yosemitecrew` vanity invite stopped resolving once the guild lost the
  // boost level a vanity URL requires, which silently broke the Discord link in
  // the footer, on Contact us and on About. The raw invite code never expires,
  // so it is the one the site publishes. Note that the dead vanity URL still
  // 301s, so only resolving it through Discord's API reveals it is invalid -
  // pin the value here instead.
  it('publishes the non-expiring raw Discord invite, not the vanity slug', () => {
    expect(DISCORD_INVITE_URL).toBe('https://discord.gg/SwM6mX85KD');
    expect(DISCORD_INVITE_URL).not.toContain('discord.gg/yosemitecrew');
  });
});
