import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { GithubSignInButton } from './GithubSignInButton';
/* `.yc-btn-ghost` lives in marketing.css, which the (public) ROUTE LAYOUT
   imports and no component does. Storybook never renders that layout, so
   without this line the button draws as a user-agent grey box and the width
   measurement below reads the browser default rather than the design system. */
import '../../marketing/site/marketing.css';

/** The auth form column the button sits in is narrow; the button fills it. */
const COLUMN_WIDTH = 420;

const GITHUB_FLAG = 'NEXT_PUBLIC_AUTH_GITHUB_ENABLED';
const BASE_URL = 'NEXT_PUBLIC_BASE_URL';

/**
 * Restore a `process.env` key to whatever it was, including "absent".
 * Assigning `undefined` is not the same as deleting: it leaves the string
 * `"undefined"` behind, which `isGithubSignInEnabled()` would happily read.
 */
const restoreEnv = (key: string, previous: string | undefined) => () => {
  if (previous === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previous;
  }
};

/**
 * Turn the provider on for one story.
 *
 * `isGithubSignInEnabled()` reads `process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED`,
 * and this app ships no `.env` into Storybook - no `NEXT_PUBLIC_*` key reaches
 * the preview at all, which is why SignIn.stories and SignUp.stories both record
 * that they cannot draw this button. The value is NOT inlined at build time
 * though: the served module still reads `process.env.X` off the writable shim
 * the Next.js vite framework installs, so setting it here is enough and the
 * whole component becomes reviewable.
 */
const withProviderEnabled = () => {
  const previous = process.env[GITHUB_FLAG];
  process.env[GITHUB_FLAG] = 'true';
  return restoreEnv(GITHUB_FLAG, previous);
};

/**
 * The provider enabled AND the authorisation call frozen mid-flight.
 *
 * `startGithubSignIn` only reaches SuperTokens once `initAuthClient()` succeeds,
 * and that needs a parseable `NEXT_PUBLIC_BASE_URL` - so the story supplies an
 * unroutable one and swaps `fetch` for a promise that never settles. That is
 * what holds `pending` open: left alone the call resolves in a microtask and the
 * busy label is gone before the click even returns, so the state could never be
 * seen. Nothing leaves the browser: the invalid host is only ever matched, never
 * contacted.
 *
 * Both globals SuperTokens takes over at init are snapshotted and put back on
 * unmount - it wraps `fetch` and swaps the whole `XMLHttpRequest` constructor
 * for a proxy, and leaving either in place would have every later story in the
 * session making its requests through a session layer pointed at a dead host.
 * What does survive is the SDK's own `initialized` flag, so a story that ran
 * after this one and called `initAuthClient()` would find it already done.
 */
const withFrozenAuthorisationCall = () => {
  const restoreFlag = withProviderEnabled();
  const previousBase = process.env[BASE_URL];
  process.env[BASE_URL] = 'https://auth.storybook.invalid';

  const originalFetch = globalThis.fetch;
  const originalXhr = globalThis.XMLHttpRequest;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('storybook.invalid')) return new Promise<Response>(() => {});
    return originalFetch.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  const restoreBase = restoreEnv(BASE_URL, previousBase);
  return () => {
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXhr;
    restoreBase();
    restoreFlag();
  };
};

const meta = {
  title: 'Auth/GithubSignInButton',
  component: GithubSignInButton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '"Continue with GitHub", under the sign-in and sign-up forms on the developer branch. ' +
          'It renders `null` unless `NEXT_PUBLIC_AUTH_GITHUB_ENABLED` is `true`, so it never ' +
          'shows a dead button against a provider the backend has not been given credentials ' +
          'for - and because no `NEXT_PUBLIC_*` value reaches Storybook, that null was all the ' +
          'page stories could ever show. These stories set the flag on `process.env` themselves ' +
          'and put it back afterwards, so the button, its divider, its helper note and its ' +
          'pending state are all drawn for the first time.\n\n' +
          'Note the divider is part of the component, not the page: when the flag is off the ' +
          '"or" rule has to disappear with the button, or the form ends in a rule leading to ' +
          'nothing.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div data-kit-shell style={{ maxWidth: COLUMN_WIDTH }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: withProviderEnabled,
} satisfies Meta<typeof GithubSignInButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Enabled, idle',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Continue with GitHub' });

    await expect(button).toBeEnabled();
    /* The name above is queried as EXACTLY the label, which only holds while the
       mark stays `aria-hidden`. Drop that and the button announces itself as the
       label plus whatever react-icons emits into the accessible name. */
    await expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // `width: 100%` with `boxSizing: border-box`, against 20px of side padding.
    await expect(button.getBoundingClientRect().width).toBeCloseTo(COLUMN_WIDTH, 0);

    /* The two hairlines either side of "or" are `flex: 1` each. Equal widths is
       the relation that matters - a lopsided divider is the visible symptom of
       one of them picking up an intrinsic width, and it holds at any column
       width. The count is asserted first so a third rule cannot slip in and
       leave the comparison quietly measuring the wrong pair. */
    const rules = canvasElement.querySelectorAll('span[style*="flex: 1"]');
    await expect(rules).toHaveLength(2);
    await expect(rules[0].getBoundingClientRect().width).toBeCloseTo(
      rules[1].getBoundingClientRect().width,
      0
    );

    // No note prop, no note line: the helper text is opt-in per call site.
    await expect(
      canvas.queryByText('GitHub is available for developer accounts.')
    ).not.toBeInTheDocument();
  },
};

export const WithNote: Story = {
  name: 'With the helper note',
  args: { note: 'GitHub is available for developer accounts.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Continue with GitHub' });
    const note = canvas.getByText('GitHub is available for developer accounts.');

    /* A sibling under the button, not part of it. If the note ever moved inside
       the button the caption would be read out as part of the action and the
       accessible name would stop being "Continue with GitHub". */
    await expect(button.contains(note)).toBe(false);
    await expect(note.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      button.getBoundingClientRect().bottom
    );
  },
};

export const Pending: Story = {
  name: 'Pending, after the click',
  beforeEach: withFrozenAuthorisationCall,
  parameters: {
    docs: {
      story: { height: '220px' },
      description: {
        story:
          'What the user sees for the second between the click and the browser leaving for ' +
          'github.com. The authorisation request is frozen by the story rather than mocked out, ' +
          'so this is the real `pending` branch: label swapped, button disabled.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Continue with GitHub' }));

    /* Both halves. The caption is what a sighted user reads; `disabled` is what
       stops a second authorisation request being started over the first, and a
       button that only swapped its caption would look entirely correct. */
    const busy = await canvas.findByRole('button', { name: 'Redirecting to GitHub...' });
    await expect(busy).toBeDisabled();
    await expect(
      canvas.queryByRole('button', { name: 'Continue with GitHub' })
    ).not.toBeInTheDocument();
  },
};

export const ProviderDisabled: Story = {
  name: 'Provider flag off',
  beforeEach: () => {
    const previous = process.env[GITHUB_FLAG];
    delete process.env[GITHUB_FLAG];
    return restoreEnv(GITHUB_FLAG, previous);
  },
  play: async ({ canvasElement }) => {
    const shell = canvasElement.querySelector('[data-kit-shell]') as HTMLElement;

    /* Zero elements, not "no button". The divider and the note are siblings of
       the button rather than children of it, so a guard that returned early from
       the button alone would leave an "or" rule and a caption hanging under the
       form with nothing between them. */
    await expect(shell.childElementCount).toBe(0);
  },
};

export const Phone: Story = {
  name: 'Phone: full width at 375',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { note: 'GitHub is available for developer accounts.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const shell = canvasElement.querySelector('[data-kit-shell]') as HTMLElement;
    const button = canvas.getByRole('button', { name: 'Continue with GitHub' });

    /* `width: 100%` with 20px of horizontal padding: without `boxSizing:
       border-box` the button overhangs its column by 40px, which is invisible on
       a laptop canvas and obvious as a scrolling page here. */
    await expect(button.getBoundingClientRect().width).toBeCloseTo(
      shell.getBoundingClientRect().width,
      0
    );
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
