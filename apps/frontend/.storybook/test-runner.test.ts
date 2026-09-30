import { getStoryContext } from '@storybook/test-runner';
import config from './test-runner';

declare global {
  var context: unknown;
  var page: unknown;
  var __sbSetupPage: jest.Mock;
}

jest.mock('@storybook/test-runner', () => ({
  getStoryContext: jest.fn().mockResolvedValue({ storyGlobals: {} }),
}));

const mockedGetStoryContext = jest.mocked(getStoryContext);

describe('Storybook runner page recovery', () => {
  const page = {
    close: jest.fn(),
    evaluate: jest.fn(),
    setViewportSize: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    page.setViewportSize.mockResolvedValue(undefined);
    mockedGetStoryContext.mockResolvedValue({ storyGlobals: {} } as never);
    globalThis.__sbSetupPage = jest.fn();
    globalThis.context = undefined;
    globalThis.page = undefined;
  });

  it('does not reset a healthy page', async () => {
    // Must-NOT-fire arm: a healthy page must be left alone; resetting it would
    // make every passing story pay for a replacement page it does not need.
    page.evaluate.mockResolvedValue(true);
    await config.preVisit?.(page as never, { id: 'healthy' } as never);

    expect(globalThis.__sbSetupPage).not.toHaveBeenCalled();
    expect(mockedGetStoryContext).toHaveBeenCalledWith(page, expect.anything());
  });

  it('resets and re-injects before reading context on a dead page', async () => {
    // The absence of a hang here is load-bearing: this fixture models the no-timeout
    // cascade class. If recovery becomes hang-gated, do not add a hang to make it pass.
    page.evaluate.mockResolvedValue(false);
    const setupPage = jest.fn(async (candidate) => {
      expect(globalThis.page).not.toBe(candidate);
    });
    const replacement = {
      close: jest.fn().mockResolvedValue(undefined),
      setViewportSize: jest.fn().mockResolvedValue(undefined),
    };
    globalThis.page = page as never;
    const context = { newPage: jest.fn().mockResolvedValue(replacement) };
    globalThis.context = context;
    globalThis.__sbSetupPage = setupPage as never;

    await config.preVisit?.(page as never, { id: 'recovered' } as never);

    expect(context.newPage).toHaveBeenCalledTimes(1);
    expect(setupPage).toHaveBeenCalledWith(replacement, context);
    expect(page.close).toHaveBeenCalledTimes(1);
    expect(mockedGetStoryContext).toHaveBeenCalled();
  });

  it('recovers when checking a closed page throws', async () => {
    page.evaluate.mockRejectedValue(new Error('page closed'));
    const replacement = {
      close: jest.fn().mockResolvedValue(undefined),
      setViewportSize: jest.fn().mockResolvedValue(undefined),
    };
    const context = { newPage: jest.fn().mockResolvedValue(replacement) };
    globalThis.page = page as never;
    globalThis.context = context;

    await config.preVisit?.(page as never, { id: 'closed' } as never);

    expect(context.newPage).toHaveBeenCalledTimes(1);
    expect(globalThis.__sbSetupPage).toHaveBeenCalledWith(replacement, context);
    expect(page.close).toHaveBeenCalledTimes(1);
  });
});

describe('Storybook runner after a failing story', () => {
  const makePage = () => ({ waitForFunction: jest.fn().mockResolvedValue(undefined) });

  /** Runs the predicate handed to `waitForFunction` against a given render phase. */
  const settledAt = (page: ReturnType<typeof makePage>, phase: string | undefined) => {
    const [predicate, settled] = page.waitForFunction.mock.calls[0];
    const previous = (globalThis as Record<string, unknown>).__STORYBOOK_PREVIEW__;
    (globalThis as Record<string, unknown>).__STORYBOOK_PREVIEW__ = {
      currentRender: phase === undefined ? undefined : { phase },
    };
    try {
      return predicate(settled);
    } finally {
      (globalThis as Record<string, unknown>).__STORYBOOK_PREVIEW__ = previous;
    }
  };

  it('leaves a passing story alone', async () => {
    const page = makePage();
    await config.postVisit?.(page as never, { id: 'passed' } as never);

    expect(page.waitForFunction).not.toHaveBeenCalled();
  });

  it('waits for the failed story to finish rendering before the next one starts', async () => {
    const page = makePage();
    await config.postVisit?.(page as never, { id: 'failed', hasFailure: true } as never);

    expect(page.waitForFunction).toHaveBeenCalledTimes(1);
    // Bounded well inside the 15s per-story timeout, so a late failure keeps its own error.
    expect(page.waitForFunction.mock.calls[0][2]).toEqual({ timeout: 5_000 });
    // Still inside the render: the next story must not be requested yet.
    for (const phase of ['errored', 'completing', 'completed', 'afterEach', 'playing']) {
      expect(settledAt(page, phase)).toBe(false);
    }
    // Done, or nothing rendering at all.
    expect(settledAt(page, 'finished')).toBe(true);
    expect(settledAt(page, 'aborted')).toBe(true);
    expect(settledAt(page, undefined)).toBe(true);
  });

  it('keeps the story failure when the render never settles', async () => {
    const page = makePage();
    page.waitForFunction.mockRejectedValue(new Error('Timeout 10000ms exceeded'));

    await expect(
      config.postVisit?.(page as never, { id: 'stuck', hasFailure: true } as never)
    ).resolves.toBeUndefined();
  });
});
