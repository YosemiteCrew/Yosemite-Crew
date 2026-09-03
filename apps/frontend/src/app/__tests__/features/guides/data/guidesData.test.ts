import { guidesData } from '@/app/features/guides/data/guidesData';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

/**
 * The shipped library, as opposed to the shelf that renders it.
 *
 * Guides.test.tsx drives the page from a fixture, so its filtering and player
 * behaviour is not re-pinned every time a film is added or re-cut. That leaves
 * the generated data itself unguarded, which is what this file covers: the
 * entries are generated from the film curriculum, and the failure mode is a
 * card that describes something the video does not show — six entries used to
 * claim durations that matched none of the three clips they actually played.
 */
describe('guidesData', () => {
  const PERSONAS = [
    'Everyone',
    'Front desk',
    'Veterinarian',
    'Nurse or technician',
    'Practice manager',
    'Clinic owner',
    'Developer',
  ];

  it('ships a guide for every film', () => {
    expect(guidesData.length).toBeGreaterThanOrEqual(70);
  });

  it('points every entry at its own film and poster', () => {
    /* The bug this replaces: three clips were shared between six entries, so a
       card titled "Your first day in the PIMS" played a recording of somebody
       adding a team member. A guide's media is derived from its id, so a
       mismatch is now unrepresentable — and this proves the derivation. */
    for (const g of guidesData) {
      expect(g.videoUrl).toBe(MEDIA_SOURCES.guides.film(g.id));
      expect(g.thumbnailUrl).toBe(MEDIA_SOURCES.guides.poster(g.id));
      expect(g.videoUrl).toContain(`/videos/guides/${g.id}.mp4`);
      expect(g.thumbnailUrl).toContain(`/guidePosters/${g.id}-poster.png`);
    }
  });

  it('gives every entry a unique id', () => {
    const ids = guidesData.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('states a real duration on every entry', () => {
    // Not a placeholder and not zero: the duration is the card's badge and the
    // player's total, and the entries it replaces invented theirs.
    for (const g of guidesData) {
      expect(g.duration).toMatch(/^\d+:[0-5]\d$/);
      const [minutes, seconds] = g.duration.split(':').map(Number);
      expect(minutes * 60 + seconds).toBeGreaterThan(0);
    }
  });

  it('files every entry under a role the product actually has', () => {
    for (const g of guidesData) {
      expect(PERSONAS).toContain(g.persona);
    }
  });

  it('carries no per-viewer state', () => {
    /* status/progressPercent/currentTime are claims about the reader, not the
       video. As module literals they told every user of every clinic that they
       had already watched the same guides. Nothing records viewing progress, so
       they must stay absent until something does. */
    for (const g of guidesData) {
      expect(g.progressPercent).toBeUndefined();
      expect(g.currentTime).toBeUndefined();
      expect(g.status).not.toBe('watched');
    }
  });

  it('titles and describes every entry', () => {
    for (const g of guidesData) {
      expect(g.title.trim().length).toBeGreaterThan(0);
      expect(g.description.trim().length).toBeGreaterThan(0);
      expect(g.category.trim().length).toBeGreaterThan(0);
    }
  });
});
