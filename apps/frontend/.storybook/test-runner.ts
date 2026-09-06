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
    /* `storyGlobals`, not `globals`. Storybook 10's story context carries a
       story's own `globals` annotation under `storyGlobals`; `globals` is not a
       key on it at all, so this read was `undefined` for EVERY story and every
       one of them fell through to `laptop`. That is the exact failure this hook
       was written to prevent, and it was silent because the job is
       `continue-on-error`. */
    /* The cast is load-bearing, not tidy-up-able. `getStoryContext` is DECLARED
       as returning `StoryContextForEnhancers`, and `storyGlobals` lives on
       `PreparedStory`, not on that type - runtime has the key, the declared type
       does not. Removing the cast produces a type error, and the obvious "fix"
       for that error is to read `globals` again, which is the bug. */
    const raw = storyContext as unknown as Record<string, unknown>;
    const storyGlobals = raw.storyGlobals as
      Record<string, { value?: string } | undefined> | undefined;

    /* Fail on a context shape we do not recognise, instead of silently
       defaulting. `requested ?? DEFAULT_VIEWPORT` cannot tell "this story asked
       for nothing" from "this story asked and I could not read it" - both become
       `laptop`. That is the defect CLASS; the `globals` -> `storyGlobals` rename
       was only the instance, and the next rename would degrade every phone story
       to 1280px again just as quietly.

       `storyGlobals` is present on every story context (an empty object when the
       story pins nothing), so both keys being absent cannot happen today and can
       only mean the shape moved. Loud, the same way the unknown-viewport branch
       below already is. */
    if (storyGlobals === undefined && storyContext.globals === undefined) {
      throw new Error(
        `test-runner: story "${context.id}" has neither \`storyGlobals\` nor \`globals\` on its ` +
          'context, so a pinned viewport cannot be read and every story would silently render at ' +
          `${DEFAULT_VIEWPORT}. Storybook's story-context shape has changed - update preVisit in ` +
          '.storybook/test-runner.ts to read the new key.'
      );
    }

    const requested = (storyGlobals?.viewport ?? storyContext.globals?.viewport)?.value;
    const key = requested ?? DEFAULT_VIEWPORT;
    const size = VIEWPORT_SIZES[key];

    if (!size) {
      /* Loud rather than silent. A story pinned to a viewport this map does not
         know would otherwise render at Playwright's default and fail somewhere
         far from the cause. */
      throw new Error(
        `test-runner: story "${context.id}" requests unknown viewport "${key}". Add it to VIEWPORT_SIZES and .storybook/preview.ts, or fix the story's global.`
      );
    }

    await page.setViewportSize(size);
  },
};

export default config;
