import type { CSSProperties } from 'react';

import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

export const CDN_BASE = 'https://d2il6osz49gpup.cloudfront.net';

export const GITHUB_REPO_URL = 'https://github.com/YosemiteCrew/Yosemite-Crew';
export const GITHUB_API_REPO = 'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew';
/**
 * Invite code for the Yosemite Crew Discord (guild 1325181058777616395), the same code the
 * README/dev-docs badges use. It is NOT the `yosemitecrew` vanity: that vanity was never
 * registered, so both the join link and the member-count lookup 404'd against it.
 */
export const DISCORD_INVITE_CODE = 'SwM6mX85KD';
export const DISCORD_INVITE_URL = `https://discord.gg/${DISCORD_INVITE_CODE}`;
export const LINKEDIN_URL = 'https://www.linkedin.com/company/yosemitecrew';
export const INSTAGRAM_URL = 'https://www.instagram.com/yosemite_crew';
export const X_URL = 'https://x.com/yosemitecrew';
export const TIKTOK_URL = 'https://www.tiktok.com/@yosemitecrew';
export const CONTRIBUTING_URL = `${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`;
export const RELEASES_LATEST_URL = `${GITHUB_REPO_URL}/releases/latest`;
export const APP_STORE_URL = 'https://apps.apple.com/us/search?term=yosemite%20crew';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mobileappyc';

/** Shared "Star on GitHub" solid pill CTA styling, used on the dark closing-CTA bands. */
export const GITHUB_STAR_CTA_STYLE: CSSProperties = {
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  background: '#f7f3ec',
  color: '#1d1c1b',
  fontSize: '17px',
  fontWeight: 500,
  letterSpacing: '-0.02em',
  padding: '16px 32px',
  borderRadius: '9999px',
  transition: 'background 200ms',
};

/** Inner container for a closing CTA band (centered column); vertical padding varies per page. */
export const ctaBandContainerStyle = (padding: string): CSSProperties => ({
  width: 'min(880px, calc(100% - 48px))',
  margin: '0 auto',
  padding,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  position: 'relative',
});

export const MARKETING_LOGO = '/images/marketing/logo.svg';
export const HERO_AVATARS = [
  '/images/marketing/hero-av-1.png',
  '/images/marketing/hero-av-2.png',
  '/images/marketing/hero-av-3.png',
] as const;
export const COMPANION_PHOTOS = {
  dog: '/images/marketing/companion-dog.webp',
  horse: '/images/marketing/companion-horse.webp',
  cat: '/images/marketing/companion-cat.webp',
} as const;
export const ABOUT_ORIGIN_PHOTO = '/images/marketing/about-origin.webp';

/* Ambient hero loops + posters live on the marketing CDN (size + stock
   licensing), sourced from the shared media constants. HeroVideo shows the
   poster while the loop loads and no-ops under reduced motion / load failure. */
const HERO = MEDIA_SOURCES.landing.hero;
export const HERO_VIDEOS = {
  home: HERO.home.video,
  petBusinesses: HERO.businesses.video,
  petParents: HERO.petParents.video,
} as const;
export const HERO_POSTERS = {
  home: HERO.home.poster,
  petBusinesses: HERO.businesses.poster,
  petParents: HERO.petParents.poster,
} as const;

export const CERT_BADGES = {
  gdpr: `${CDN_BASE}/footer/gdpr.png`,
  soc2: `${CDN_BASE}/footer/soc-2.png`,
  iso: `${CDN_BASE}/footer/iso.png`,
  fhir: `${CDN_BASE}/footer/fhir.png`,
  fda: `${CDN_BASE}/footer/fda.png`,
} as const;
