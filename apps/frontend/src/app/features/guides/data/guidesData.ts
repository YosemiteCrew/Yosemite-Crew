import type { GuideVideo } from '@/app/features/guides/types/guides';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import guideDefinitions from './guidesData.json';

/**
 * The Guides library: one entry per film in the training set.
 *
 * GENERATED — do not hand-edit. Source of truth is the film curriculum
 * (tools/curriculum.json in the guide-video project); regenerate this module
 * and guidesData.json together. Titles, descriptions, durations, categories
 * and personas are the films' own, so a card cannot describe something the
 * video does not show.
 *
 * Deliberately absent: per-viewer state. Nothing records viewing progress, so
 * static entries must not claim that a user watched part of a film.
 */
type GuideDefinition = Omit<GuideVideo, 'videoUrl' | 'thumbnailUrl'>;

const toGuideVideo = (guide: GuideDefinition): GuideVideo => ({
  ...guide,
  videoUrl: MEDIA_SOURCES.guides.film(guide.id),
  thumbnailUrl: MEDIA_SOURCES.guides.poster(guide.id),
});

export const guidesData = (guideDefinitions as GuideDefinition[]).map(toGuideVideo);
