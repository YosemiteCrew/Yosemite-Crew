export const CDN_BASE = 'https://d2il6osz49gpup.cloudfront.net';

export const GITHUB_REPO_URL = 'https://github.com/YosemiteCrew/Yosemite-Crew';
export const GITHUB_API_REPO = 'https://api.github.com/repos/YosemiteCrew/Yosemite-Crew';
export const DISCORD_INVITE_URL = 'https://discord.gg/yosemitecrew';
export const LINKEDIN_URL = 'https://www.linkedin.com/company/yosemitecrew';
export const INSTAGRAM_URL = 'https://www.instagram.com/yosemite_crew';
export const X_URL = 'https://x.com/yosemitecrew';
export const TIKTOK_URL = 'https://www.tiktok.com/@yosemitecrew';
export const CONTRIBUTING_URL = `${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`;
export const RELEASES_LATEST_URL = `${GITHUB_REPO_URL}/releases/latest`;
export const APP_STORE_URL = 'https://apps.apple.com/us/search?term=yosemite%20crew';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mobileappyc';

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

/* Ambient hero loops live on the marketing CDN, not in the repo (size + stock
   licensing). Upload targets documented in the PR; HeroVideo no-ops until the
   file is reachable. */
export const HERO_VIDEOS = {
  home: `${CDN_BASE}/videos/hero-loop.mp4`,
  petBusinesses: `${CDN_BASE}/videos/hero-farm-veterinarian.mp4`,
  petParents: `${CDN_BASE}/videos/hero-pet-parents.mp4`,
} as const;

export const CERT_BADGES = {
  gdpr: `${CDN_BASE}/footer/gdpr.png`,
  soc2: `${CDN_BASE}/footer/soc-2.png`,
  iso: `${CDN_BASE}/footer/iso.png`,
  fhir: `${CDN_BASE}/footer/fhir.png`,
  fda: `${CDN_BASE}/footer/fda.png`,
} as const;
