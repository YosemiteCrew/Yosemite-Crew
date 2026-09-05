import { runtimeSummary } from '@/app/features/guides/utils/runtimeSummary';
import { GuideVideo } from '@/app/features/guides/types/guides';

const guide = (duration: string): GuideVideo =>
  ({
    id: duration,
    title: 't',
    description: 'd',
    duration,
    category: 'c',
    tags: [],
    videoUrl: 'v',
    thumbnailUrl: 'p',
  }) as GuideVideo;

describe('runtimeSummary', () => {
  it('spans the shortest and longest guide', () => {
    // 3:42 -> 4 min, 5:18 -> 5 min. The header used to claim "2-6 minutes each",
    // a literal that was wrong about the very guides it sat above.
    expect(runtimeSummary([guide('3:42'), guide('5:18')])).toBe('4–5 minutes each');
  });

  it('does not claim a range when every guide rounds to the same minute', () => {
    expect(runtimeSummary([guide('2:10'), guide('2:25')])).toBe('about 2 minutes each');
  });

  it('says a minute or less when nothing reaches a minute', () => {
    /* The film set that replaces the seed content runs 16 to 52 seconds, so a
       minutes range would be a fiction in the other direction. */
    expect(runtimeSummary([guide('0:16'), guide('0:52')])).toBe('a minute or less each');
  });

  it('never rounds a short guide down to zero minutes', () => {
    // 0:20 rounds to 0; the floor of 1 keeps the low end honest rather than
    // printing "0–2 minutes each".
    expect(runtimeSummary([guide('0:20'), guide('2:00')])).toBe('1–2 minutes each');
  });

  it('uses the singular for a one-minute library', () => {
    expect(runtimeSummary([guide('1:05'), guide('0:50')])).toBe('about 1 minute each');
  });

  it('falls back to a claim it can support when no duration parses', () => {
    // Not "0 minutes each": an unparseable library means the length is unknown,
    // and the header must not invent one.
    expect(runtimeSummary([guide('later'), guide('')])).toBe('short walkthroughs');
    expect(runtimeSummary([])).toBe('short walkthroughs');
  });

  it('ignores an unparseable entry rather than discarding the whole range', () => {
    // Two shapes of bad input: one with no colon at all, and one that splits
    // into two parts that are not numbers. Number('') is 0 and would otherwise
    // read as a real zero-length guide.
    expect(runtimeSummary([guide('3:00'), guide('nope'), guide('6:00')])).toBe('3–6 minutes each');
    expect(runtimeSummary([guide('3:00'), guide('mm:ss'), guide('6:00')])).toBe('3–6 minutes each');
    expect(runtimeSummary([guide('mm:ss')])).toBe('short walkthroughs');
  });
});
