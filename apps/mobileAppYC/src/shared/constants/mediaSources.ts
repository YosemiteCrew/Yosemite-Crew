// src/shared/constants/mediaSources.ts
//
// Single source of truth for the mobile app's REMOTE media links - pictures and
// videos streamed from CloudFront rather than bundled in the app binary.
// Mirrors the web app's app/constants/mediaSources.ts and shares the same CDNs.
//
// Where each kind of asset lives:
// - Bundled UI assets (icons, splash, illustrations): src/assets/images/index.ts
//   (the `Images` registry, require()'d PNGs shipped in the binary).
// - User / clinic uploaded content (documents, pet photos): built at runtime
//   from storage keys via src/shared/utils/cdnHelpers.ts (`buildCdnUrlFromKey`).
// - Curated app media (avatars, onboarding loops, integration logos): here.

/** Curated app + marketing media CDN (avatars, onboarding, integration logos). */
const YC_MEDIA_CDN = 'https://d2il6osz49gpup.cloudfront.net';
/** Organisation / user uploaded content CDN (documents, pet photos). */
const YC_ORG_CDN = 'https://d2kyjiikho62xx.cloudfront.net';

const join = (base: string, path: string): string =>
  `${base}/${path.replace(/^\/+/, '')}`;

/** Build a URL on the curated media CDN (mobile parity with the web `ycCdn`). */
export const ycCdn = (path: string): string => join(YC_MEDIA_CDN, path);

/** Build a URL on the org CDN (user / clinic uploaded content). */
export const ycOrgCdn = (path: string): string => join(YC_ORG_CDN, path);

export const MEDIA_SOURCES = {
  // Partner / integration logos.
  integrations: {
    merckLogo: ycCdn('integrations/merckLogo.png'),
    msdLogo: ycCdn('integrations/MSDLogo.png'),
  },

  // Warm-graded species portraits (shared with the marketing-site avatars).
  species: {
    dog: ycCdn('avatar/dog.png'),
    cat: ycCdn('avatar/cat.png'),
    horse: ycCdn('avatar/horse.png'),
  },

  // Onboarding hero loops (warm-bone) + the matching splash-screen loop.
  onboarding: {
    slide1: {
      video: ycCdn('mobile/videos/loop-cat.mp4'),
    },
    slide2: {
      video: ycCdn('mobile/videos/loop-dog.mp4'),
    },
    slide3: {
      video: ycCdn('mobile/videos/loop-care.mp4'),
    },
  },
} as const;
