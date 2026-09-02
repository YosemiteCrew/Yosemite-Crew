/**
 * LabelDropdown and MultiSelectDropdown must stay metrically identical.
 *
 * They sit next to each other in the New appointment modal as "Lead" and
 * "Support". They drifted to 13px/px-[13px]/pr-9 against 14px/px-[14px]/pr-11 -
 * close enough to read as the same control, far enough that the text baselines
 * and chevrons did not line up, which is what a user notices as "two different
 * dropdown designs".
 *
 * This asserts the trigger metrics rather than a screenshot, so the drift fails
 * a unit run instead of waiting for someone to spot it in the product.
 */
import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

const LABEL = 'src/app/ui/inputs/Dropdown/LabelDropdown.tsx';
const MULTI = 'src/app/ui/inputs/MultiSelectDropdown/index.tsx';

/** The metric tokens that decide whether two triggers look like one control. */
const METRICS = [/h-\[(\d+)px\]/, /px-\[(\d+)px\]/, /pr-(\d+)\b/, /text-\[(\d+)px\]/];

const triggerMetrics = (src: string) => {
  // The trigger is the class string carrying the shared height token.
  const line = src.split('\n').find((l) => l.includes('h-[44px]') && l.includes('px-['));
  if (!line) throw new Error('trigger class string not found');
  return METRICS.map((re) => (line.match(re) || [])[1]);
};

describe('dropdown metric parity', () => {
  it('LabelDropdown and MultiSelectDropdown share trigger height, padding and font size', () => {
    expect(triggerMetrics(read(MULTI))).toEqual(triggerMetrics(read(LABEL)));
  });

  it('both render the typed search text at the same size', () => {
    /* Only the search input is compared, not every text size in the file:
       LabelDropdown legitimately uses 11px and 12px for other elements, and an
       earlier version of this test wrongly demanded the whole set match. */
    const searchTextSize = (src: string) => {
      const line = src
        .split('\n')
        .find((l) => l.includes('bg-transparent') && l.includes('text-['));
      if (!line) throw new Error('search input class string not found');
      return (line.match(/text-\[(\d+)px\]/) || [])[1];
    };
    expect(searchTextSize(read(MULTI))).toBe(searchTextSize(read(LABEL)));
  });
});
