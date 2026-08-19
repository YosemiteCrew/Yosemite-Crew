import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { useAuthStore } from '@/app/stores/authStore';
import VerifyEmail from './VerifyEmail';

type VerifyResult = 'OK' | 'INVALID_TOKEN';

/**
 * Swaps the two auth-store actions this page reaches for and puts the originals
 * back on unmount. Seeding the real zustand store rather than mocking a module is
 * what keeps the component under review the shipped one: the page calls
 * `useAuthStore.getState().verifyEmail()` inside its mount effect, so the state has
 * to be in place before the story renders - which is exactly when `beforeEach` runs.
 *
 * `verifyEmail` is the only input this page has. There is no prop and no route
 * param: SuperTokens reads the token out of `globalThis.location`, so the three
 * states below are unreachable in Storybook by any other means, which is why none
 * of them had ever been drawn.
 */
const withVerifyResult = (verifyEmail: () => Promise<VerifyResult>) => {
  return () => {
    const { verifyEmail: previousVerify, checkSession: previousSession } = useAuthStore.getState();
    useAuthStore.setState({
      verifyEmail,
      // Only reached from Continue. Returning null sends the page to /signin
      // through the router mock instead of `provisionPendingSignUpUser`, so no
      // story here touches the API.
      checkSession: () => Promise.resolve(null),
    });
    return () =>
      useAuthStore.setState({ verifyEmail: previousVerify, checkSession: previousSession });
  };
};

// A promise that never settles - the page has no other way to hold `verifying`,
// since the state is left behind the moment the SDK answers either way.
const withPendingVerification = withVerifyResult(() => new Promise<VerifyResult>(() => undefined));
const withVerifiedEmail = withVerifyResult(() => Promise.resolve('OK'));
const withExpiredLink = withVerifyResult(() => Promise.resolve('INVALID_TOKEN'));

const meta = {
  title: 'Auth/VerifyEmail',
  component: VerifyEmail,
  parameters: {
    layout: 'fullscreen',
    /* Unlike the four AuthShell pages, nothing on this route carries
       `data-yc-app` in the app - it is a public page with no product shell - so
       `body:has([data-yc-app])` does not match there and the marketing inks are
       the correct ones. Without this the preview decorator would stamp the
       marker on its own wrapper and Storybook would review the page against the
       PIMS-scoped values it never gets in production. */
    surface: 'marketing',
    // Both the success and the failure paths route: Continue replaces the current
    // entry, so the App Router mock has to be mounted.
    nextjs: { appDirectory: true, navigation: { pathname: '/verify-email' } },
    docs: {
      description: {
        component:
          'The landing page for the emailed verification link, and one of the few screens in the ' +
          'product that is entirely asynchronous: it takes no props, reads no route params, and ' +
          'decides what to draw from a single SuperTokens call fired in a mount effect. The token ' +
          'lives in the URL and the SDK reads it from there.\n\n' +
          'That single call gives three terminal states, all of them below. The `verifying` state ' +
          'is a real state, not a flash - it holds for as long as the round trip takes and is ' +
          'what a user on a slow connection actually looks at - but it is also the hardest to ' +
          'catch, because it ends by definition.\n\n' +
          'Unlike the rest of the auth flow this page does not use `AuthShell`. It paints a ' +
          'centred 450px card on the marketing background image, with its own typography scale ' +
          '(`text-display-2`) - so it is worth comparing side by side with the sign-in stories ' +
          'rather than assumed to match them.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VerifyEmail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verifying: Story = {
  name: 'Verifying',
  beforeEach: withPendingVerification,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const loader = await canvas.findByTestId('verify-email-loader');
    await expect(loader).toHaveAttribute('aria-label', 'Verifying your email...');
    /* `fullscreen-translucent`, not `inline`: the loader is fixed to the viewport
       with a blurred scrim over the whole page, so the card underneath is visible
       but unreachable. Reading the computed position is the only way to tell the
       two variants apart - they render identical markup. */
    await expect(getComputedStyle(loader).position).toBe('fixed');

    // The card behind the scrim carries its own copy of the same state.
    await expect(canvas.getByRole('heading', { name: 'Verifying...' })).toBeInTheDocument();
    await expect(
      canvas.getByText('Please wait while we verify your email address.')
    ).toBeInTheDocument();

    // Neither outcome has leaked in.
    await expect(canvas.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('heading', { name: 'Verification link expired' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the page opens in, held here by a verification that never resolves. Two ' +
          'things are on screen at once: the fixed translucent loader and, under it, the card ' +
          'reading "Verifying...". They are separate elements with separate copy, so a change to ' +
          'one leaves the other saying something slightly different.',
      },
    },
  },
};

export const Verified: Story = {
  name: 'Email verified',
  beforeEach: withVerifiedEmail,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const heading = await canvas.findByRole('heading', { name: 'Email verified' });
    await expect(
      canvas.getByText(
        'Your email address has been verified. You can now continue to your account.'
      )
    ).toBeInTheDocument();

    // The loader is unmounted, not hidden - `verifying` is gone for good.
    await expect(canvas.queryByTestId('verify-email-loader')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'Verifying...' })).not.toBeInTheDocument();

    /* 450px, from `w-112.5` on Tailwind's dynamic spacing scale (112.5 x 0.25rem).
       Measured off the box rather than the computed width because the card has a
       1px border on every side, which the content box would report short - and an
       undefined utility here would resolve to no rule at all and let the card
       shrink to its content. */
    const card = heading.closest('.rounded-3xl') as HTMLElement;
    await expect(Math.round(card.getBoundingClientRect().width)).toBe(450);

    /* `href="#"` with an onClick, so `BaseButton` takes its BUTTON branch rather
       than rendering a next/link - which is what makes the label swap below
       possible at all. */
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await expect(canvas.queryByRole('link', { name: 'Continue' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The success card. Continue is a full-width primary pill; where it leads is decided ' +
          'after the click, by `resolvePostAuthRedirect` reading the role off the session, so ' +
          'nothing on screen names a destination.',
      },
    },
  },
};

export const Continuing: Story = {
  name: 'Continuing (redirecting)',
  beforeEach: withVerifiedEmail,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Continue' }));

    /* The label is the entire feedback for a step that can take a session check, a
       provisioning call and a route resolve. `isContinuing` is never set back to
       false - by design, since every branch of `handleContinue` ends in a
       navigation - so this state is terminal and the button stays inert-looking
       until the route changes under it. */
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Redirecting...' })).toBeInTheDocument();
    });
    await expect(canvas.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Email verified' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'After Continue is pressed, with the session check answering "no session" - the case ' +
          'that sends the user to `/signin`. The card does not change; only the pill label does. ' +
          'Note that the button is not disabled, it is guarded by the `isContinuing` flag inside ' +
          'the handler, so a second click is swallowed rather than blocked.',
      },
    },
  },
};

export const LinkExpired: Story = {
  name: 'Verification link expired',
  beforeEach: withExpiredLink,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const heading = await canvas.findByRole('heading', { name: 'Verification link expired' });
    await expect(
      canvas.getByText(
        'This verification link is invalid or has expired. Sign in to request a new verification link.'
      )
    ).toBeInTheDocument();

    /* The same 450px card as the success state, not a narrower error variant:
       `w-112.5` (112.5 x 0.25rem) is on the one card element and all three
       states are drawn inside it. Measured off the box because the card has a
       1px border on every side, and asserted because an undefined utility here
       would resolve to NO rule at all and let the card shrink to its content -
       which reads as a deliberate design, not as a missing class. */
    const card = heading.closest('.rounded-3xl') as HTMLElement;
    await expect(Math.round(card.getBoundingClientRect().width)).toBe(450);

    // Exactly one way out. The expired state offers no retry at all, so a second
    // control appearing here would be a real change, not a cosmetic one.
    await expect(within(card).getAllByRole('link')).toHaveLength(1);
    await expect(within(card).queryAllByRole('button')).toHaveLength(0);

    /* A LINK, not a button: `Secondary` gets a real href, so `BaseButton` renders
       next/link and the action is middle-clickable and keyboard-navigable like any
       other. The success card's Continue is the opposite branch of the same
       component. */
    const signIn = canvas.getByRole('link', { name: 'Go to sign in' });
    await expect(signIn).toHaveAttribute('href', '/signin');

    await expect(canvas.queryByTestId('verify-email-loader')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A spent or expired token. Both `INVALID_TOKEN` and a thrown error land here, so this ' +
          'one card covers a bad token, a used token and a network failure alike - which is why ' +
          'the copy says "invalid or has expired" rather than picking one.\n\n' +
          'There is no retry: a fresh link can only come from signing in again, so the single ' +
          'action is a secondary pill to `/signin`.',
      },
    },
  },
};
