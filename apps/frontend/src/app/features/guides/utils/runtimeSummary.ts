import { GuideVideo } from '@/app/features/guides/types/guides';

const toSeconds = (duration: string): number | undefined => {
  const parts = duration.split(':');
  if (parts.length !== 2) return undefined;
  const [minutes, seconds] = parts.map((part) => Number(part));
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return undefined;
  return minutes * 60 + seconds;
};

/**
 * The runtime line under the Guides title, derived from the library rather than
 * asserted.
 *
 * It used to read "2-6 minutes each" as a literal. That was already wrong for
 * the guides it described, and it would have gone quietly wronger every time the
 * library changed - a claim about content, hardcoded away from the content.
 */
export const runtimeSummary = (guides: readonly GuideVideo[]): string => {
  const lengths = guides
    .map((guide) => toSeconds(guide.duration))
    .filter((value): value is number => value !== undefined);
  if (lengths.length === 0) return 'short walkthroughs';

  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  if (longest < 60) return 'a minute or less each';

  const low = Math.max(1, Math.round(shortest / 60));
  const high = Math.round(longest / 60);
  if (low === high) return `about ${low} minute${low === 1 ? '' : 's'} each`;
  return `${low}–${high} minutes each`;
};
