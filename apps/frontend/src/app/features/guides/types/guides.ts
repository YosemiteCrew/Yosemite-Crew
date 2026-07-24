export type GuideStatus = 'watched' | 'new';

export type GuideChapter = {
  label: string;
  time: string;
  /** Highlighted (blue) chapter — typically the final "payment/wrap-up" chapter. */
  highlight?: boolean;
};

export type GuideVideo = {
  id: string;
  title: string;
  description: string;
  /** Full runtime label, e.g. "5:18". Doubles as the thumbnail badge and player total time. */
  duration: string;
  category: string;
  tags: string[];
  videoUrl: string;
  thumbnailUrl: string;
  featured?: boolean;
  /** "watched" or "new" — mutually exclusive with a progress bar. */
  status?: GuideStatus;
  /** 1–99 renders an in-progress bar on the card and pre-fills the player scrubber. */
  progressPercent?: number;
  /** Scrubber time label shown in the player, e.g. "3:07". */
  currentTime?: string;
  /** Chapter markers shown under the player. */
  chapters?: GuideChapter[];
};
