import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';

/**
 * The viewport sizes declared in preview.ts, restated here as numbers.
 *
 * They have to be duplicated rather than imported: preview.ts is bundled for the
 * browser and this file runs in the Node process that drives Playwright. The
 * guard below fails loudly if the two ever drift.
 */
const VIEWPORT_SIZES: Record<string, { width: number; height: number }> = {
  mobile: { width: 375, height: 812 },
  mobileLg: { width: 430, height: 932 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1440, height: 900 },
  wide: { width: 1920, height: 1080 },
};

/**
 * `initialGlobals` in preview.ts. An unpinned story renders the desktop branch
 * rather than whatever width the browser happens to open at.
 */
const DEFAULT_VIEWPORT = 'laptop';

/**
 * Applies each story's declared viewport before it renders.
 *
 * This is the difference between a usable runner and a wall of phantom
 * failures. Storybook's viewport global is applied by the MANAGER, which
 * resizes the preview iframe - the test runner drives the story directly and
 * never loads the manager, so without this hook every story renders at
 * Playwright's default 1280x720 and each phone-pinned story fails for a reason
 * that does not exist in Storybook or in Chromatic.
 *
 * Measured on this repo before the hook existed: `Forms/Build > Phone` failed
 * with `expected '0px' to be '1px'`, a real assertion about a layout that only
 * holds at 375px.
 */
const config: TestRunnerConfig = {
  async preVisit(page, context) {
    const storyContext = await getStoryContext(page, context);
    const requested = (storyContext.globals?.viewport as { value?: string } | undefined)?.value;
    const key = requested ?? DEFAULT_VIEWPORT;
    const size = VIEWPORT_SIZES[key];

    if (!size) {
      /* Loud rather than silent. A story pinned to a viewport this map does not
         know would otherwise render at Playwright's default and fail somewhere
         far from the cause. */
      throw new Error(
        `test-runner: story "${context.id}" requests viewport "${key}", which is not in ` +
          `VIEWPORT_SIZES. Add it here and in .storybook/preview.ts, or fix the story's global.`
      );
    }

    await page.setViewportSize(size);
  },
};

export default config;
