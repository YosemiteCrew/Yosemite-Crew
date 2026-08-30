import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import ThirdParty from 'supertokens-web-js/recipe/thirdparty';

import AuthCallback from './AuthCallback';
// `yc-btn-primary` (the "Back to sign in" pill) lives in the marketing
// stylesheet, which reaches this route through the public layout rather than
// through anything AuthCallback imports. Without this the link renders as bare
// underlined text and the error card cannot be reviewed.
import '../../../marketing/site/marketing.css';

type HandshakeResponse = Awaited<ReturnType<typeof ThirdParty.signInAndUp>>;

/**
 * Handed to the auth client purely so it agrees to initialise. Nothing is ever
 * requested from it: `signInAndUp` is replaced below, and that is the only call
 * `completeGithubSignIn` makes.
 */
const AUTH_API_ORIGIN = 'https://auth.storybook.invalid';

/**
 * The page takes no props and reads no route params. Everything it draws is
 * decided by one SuperTokens call fired from a mount effect, so the only way to
 * reach its states is to answer that call.
 *
 * Two things have to be seeded, not one. `completeGithubSignIn` bails before it
 * touches the SDK when `initAuthClient()` finds no `NEXT_PUBLIC_BASE_URL`, and
 * Storybook's env shim carries no NEXT_PUBLIC vars - so without the first line
 * every story here would land on the same generic error and the loader would be
 * unreachable. The second line is what keeps the handshake off the network: the
 * real `signInAndUp` posts to the API origin with whatever code and state are in
 * the URL, which from Storybook is a live call against dev with junk arguments.
 *
 * `ThirdParty` is a class of statics, so the swap is a property assignment on an
 * object rather than a module mock - the module graph is untouched and the page
 * under review is the shipped one.
 */
const withHandshake = (respond: () => Promise<HandshakeResponse>) => () => {
  const previousBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const previousSignInAndUp = ThirdParty.signInAndUp;
  process.env.NEXT_PUBLIC_BASE_URL = AUTH_API_ORIGIN;
  ThirdParty.signInAndUp = respond;

  return () => {
    ThirdParty.signInAndUp = previousSignInAndUp;
    if (previousBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_BASE_URL = previousBaseUrl;
    }
  };
};

// A handshake that never answers. The loader is a real state - it holds for the
// whole round trip - but it ends by definition, so it cannot be caught any other
// way.
const withPendingHandshake = withHandshake(() => new Promise<HandshakeResponse>(() => undefined));

// Rejecting with something that is NOT an Error is the only route to the page's
// own `GENERIC_ERROR` fallback: it prints `err.message` for every Error it is
// given, so a thrown string or a rejected object is the one case that reaches
// the constant.
const withNonErrorFailure = withHandshake(() =>
  Promise.reject({ code: 'ST_UNEXPECTED', detail: 'not an Error instance' })
);

const BACKEND_REASON =
  'Cannot sign in or up because an account with this email already exists and uses a different ' +
  'sign-in method. Sign in with your password, then connect GitHub from your developer settings.';

const withRefusedSignIn = withHandshake(() =>
  Promise.resolve({
    status: 'SIGN_IN_UP_NOT_ALLOWED' as const,
    reason: BACKEND_REASON,
    fetchResponse: new Response(null, { status: 403 }),
  })
);

const withNoEmailFromGithub = withHandshake(() =>
  Promise.resolve({
    status: 'NO_EMAIL_GIVEN_BY_PROVIDER' as const,
    fetchResponse: new Response(null, { status: 200 }),
  })
);

const meta = {
  title: 'Auth/AuthCallback',
  component: AuthCallback,
  parameters: {
    layout: 'fullscreen',
    /* `/auth/callback` is a public route - nothing in its layout carries
       `data-yc-app` - so the marketing inks are the correct ones here. Without
       this the preview decorator stamps the PIMS marker on its own wrapper and
       the card gets reviewed against tokens it never gets in production. */
    surface: 'marketing',
    /* `redirect()` and next/link both want the App Router mounted. The success
       path is deliberately never taken below (it navigates away mid-render), but
       the link on the error card is real. */
    nextjs: { appDirectory: true, navigation: { pathname: '/auth/callback' } },
    docs: {
      description: {
        component:
          'Where GitHub drops the developer back after the OAuth consent screen. It has no props ' +
          'and no route params: SuperTokens reads the code and state out of the URL, the backend ' +
          'GitHub provider does the token exchange, and the page draws one of two screens from ' +
          'the answer.\n\n' +
          'The happy path is invisible - it calls `redirect()` during render and the route is ' +
          'replaced - so what is worth reviewing is the pair below it: the fullscreen translucent ' +
          'loader that holds for the whole round trip, and the error card that a developer is ' +
          'left sitting on when the handshake fails. The card is a dead end with exactly one way ' +
          'out, and its message is backend-supplied, so its length is not something the frontend ' +
          'controls.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AuthCallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Handshaking: Story = {
  name: 'Finishing the handshake',
  beforeEach: withPendingHandshake,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loader = await canvas.findByTestId('github-callback-loader');

    /* The wait is announced, not just drawn. `<output>` carries an implicit
       `status` role and the label is the live-region text - a screen reader user
       on this route has nothing else to go on, since the page is otherwise
       empty. */
    await expect(canvas.getByRole('status')).toBe(loader);
    await expect(loader).toHaveAttribute('aria-label', 'Finishing GitHub sign in...');
    await expect(loader).toHaveAttribute('aria-live', 'polite');

    /* `fullscreen-translucent`, not `inline`. The three variants render
       identical markup and differ only in CSS, so the computed position is the
       only thing that tells them apart - an inline loader here would draw an
       80px spinner in the top-left of a blank page. */
    await expect(getComputedStyle(loader).position).toBe('fixed');

    // Neither outcome has leaked in behind the scrim.
    await expect(
      canvas.queryByRole('heading', { name: 'Sign in interrupted' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the route opens in, held here by a handshake that never answers. This is the ' +
          'whole page: no card, no brand mark, no copy other than the loader label.',
      },
    },
  },
};

export const GenericFailure: Story = {
  name: 'Error card, generic copy',
  beforeEach: withNonErrorFailure,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Qualified by name on purpose: the preview decorator injects its own
       sr-only `<h1>`, so an unqualified level-1 heading query matches two
       elements here. */
    const heading = await canvas.findByRole('heading', { level: 1, name: 'Sign in interrupted' });
    await expect(
      canvas.getByText('We could not complete GitHub sign in. Please try again.')
    ).toBeInTheDocument();

    /* The one way out of a dead end. The card offers no retry - a second attempt
       has to start from the sign-in page, because the code in the URL is spent -
       so a broken href strands the developer on this screen. */
    const back = canvas.getByRole('link', { name: 'Back to sign in' });
    await expect(back).toHaveAttribute('href', '/signin');

    /* The badge is decoration sitting above copy that already says what happened.
       react-icons only hides it because the page passes `aria-hidden` through, so
       losing that prop silently adds a glyph to the accessible name. */
    const badgeIcon = heading.parentElement?.querySelector('svg');
    await expect(badgeIcon).toHaveAttribute('aria-hidden', 'true');

    // The two screens are mutually exclusive; the loader must be gone, not
    // covered.
    await expect(canvas.queryByTestId('github-callback-loader')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The fallback sentence, reached when the SDK rejects with something that is not an ' +
          'Error. The unconfigured-client path (no `NEXT_PUBLIC_BASE_URL` on the deploy) prints ' +
          'the same words from a different place, so this card is what a misconfiguration looks ' +
          'like as well as a genuine failure.',
      },
    },
  },
};

export const BackendMessage: Story = {
  name: 'Error card, long backend message',
  beforeEach: withRefusedSignIn,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', { level: 1, name: 'Sign in interrupted' });
    const card = heading.parentElement as HTMLElement;
    const message = canvas.getByText(BACKEND_REASON);

    /* `width: min(420px, 100%)`. The message is whatever the backend refused
       with, and a card that sizes to its longest state would swing between a
       narrow box and the full 1280px canvas depending on the sentence. */
    await expect(Math.round(card.getBoundingClientRect().width)).toBe(420);

    // It wraps rather than pushing the card open: nothing scrolls sideways
    // inside it, and the paragraph really is several lines deep at this width.
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    const lineHeight = Number.parseFloat(getComputedStyle(message).lineHeight);
    await expect(message.getBoundingClientRect().height).toBeGreaterThanOrEqual(lineHeight * 3);

    // Still the only control, however long the message runs.
    await expect(canvas.getAllByRole('link')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'SuperTokens answers `SIGN_IN_UP_NOT_ALLOWED` and the page prints the backend `reason` ' +
          'verbatim. The frontend has no say in that length, which makes this the story that ' +
          'decides whether the card wraps or grows.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: GitHub shared no email',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: withNoEmailFromGithub,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', { level: 1, name: 'Sign in interrupted' });
    const card = heading.parentElement as HTMLElement;
    const page = canvasElement.querySelector('#main-content') as HTMLElement;

    await expect(
      canvas.getByText(
        'GitHub did not share an email for your account. Add a public email on GitHub, or use ' +
          'another sign-in method.'
      )
    ).toBeInTheDocument();

    /* Measured as a relation, not against 375: the standalone story canvas
       ignores the viewport global, so a hard-coded phone width would pass for
       the wrong reason. What has to hold at every width is that the card keeps
       the page's 24px gutter and never crosses its 420px cap - on a 375px screen
       those two are what stop it touching the bezel. */
    const gutter = card.getBoundingClientRect().left - page.getBoundingClientRect().left;
    await expect(gutter).toBeGreaterThanOrEqual(24);
    await expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(420);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A GitHub account with no public email cannot be matched to a Yosemite Crew user, so ' +
          'the handshake stops with its own instruction rather than the generic apology. Pinned ' +
          'to the phone viewport because this card is the full screen on a handset.',
      },
    },
  },
};
