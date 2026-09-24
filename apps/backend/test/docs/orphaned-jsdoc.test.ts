import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression for #2719. TypeScript binds only the nearest of two adjacent JSDoc
 * blocks, so the earlier one never reaches hover or quick-info. Each file below
 * had such a pair fixed; the count pins what is left, which is the pairs the
 * issue classified as leave.
 */
const SRC = path.resolve(__dirname, "../../src");

const ADJACENT_JSDOC = /\*\/\s*\/\*\*/g;

const EXPECTED: Record<string, number> = {
  "config/stream-upload-policy.ts": 0,
  "controllers/web/appointment.prisma.controller.ts": 0,
  "controllers/web/pet-passport.controller.ts": 1,
  "scripts/import-atcvet-index.ts": 0,
  "services/booking-page.service.ts": 0,
  "services/inventory.service.ts": 0,
  "services/organisation-document.service.ts": 0,
  "services/pet-passport.service.ts": 0,
  "services/shared/breed-code.ts": 0,
  "services/super-admin-business.service.ts": 0,
};

describe("JSDoc blocks orphaned by an adjacent block (#2719)", () => {
  it.each(Object.entries(EXPECTED))(
    "%s keeps %i adjacent pair(s)",
    (file, expected) => {
      const source = readFileSync(path.join(SRC, file), "utf8");
      expect(source.match(ADJACENT_JSDOC)?.length ?? 0).toBe(expected);
    },
  );
});
