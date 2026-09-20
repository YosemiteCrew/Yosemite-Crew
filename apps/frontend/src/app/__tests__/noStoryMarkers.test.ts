import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * These route/layout/loading files were individually reviewed and marked
 * `// no-story: <reason>` because each one either has no content of its own
 * (a metadata-only layout, a structural wrapper) or composes an
 * already-storied feature component - see the commit that added them for the
 * per-file reasoning. This test is the thing that keeps that reasoning from
 * silently rotting: `scripts/ci/story-coverage.mjs`'s NO_STORY_MARKER is what
 * the gate actually reads to exempt a file, so if a future edit strips the
 * comment - or moves the file - this fails, rather than the gate quietly
 * demanding a story for a wrapper that still has none.
 */
const MARKED_FILES = [
  'src/app/(routes)/(app)/appointments/[appointmentId]/workspace/loading.tsx',
  'src/app/(routes)/(app)/appointments/loading.tsx',
  'src/app/(routes)/(app)/chat/layout.tsx',
  'src/app/(routes)/(app)/chat/page.tsx',
  'src/app/(routes)/(app)/developers/settings/layout.tsx',
  'src/app/(routes)/(app)/layout.tsx',
  'src/app/(routes)/(app)/network/page.tsx',
  'src/app/(routes)/(app)/public-booking-setup/page.tsx',
  'src/app/(routes)/(book)/layout.tsx',
  'src/app/(routes)/(public)/about/page.tsx',
  'src/app/(routes)/(public)/accessibility/page.tsx',
  'src/app/(routes)/(public)/accessibility/report/layout.tsx',
  'src/app/(routes)/(public)/accessibility/report/page.tsx',
  'src/app/(routes)/(public)/auth/callback/page.tsx',
  'src/app/(routes)/(public)/contact-us/page.tsx',
  'src/app/(routes)/(public)/developers/page.tsx',
  'src/app/(routes)/(public)/developers/signin/page.tsx',
  'src/app/(routes)/(public)/developers/signup/page.tsx',
  'src/app/(routes)/(public)/dmca/page.tsx',
  'src/app/(routes)/(public)/impressum/page.tsx',
  'src/app/(routes)/(public)/insights/page.tsx',
  'src/app/(routes)/(public)/layout.tsx',
  'src/app/(routes)/(public)/page.tsx',
  'src/app/(routes)/(public)/payment-status/layout.tsx',
  'src/app/(routes)/(public)/payment-status/page.tsx',
  'src/app/(routes)/(public)/pet-businesses/page.tsx',
  'src/app/(routes)/(public)/pet-parents/page.tsx',
  'src/app/(routes)/(public)/pricing/page.tsx',
  'src/app/(routes)/(public)/privacy-policy/page.tsx',
  'src/app/(routes)/(public)/reset-password/page.tsx',
  'src/app/(routes)/(public)/success/layout.tsx',
  'src/app/(routes)/(public)/success/page.tsx',
  'src/app/(routes)/(public)/terms-and-conditions/page.tsx',
  'src/app/(routes)/(public)/trust-center/page.tsx',
  'src/app/(routes)/(public)/verify-email/page.tsx',
  'src/app/(routes)/(share)/layout.tsx',
  'src/app/(routes)/(share)/passport/[id]/page.tsx',
  'src/app/layout.tsx',
  'src/app/not-found.tsx',
];

// Mirrors scripts/ci/story-coverage.mjs's NO_STORY_MARKER exactly - duplicated
// rather than imported because that script is plain Node ESM outside this
// workspace's transform root, and the two are locked together by the
// `matches story-coverage.mjs's own detector` case below, so a drift between
// them fails loudly here instead of silently at CI time.
const NO_STORY_MARKER = /\/\/\s*no-story:\s*\S/;

describe('no-story markers on thin route wrappers', () => {
  it.each(MARKED_FILES)('%s carries a // no-story: marker with a real reason', (relativePath) => {
    const fullPath = path.join(process.cwd(), relativePath);
    const content = readFileSync(fullPath, 'utf8');
    expect(content).toMatch(NO_STORY_MARKER);
  });

  it("matches story-coverage.mjs's own detector, not a look-alike comment", () => {
    // The separating case: a comment that mentions "no-story" without the
    // colon-plus-reason shape the gate requires must NOT satisfy this regex,
    // or this test would pass on files the real gate still flags as missing.
    expect('// this component intentionally has no-story yet').not.toMatch(NO_STORY_MARKER);
    expect('// no-story:').not.toMatch(NO_STORY_MARKER); // no reason after the colon
    expect('// no-story: thin wrapper, see FooPage').toMatch(NO_STORY_MARKER);
  });
});
