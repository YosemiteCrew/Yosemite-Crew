import {readFileSync} from 'node:fs';
import path from 'node:path';

/**
 * Regression for #2719. TypeScript binds only the nearest of two adjacent JSDoc
 * blocks, so the earlier one never reaches hover or quick-info. Each file below
 * had such a pair fixed; the count pins what is left, which is the pairs the
 * issue classified as leave.
 */
const SRC = path.resolve(__dirname, '../../src');

const ADJACENT_JSDOC = /\*\/\s*\/\*\*/g;

const EXPECTED: Record<string, number> = {
  'features/assistant/nlu/dates.ts': 0,
  'shared/utils/currency.ts': 0,
};

describe('JSDoc blocks orphaned by an adjacent block (#2719)', () => {
  it.each(Object.entries(EXPECTED))(
    '%s keeps %i adjacent pair(s)',
    (file, expected) => {
      const source = readFileSync(path.join(SRC, file), 'utf8');
      expect(source.match(ADJACENT_JSDOC)?.length ?? 0).toBe(expected);
    },
  );
});
