import { MEDIA_SOURCES as REAL_MEDIA_SOURCES } from '../../src/app/constants/mediaSources';

/**
 * Storybook-only override of the avatar fallback pool - #2853.
 *
 * `getSafeImageUrl` (`src/app/lib/urls.ts`) degrades any rejected or missing
 * photo to `MEDIA_SOURCES.avatars.<species>`, which points at the production
 * CDN in every environment including this one - a request no story asks for
 * but every rejected-photo story triggers. Aliased here (`viteFinal` in
 * `main.ts`) rather than editing the constant itself, so production keeps
 * shipping the real CDN path and only the Storybook bundle sees the local
 * one.
 *
 * Filenames match the production ones (`avatar/dog.png`, not
 * `dog-fixture.png`): several stories assert on the substring the fallback
 * degrades to (e.g. `toContain('avatar/dog.png')`) to prove a photo WAS
 * rejected, and a renamed fixture would silently defeat that assertion
 * instead of failing it.
 */
export const MEDIA_SOURCES = {
  ...REAL_MEDIA_SOURCES,
  avatars: {
    dog: '/images/storybook-fixtures/avatar/dog.png',
    cat: '/images/storybook-fixtures/avatar/cat.png',
    horse: '/images/storybook-fixtures/avatar/horse.png',
    person: '/images/storybook-fixtures/avatar/parent1.png',
    business: '/images/storybook-fixtures/avatar/business1.png',
  },
} as const;
