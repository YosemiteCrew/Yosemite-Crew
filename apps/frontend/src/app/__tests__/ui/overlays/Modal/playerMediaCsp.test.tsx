import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import GuidePlayerModal from '@/app/ui/overlays/Modal/GuidePlayerModal';
import VideoPlayerModal from '@/app/ui/overlays/Modal/VideoPlayerModal';
import { buildContentSecurityPolicy } from '@/securityHeaders';
import type { GuideVideo } from '@/app/features/guides/types/guides';

jest.mock('@/app/ui/overlays/Modal/ModalBase', () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (showModal ? <div>{children}</div> : null),
}));

const CDN = 'https://d2il6osz49gpup.cloudfront.net';

const GUIDE: GuideVideo = {
  id: 'create-your-account',
  title: 'Create an account and verify the email',
  description: 'The sign-up form and the six-digit code',
  persona: 'Clinic owner',
  duration: '0:22',
  category: 'Getting started',
  tags: ['getting started'],
  videoUrl: `${CDN}/videos/guides/create-your-account.mp4`,
  thumbnailUrl: `${CDN}/guidePosters/create-your-account-poster.png`,
};

/**
 * Every media URL the players emit has to satisfy the app's OWN `media-src`.
 *
 * Both players used to render `<track src="data:text/vtt,WEBVTT">` to keep an
 * (empty) captions control on screen. `media-src` is `'self'` plus the two
 * CloudFront hosts and has never allowed `data:`, so the browser refused the
 * track and logged a violation on every single play - the element was dropped
 * anyway, which is exactly what the empty track existed to prevent. Nobody
 * noticed because no test looked at the URLs the players actually emit.
 *
 * The allowlist is READ FROM the real policy rather than restated here, so this
 * cannot drift from the header, and it is a check on all media URLs rather than
 * on the absence of one element - a future `blob:` poster or an unlisted CDN
 * would fail it too.
 */
const mediaSrcAllowlist = (): string[] => {
  // The same builder middleware.ts sends on every response.
  const csp = buildContentSecurityPolicy();
  const directive = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('media-src '));
  if (!directive) throw new Error(`no media-src directive in: ${csp}`);
  return directive.slice('media-src '.length).split(/\s+/).filter(Boolean);
};

/** Mirrors how a browser resolves a media URL against `media-src`. */
const isAllowedByMediaSrc = (url: string, allowlist: string[]): boolean => {
  // Relative or root-relative: same origin, covered by 'self'.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return allowlist.includes("'self'");
  return allowlist.some((source) => source !== "'self'" && url.startsWith(source));
};

const mediaUrlsIn = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('video, source, track, audio')]
    .map((el) => el.getAttribute('src'))
    .filter((src): src is string => Boolean(src));

describe('the video players and media-src', () => {
  it('reads a media-src allowlist that permits self and the CDN but not data:', () => {
    // Guards the guard: if the directive stopped being parsed, every assertion
    // below would pass against an empty allowlist.
    const allowlist = mediaSrcAllowlist();

    expect(allowlist).toContain("'self'");
    expect(allowlist).toContain(CDN);
    expect(allowlist).not.toContain('data:');
    expect(isAllowedByMediaSrc('data:text/vtt,WEBVTT', allowlist)).toBe(false);
    expect(isAllowedByMediaSrc(`${CDN}/videos/guides/x.mp4`, allowlist)).toBe(true);
    expect(isAllowedByMediaSrc('/captions/empty.vtt', allowlist)).toBe(true);
  });

  it('emits only media URLs GuidePlayerModal is allowed to load', () => {
    const allowlist = mediaSrcAllowlist();
    const { container } = render(
      <GuidePlayerModal
        showModal
        setShowModal={jest.fn()}
        guide={GUIDE}
        nextGuide={null}
        onNext={jest.fn()}
      />
    );

    const urls = mediaUrlsIn(container);
    expect(urls).toContain(GUIDE.videoUrl);
    expect(urls.filter((url) => !isAllowedByMediaSrc(url, allowlist))).toEqual([]);
  });

  it('emits only media URLs VideoPlayerModal is allowed to load', () => {
    const allowlist = mediaSrcAllowlist();
    const { container } = render(
      <VideoPlayerModal
        showModal
        setShowModal={jest.fn()}
        activeVideo={{
          title: GUIDE.title,
          videoUrl: GUIDE.videoUrl,
          thumbnailUrl: GUIDE.thumbnailUrl,
        }}
        isVideoLoaded
        setIsVideoLoaded={jest.fn()}
      />
    );

    const urls = mediaUrlsIn(container);
    expect(urls).toContain(GUIDE.videoUrl);
    expect(urls.filter((url) => !isAllowedByMediaSrc(url, allowlist))).toEqual([]);
  });

  it.each([
    ['GuidePlayerModal', GuidePlayerModal],
    ['VideoPlayerModal', VideoPlayerModal],
  ])('ships a same-origin captions file in %s', (name, Player) => {
    /* Sonar S4084 requires a <track> on every media element, which is why the
       data: URL existed at all. The answer is a real file from our own origin:
       it satisfies the rule, loads under `media-src 'self'`, and says something
       true - it names the music and states there is no narration, rather than
       being an empty file that leaves a deaf viewer with a captions control
       that does nothing. When narration ships, this file is replaced with per
       film cues; it must not go back to being empty. */
    const props =
      name === 'GuidePlayerModal'
        ? {
            showModal: true,
            setShowModal: jest.fn(),
            guide: GUIDE,
            nextGuide: null,
            onNext: jest.fn(),
          }
        : {
            showModal: true,
            setShowModal: jest.fn(),
            activeVideo: {
              title: GUIDE.title,
              videoUrl: GUIDE.videoUrl,
              thumbnailUrl: GUIDE.thumbnailUrl,
            },
            isVideoLoaded: true,
            setIsVideoLoaded: jest.fn(),
          };

    const { container } = render(React.createElement(Player as never, props as never));

    const track = container.querySelector('track');
    expect(track).not.toBeNull();
    expect(track).toHaveAttribute('kind', 'captions');
    // Root-relative, so it is served by us and permitted by 'self'.
    expect(track?.getAttribute('src')).toMatch(/^\/captions\/.+\.vtt$/);
  });

  it('ships a captions file that is real WebVTT and is not empty', () => {
    /* The failure this replaces was an EMPTY track. A file that exists but has
       no cues would pass every assertion above and still tell a deaf viewer
       nothing, so the content is checked too. */
    // jest runs with cwd at apps/frontend, so this is the file Next actually serves.
    const vtt = readFileSync(
      join(process.cwd(), 'public', 'captions', 'no-narration.en.vtt'),
      'utf8'
    );

    expect(vtt.startsWith('WEBVTT')).toBe(true);
    // At least one real cue: a timestamp range followed by text.
    const cues = vtt.match(/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}$/gm) ?? [];
    expect(cues.length).toBeGreaterThan(0);
    expect(vtt).toMatch(/no narration/i);
  });
});
