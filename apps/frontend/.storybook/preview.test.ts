import { sb } from 'storybook/test';

import * as githubOAuth from '../src/app/features/auth/lib/githubOAuth';
import * as authClient from '../src/app/lib/authClient';
import * as featureFlags from '../src/app/lib/featureFlags';

jest.mock('storybook/test', () => ({ sb: { mock: jest.fn() } }));
jest.mock('./offline-guard', () => ({ installOfflineGuard: jest.fn() }));

/**
 * The static build compiles `process.env` to a separate empty object in every
 * module, so a story that sets an env value never reaches the module reading
 * it. Those modules have to be spied in the preview for a story to answer them.
 */
describe('Storybook preview module mocks', () => {
  let calls: Parameters<typeof sb.mock>[];
  let modules: Record<string, unknown>[];

  // The preview registers its mocks once, at import, so they are read once.
  beforeAll(async () => {
    await import('./preview');
    calls = [...jest.mocked(sb.mock).mock.calls];
    modules = await Promise.all(
      calls.map(([module]) => module as unknown as Promise<Record<string, unknown>>)
    );
  });

  it('keeps every export real until a story overrides it', () => {
    for (const [, options] of calls) expect(options).toEqual({ spy: true });
  });

  it.each([
    ['the GitHub sign-in flag', githubOAuth.isGithubSignInEnabled],
    ['the auth client', authClient.initAuthClient],
    ['the companion revamp flag', featureFlags.isCompanionRevampEnabled],
  ])('spies the module behind %s', (_label, exported) => {
    expect(modules.some((module) => Object.values(module).includes(exported))).toBe(true);
  });
});
