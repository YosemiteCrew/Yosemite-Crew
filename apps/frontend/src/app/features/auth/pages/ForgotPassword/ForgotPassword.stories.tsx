import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { setJsonStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { useAuthStore } from '@/app/stores/authStore';
import ForgotPassword from './ForgotPassword';
/* Not decoration. `.yc-field`, `.yc-lbl`, `.yc-switch` and `.yc-btn-primary` live in
   marketing.css, which is imported by the (public) ROUTE LAYOUT rather than by any
   component, and Storybook never renders that layout. Without this line the page
   draws a user-agent text input and an unstyled submit. */
import '../../../marketing/site/marketing.css';
import { STATS_CACHE_KEY, STATS_TS_KEY } from '@/app/features/marketing/site/useGithubStats';

/**
 * Typed with a trailing space on purpose, but NOT for the reason it looks like.
 * The field is `type="email"`, and the HTML value sanitization algorithm for that
 * state strips leading and trailing whitespace before the value is ever readable
 * - so `input.value` is already trimmed by the time React's `onChange` sees it.
 * The space therefore never reaches `normalizeEmail`, and the trimmed address on
 * the confirmation panel is NOT evidence that `normalizeEmail` ran. Both facts
 * are asserted below rather than described, because assuming the opposite is
 * exactly what made these stories wrong.
 */
const TYPED_EMAIL = 'lena.weber@sunrisevet.example ';
const NORMALIZED_EMAIL = 'lena.weber@sunrisevet.example';

/**
 * The confirmation sentence, written once and asserted from both the resolved
 * and the rejected story. One constant rather than two copies on purpose: the
 * guarantee under review is that those two code paths are indistinguishable, and
 * two literals could drift apart without either story failing.
 */
const SENT_COPY =
  `If an account exists for ${NORMALIZED_EMAIL}, we have sent a link to reset your password. ` +
  'It expires soon, so use it while it is fresh.';

/**
 * Seeds the marketing-stats session cache that the auth brand panel reads through
 * `useGithubStats`. The hook returns before fetching while the cache is inside its
 * 5 minute TTL and already holds a `discord` string, so seeding it keeps the mount
 * off `/api/community/*` - which under Storybook is a 404 - and pins the star pill
 * to a fixed number instead of one that differs between two Chromatic runs.
 */
const seedGithubStats = () => {
  setJsonStorageItem('session', STATS_CACHE_KEY, {
    stars: '2.4k',
    starsFull: '2,431',
    repositoryClones: '67,134',
    contributors: '38',
    discord: '1,204',
  });
  setStorageItem('session', STATS_TS_KEY, String(Date.now()));
};

/**
 * Replaces the store's own `forgotPassword` and restores it on unmount. The page
 * pulls the action straight off the real zustand store, so this one swap is the
 * whole seam: no module mock, no request, and the component being reviewed is the
 * shipped one.
 */
const withForgotPassword = (forgotPassword: () => Promise<{ status: 'OK' } | null>) => {
  return () => {
    const previous = useAuthStore.getState().forgotPassword;
    useAuthStore.setState({ forgotPassword });
    return () => useAuthStore.setState({ forgotPassword: previous });
  };
};

const withSuccessfulSend = withForgotPassword(() => Promise.resolve({ status: 'OK' }));

/**
 * SuperTokens' account-takeover protection. It is a REJECTION, not a resolution,
 * and the page has to treat it exactly like a send - so this story exists to prove
 * the two produce the same pixels.
 */
const withBlockedSend = withForgotPassword(() =>
  Promise.reject(
    Object.assign(new Error('Password reset is not allowed for this account'), {
      code: 'PASSWORD_RESET_NOT_ALLOWED',
    })
  )
);

/** Types the address and submits, leaving the confirmation panel on screen. */
const requestResetLink = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const field = canvas.getByRole('textbox', { name: 'Work email' });
  await userEvent.type(field, TYPED_EMAIL);

  /* The trailing space is already gone, before anything of ours has run. This is
     the `type="email"` value sanitization algorithm, not `normalizeEmail`: the
     input strips leading and trailing whitespace as the value is set, so the
     controlled state React stores is the trimmed string. Pinned here so the
     panel's trimmed address is never mistaken for proof that our own
     normalisation is wired up - it would read identically if it were not. */
  await expect(field).toHaveValue(NORMALIZED_EMAIL);

  await userEvent.click(canvas.getByRole('button', { name: 'Send reset link' }));
};

/**
 * Every visible property of the confirmation panel, asserted the same way from
 * both stories that can produce it. Anything that is only checked in one of them
 * is a place the two paths are free to diverge.
 */
const assertConfirmationPanel = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const panel = await canvas.findByTestId('forgot-sent');

  // Badge: 52px square, read off the box rather than the content box, which
  // would report short the moment anyone gives this pill a border.
  const badge = panel.firstElementChild as HTMLElement;
  await expect(badge.getBoundingClientRect().width).toBe(52);
  await expect(badge.getBoundingClientRect().height).toBe(52);

  await expect(canvas.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();

  /* The address is the trimmed one - though the input had already trimmed it (see
     `requestResetLink`), so this is a pin on what the panel echoes back, not on
     `normalizeEmail`. Asserting the tag as well as the text pins the emphasis:
     the address is the one bolded thing in an otherwise hedged sentence. */
  const address = within(panel).getByText(NORMALIZED_EMAIL);
  await expect(address.tagName).toBe('STRONG');

  /* The neutrality is the feature. This exact sentence - conditional, no claim
     that an account was found - is what stops the page being an
     account-existence oracle, so both stories assert the whole of it rather than
     that "some copy appeared". */
  await expect(address.parentElement as HTMLElement).toHaveTextContent(SENT_COPY);

  // The form is replaced outright, not hidden behind the panel.
  await expect(canvas.queryByRole('textbox', { name: 'Work email' })).not.toBeInTheDocument();
  await expect(canvas.queryByRole('button', { name: 'Send reset link' })).not.toBeInTheDocument();
  /* Polled, not read once. `AuthShell` animates its whole form column in with
     `ycUp 0.75s ... 0.12s both`, and `both` means the fill state applies during
     the DELAY too - so for the first 120ms after mount the wrapper's computed
     opacity is exactly `0` and jest-dom calls every descendant invisible.
     `getByRole` does not look at opacity, so the button is FOUND and then
     reported hidden, which is why this passed alone and failed under a parallel
     run. `waitFor` settles the entrance instead of dropping the assertion. */
  const retry = within(panel).getByRole('button', { name: 'try another email' });
  await waitFor(() => expect(retry).toBeVisible());
};

const meta = {
  title: 'Auth/ForgotPassword',
  component: ForgotPassword,
  parameters: {
    layout: 'fullscreen',
    /* Stops the preview decorator stamping a SECOND `data-yc-app` around the
       whole canvas. AuthShell already puts that marker on the form column and
       deliberately leaves the dark brand panel outside it -
       `body:has([data-yc-app])` still matches, because the shell supplies its
       own, so the scoped inks resolve exactly as they do in the app. */
    surface: 'marketing',
    // The shell's logo, "Back to home" and "Sign in" are all next/link.
    nextjs: { appDirectory: true, navigation: { pathname: '/forgot-password' } },
    docs: {
      description: {
        component:
          'Step one of the reset: collect an address, ask SuperTokens to email a tokenized link, ' +
          'and say so. The new password is set on `/reset-password`, so this page never asks for ' +
          'a code or a password itself.\n\n' +
          'The confirmation panel is the interesting half and it had never been drawn. Its copy ' +
          'is deliberately conditional - **"If an account exists for..."** - because ' +
          '`sendPasswordResetEmail` resolves the same way for an address that has no account. ' +
          'Saying "we sent you an email" would turn this form into an account-existence oracle: ' +
          'anyone could test addresses one at a time and read the answer off the screen.\n\n' +
          'The same reasoning explains the odd-looking `catch` in `handleSubmit`. ' +
          '`PASSWORD_RESET_NOT_ALLOWED` is a rejection, and it means the account exists but is ' +
          'protected - so it is caught and turned into the identical confirmation rather than ' +
          'surfaced. Two stories below drive those two different code paths and assert the same ' +
          'panel comes out, which is the only way that guarantee can be reviewed rather than ' +
          'taken on trust.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => {
    seedGithubStats();
  },
} satisfies Meta<typeof ForgotPassword>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Request a link',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    await expect(
      canvas.getByText('Enter the email you sign in with and we will send you a reset link.')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Work email' })).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
    await expect(canvas.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/signin'
    );
    await expect(canvas.queryByTestId('forgot-sent')).not.toBeInTheDocument();

    /* Same shell as sign-in: two tracks, two children, brand column wider
       (`1.06fr 1fr`). Both counts, because the 940px rule that collapses this to
       one track only HIDES the brand panel - it stays mounted, so a child count
       on its own says nothing about which layout is on screen. */
    const grid = canvasElement.querySelector('[data-authgrid]') as HTMLElement;
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(2);
    await expect(grid.children).toHaveLength(2);
    await expect(parseFloat(tracks[0])).toBeGreaterThan(parseFloat(tracks[1]));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The single-field form. One address, one button, and a way back to sign-in for the user ' +
          'who arrived here by mistake.',
      },
    },
  },
};

export const CheckYourEmail: Story = {
  name: 'Check your email',
  beforeEach: withSuccessfulSend,
  play: async ({ canvasElement }) => {
    await requestResetLink(canvasElement);
    await assertConfirmationPanel(canvasElement);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel after a successful send. Green badge, "Check your email", and the address in ' +
          'bold inside a sentence that never confirms the account exists.\n\n' +
          'One token to watch here: the badge is `var(--success-soft, #e7f4ec)` on ' +
          '`var(--success, #2f9e63)`, and **`--success-soft` is not defined anywhere in ' +
          '`globals.css`**. The fallback hex is therefore what always paints, in both themes - ' +
          'switch the toolbar to dark and the badge stays the light mint while everything around ' +
          'it goes espresso. `--success` does resolve, so only the fill is stranded.',
      },
    },
  },
};

export const BlockedSendLooksIdentical: Story = {
  name: 'Blocked send (identical panel)',
  beforeEach: withBlockedSend,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await requestResetLink(canvasElement);

    /* The SAME assertions the resolved story runs - badge geometry, heading,
       bolded trimmed address, the whole sentence, the form gone - driven here by
       a REJECTED call. Sharing the helper rather than re-checking a subset is
       the point: anything asserted in only one of the two stories is a place the
       success and blocked paths are free to diverge unnoticed, and any
       divergence leaks whether the address is registered. */
    await assertConfirmationPanel(canvasElement);

    // And nothing extra: no toast, and the SuperTokens reason never reaches the
    // page. Either would answer the question the panel exists to refuse.
    await expect(
      canvas.queryByText('We could not send the reset email. Please try again.')
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText('Password reset is not allowed for this account')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`PASSWORD_RESET_NOT_ALLOWED` - SuperTokens refusing the reset on an account it is ' +
          'protecting. It arrives as a rejection with a `reason` that would tell an attacker the ' +
          'account exists, so the reason is dropped on the floor and the confirmation is shown ' +
          'instead. Read this story against the one above: they take different code paths and ' +
          'have to be indistinguishable.',
      },
    },
  },
};

export const TryAnotherEmail: Story = {
  name: 'Try another email',
  beforeEach: withSuccessfulSend,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await requestResetLink(canvasElement);

    const panel = await canvas.findByTestId('forgot-sent');
    await userEvent.click(within(panel).getByRole('button', { name: 'try another email' }));

    const field = await canvas.findByRole('textbox', { name: 'Work email' });
    await expect(canvas.queryByTestId('forgot-sent')).not.toBeInTheDocument();

    /* The reset clears `sentTo` and `isSubmitting` and nothing else, so the field
       comes back holding exactly what the form state held - which is the trimmed
       address, because `type="email"` sanitized the trailing space away at the
       keystroke. "Try another email" leaves the last address in place for the
       user to edit rather than starting from empty. */
    await expect(field).toHaveValue(NORMALIZED_EMAIL);

    /* And the button is live again. `setIsSubmitting(false)` in that same handler
       is the only thing preventing a form that returns stuck on a disabled
       "Sending..." - the success path never resets it, because it never expected
       to come back. */
    await expect(canvas.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The way back from the confirmation, offered in the footnote under it. It is a plain ' +
          'button styled as a link inside the "Did not get it? Check spam" line, so a user who ' +
          'typed the wrong address does not have to reload the page to correct it.\n\n' +
          'The field comes back holding the address **without** the trailing space that was ' +
          'typed. That is the `type="email"` value sanitization algorithm, which strips leading ' +
          'and trailing whitespace as the value is set - `normalizeEmail` never sees the space, ' +
          'and the trimmed address on the panel above would look the same if that call were ' +
          'deleted.',
      },
    },
  },
};
