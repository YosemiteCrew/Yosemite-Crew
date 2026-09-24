import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Regression for #2719. TypeScript binds only the nearest of two adjacent JSDoc
 * blocks, so the earlier one never reaches hover or quick-info. Each file below
 * had such a pair fixed; the count pins what is left, which is the pairs the
 * issue classified as leave.
 */
const SRC = path.resolve(__dirname, '../../..');

const ADJACENT_JSDOC = /\*\/\s*\/\*\*/g;

const EXPECTED: Record<string, number> = {
  'app/features/appointments/components/Calendar/Task/TaskMarker.tsx': 0,
  'app/features/appointments/lib/inventoryPrescription.ts': 0,
  'app/features/appointments/services/clinicalTermsService.ts': 0,
  'app/features/appointments/services/patientCheckInService.ts': 0,
  'app/features/inventory/pages/Inventory/InventoryFilterModal.stories.tsx': 0,
  'app/features/marketing/pages/Home/Home.stories.tsx': 2,
  'app/features/onboarding/pages/PublicBookingSetup/PublicBookingSetup.tsx': 0,
  'app/lib/postAuthRedirect.ts': 0,
  'app/ui/layout/Header/GuestHeader/GuestHeader.stories.tsx': 0,
  'app/ui/primitives/RichTextEditor/FloatingToolbar.stories.tsx': 1,
  'app/ui/theme/prePaintScript.ts': 0,
  'app/ui/widgets/DynamicChart/ChartCanvas.stories.tsx': 0,
};

describe('JSDoc blocks orphaned by an adjacent block (#2719)', () => {
  it.each(Object.entries(EXPECTED))('%s keeps %i adjacent pair(s)', (file, expected) => {
    const source = readFileSync(path.join(SRC, file), 'utf8');
    expect(source.match(ADJACENT_JSDOC)?.length ?? 0).toBe(expected);
  });
});
