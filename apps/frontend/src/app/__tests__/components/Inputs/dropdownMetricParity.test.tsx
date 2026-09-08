/**
 * LabelDropdown and MultiSelectDropdown must stay metrically identical.
 *
 * They sit next to each other in the New appointment modal as "Lead" and
 * "Support". They drifted to 13px/px-[13px]/pr-9 against 14px/px-[14px]/pr-11 -
 * close enough to read as the same control, far enough that the text baselines
 * and chevrons did not line up, which is what a user notices as "two different
 * dropdown designs".
 *
 * Both controls now consume the shared field recipe. This test keeps their
 * remaining layout tokens aligned around that primitive.
 */
import fs from 'fs';
import path from 'path';

const LABEL_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/app/ui/inputs/Dropdown/LabelDropdown.tsx'),
  'utf8'
);
const MULTI_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/app/ui/inputs/MultiSelectDropdown/index.tsx'),
  'utf8'
);

const METRICS = [/\bh-(\d+)\b/, /\bpx-(\d+)\b/, /\bpr-(\d+)\b/];

const triggerMetrics = (src: string) => {
  const line = src.split('\n').find((candidate) => candidate.includes('const base ='));
  if (!line) throw new Error('trigger class string not found');
  return METRICS.map((re) => (line.match(re) || [])[1]);
};

describe('dropdown metric parity', () => {
  it('LabelDropdown and MultiSelectDropdown share the field recipe and trigger spacing', () => {
    expect(LABEL_SOURCE).toContain('getFieldControlClassName');
    expect(MULTI_SOURCE).toContain('getFieldControlClassName');
    expect(triggerMetrics(MULTI_SOURCE)).toEqual(triggerMetrics(LABEL_SOURCE));
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
    expect(searchTextSize(MULTI_SOURCE)).toBe(searchTextSize(LABEL_SOURCE));
  });
});
