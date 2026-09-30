import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';

type StorybookJestGlobals = typeof globalThis & {
  context: Parameters<NonNullable<typeof globalThis.__sbSetupPage>>[1];
  jestPlaywright: { resetPage: () => Promise<void> };
  page: Parameters<NonNullable<typeof globalThis.__sbSetupPage>>[0];
};

async function restoreStorybookPage(
  page: Parameters<NonNullable<TestRunnerConfig['preVisit']>>[0]
) {
  const hasContext = await page
    .evaluate(() => typeof (globalThis as { __getContext?: unknown }).__getContext === 'function')
    .catch(() => false);
  if (hasContext) return page;

  const globals = globalThis as StorybookJestGlobals;
  const replacement = await globals.context.newPage();
  await globals.__sbSetupPage(replacement, globals.context);
  const previous = globals.page;
  globals.page = replacement;
  await previous?.close();
  return replacement;
}

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
/** Render phases after which Storybook does nothing more with a story. */
const SETTLED_PHASES = ['finished', 'aborted'];

/** Upper bound on the wait, well inside the 15s per-story test timeout. */
const SETTLE_TIMEOUT_MS = 10_000;

/**
 * Resolves once the current story render has settled, or quietly after the
 * timeout: this only runs on a story that already failed, so it must never
 * replace that story's own error with one of its own.
 */
async function waitForRenderToFinish(
  page: Parameters<NonNullable<TestRunnerConfig['postVisit']>>[0]
) {
  await page
    .waitForFunction(
      (settled) => {
        const preview = (
          globalThis as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } }
        ).__STORYBOOK_PREVIEW__;
        const phase = preview?.currentRender?.phase;
        return phase === undefined || settled.includes(phase);
      },
      SETTLED_PHASES,
      { timeout: SETTLE_TIMEOUT_MS }
    )
    .catch(() => undefined);
}

const config: TestRunnerConfig = {
  async preVisit(page, context) {
    const activePage = await restoreStorybookPage(page);
    const storyContext = await getStoryContext(activePage, context);
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
       story pins nothing), so its absence cannot happen today and can only mean
       the shape moved. Loud, the same way the unknown-viewport branch below
       already is.

       Deliberately NO `?? storyContext.globals` fallback. `globals` is not a key
       on this context at all - measured, `hasGlobals=false typeof undefined` on
       every story - so a fallback to it is dead today AND is the one term that
       can defeat this guard tomorrow: if a rename moved `storyGlobals` while
       `globals` came back, the guard would stay silent and the viewport read
       would resolve through the exact path that caused the original bug. A
       compatibility branch nobody exercises is not insurance, it is the hole. */
    if (storyGlobals === undefined) {
      throw new Error(
        `test-runner: story "${context.id}" has no \`storyGlobals\` on its context, so a pinned ` +
          `viewport cannot be read and every story would silently render at ${DEFAULT_VIEWPORT}. ` +
          "Storybook's story-context shape has changed - update preVisit in " +
          '.storybook/test-runner.ts to read the new key.'
      );
    }

    /* `storyGlobals.` and not `storyGlobals?.` - the guard above has already
       thrown if it is undefined, so an optional chain here would quietly say the
       guard might not hold. */
    const requested = storyGlobals.viewport?.value;
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

    await activePage.setViewportSize(size);
  },

  /**
   * After a failing story, wait for its render to finish before the next one starts.
   *
   * The runner reports a play failure the moment `playFunctionThrewException`
   * fires, but Storybook is not done with that story yet: it still runs the
   * `completing` and `afterEach` phases (the a11y scan) and only then emits
   * `storyFinished`. Two things went wrong when the next story was requested
   * in that window:
   *
   *   - The late `storyFinished` of the failed story resolved the NEXT story's
   *     test, which then passed without its play function being checked.
   *   - `StoryRender.teardown` found the old render still in `afterEach` and
   *     reloaded the whole preview, so the next one or two stories in the file
   *     died on a destroyed page and timed out.
   *
   * A passing story never needs this: the runner already waits for its
   * `storyFinished`.
   */
  async postVisit(page, context) {
    if (!context.hasFailure) return;
    await waitForRenderToFinish(page);
  },
};

export default config;
