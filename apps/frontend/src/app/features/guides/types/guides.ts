export type GuideStatus = 'watched' | 'new';

export type GuideChapter = {
  label: string;
  time: string;
  /** Highlighted (blue) chapter — typically the final "payment/wrap-up" chapter. */
  highlight?: boolean;
};

/**
 * Who a guide is for. The films are cut per persona rather than per feature,
 * because a receptionist and a vet need different things from the same screen.
 * The roles here are the product's own (organization/pages/Organization/types.ts);
 * `Everyone` is for the handful that genuinely apply to the whole clinic.
 */
export type GuidePersona =
  | 'Everyone'
  | 'Front desk'
  | 'Veterinarian'
  | 'Nurse or technician'
  | 'Practice manager'
  | 'Clinic owner'
  | 'Developer';

export type GuideVideo = {
  id: string;
  title: string;
  description: string;
  /** Who the guide is cut for; drives the persona filter on the Guides screen. */
  persona?: GuidePersona;
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
