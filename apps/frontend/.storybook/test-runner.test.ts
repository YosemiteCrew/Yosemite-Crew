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
