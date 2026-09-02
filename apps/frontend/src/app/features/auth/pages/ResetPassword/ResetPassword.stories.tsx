import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { setJsonStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { useAuthStore } from '@/app/stores/authStore';
import ResetPassword from './ResetPassword';
/* Not decoration. `.yc-field`, `.yc-lbl`, `.yc-btn-primary` and `.yc-btn-ghost` all
   live in marketing.css, which is imported by the (public) ROUTE LAYOUT rather than
   by any component - Storybook never renders that layout. Without this line the two
   stacked actions below are unstyled anchors and the "danger badge, heading, copy,
   two buttons" shape this story exists to review is not what gets drawn. */
import '../../../marketing/site/marketing.css';
import { STATS_CACHE_KEY, STATS_TS_KEY } from '@/app/features/marketing/site/useGithubStats';

/**
 * Says what it is in the value itself, so the secret scanners never have to
 * guess: a plausible-looking password fixture fails the GitGuardian gate, and it
 * is right to - it cannot tell a fixture from a real one.
 *
 * It still has to satisfy the page's own strength regex - lower, upper, digit,
 * one non-word character, 8+ - or `handleSubmit` returns on validation and never
 * reaches `resetPassword`, which is the call this story needs to fail. The
 * trailing `1aA!` is doing that job: `_` alone would not, since it is a word
 * character as far as `(?=.*[^\w\s])` is concerned.
 */
const NEW_PASSWORD = 'EXAMPLE_NOT_A_CREDENTIAL_1aA!';

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
 * Swaps the store's own `resetPassword` for a rejection, and puts the real one back
 * when the story unmounts. The page reads the action out of the real zustand store,
 * so this is the whole seam - no module mock, no MSW, and the component under review
 * is the shipped one rather than a copy wired to a stub.
 *
 * The `code` is what matters. `handleSubmit` only shows the expired panel for
 * `RESET_PASSWORD_INVALID_TOKEN_ERROR`; every other rejection falls through to a
 * toast and leaves the form standing, so a plain `new Error(...)` here would draw
 * the wrong state under the right story name.
 */
const withInvalidToken = () => {
  const { resetPassword } = useAuthStore.getState();
  useAuthStore.setState({
    resetPassword: () =>
      Promise.reject(
        Object.assign(new Error('Reset token is invalid or expired'), {
          code: 'RESET_PASSWORD_INVALID_TOKEN_ERROR',
        })
      ),
  });
  return () => useAuthStore.setState({ resetPassword });
};

/** Fills both fields with a password that clears the strength regex and matches. */
const submitNewPassword = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('New password'), NEW_PASSWORD);
  await userEvent.type(canvas.getByLabelText('Confirm password'), NEW_PASSWORD);
  await userEvent.click(canvas.getByRole('button', { name: 'Reset password' }));
};

const meta = {
  title: 'Auth/ResetPassword',
  component: ResetPassword,
  parameters: {
    layout: 'fullscreen',
    /* Stops the preview decorator stamping a SECOND `data-yc-app` around the
       whole canvas. AuthShell already puts that marker on the form column and
       deliberately leaves the dark brand panel outside it -
       `body:has([data-yc-app])` still matches, because the shell supplies its
       own, so the scoped inks resolve exactly as they do in the app. */
    surface: 'marketing',
    // The success path pushes /signin through useRouter two seconds after the
    // store resolves, so the App Router mock has to be mounted.
    nextjs: { appDirectory: true, navigation: { pathname: '/reset-password' } },
    docs: {
      description: {
        component:
          'The page the emailed reset link lands on. SuperTokens keeps the token in the URL and ' +
          '`submitNewPassword` reads it from there, so the form itself only collects a password ' +
          'twice - it never sees or shows the token.\n\n' +
          'That is why the failure state is a whole panel rather than a field error: by the time ' +
          'the token turns out to be spent or expired the user has already typed a valid ' +
          'password twice, and there is nothing on this page they can correct. `linkInvalid` ' +
          'therefore replaces the form outright with a dead end plus two ways out.\n\n' +
          'It is reachable only through a rejected `resetPassword` call carrying ' +
          '`RESET_PASSWORD_INVALID_TOKEN_ERROR`, which is why it had never been drawn: no prop, ' +
          'no route and no fixture reaches it. The story below gets there by swapping that one ' +
          'action on the real auth store.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => {
    seedGithubStats();
  },
} satisfies Meta<typeof ResetPassword>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Set a new password',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const password = canvas.getByLabelText('New password');
    const confirm = canvas.getByLabelText('Confirm password');

    await expect(canvas.getByRole('heading', { name: 'Set a new password' })).toBeInTheDocument();
    await expect(
      canvas.getByText('Choose a strong password you have not used here before.')
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Reset password' })).toBeEnabled();
    await expect(canvas.queryByTestId('reset-invalid')).not.toBeInTheDocument();

    // Both start masked, and each field owns its own toggle.
    await expect(password).toHaveAttribute('type', 'password');
    await expect(confirm).toHaveAttribute('type', 'password');
    const toggles = canvas.getAllByRole('button', { name: 'Show password' });
    await expect(toggles).toHaveLength(2);

    /* The independence is the thing worth reviewing and it is invisible in the
       markup: `showPassword` and `showConfirm` are two pieces of state, so
       revealing the first field must leave the second masked. A shared flag -
       which is what the sign-up page does - would pass every assertion above
       and fail this one. */
    await userEvent.click(toggles[0]);
    await expect(password).toHaveAttribute('type', 'text');
    await expect(confirm).toHaveAttribute('type', 'password');
    await expect(canvas.getAllByRole('button', { name: 'Show password' })).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    /* Same shell as sign-in: two tracks, two children, brand column wider
       (`1.06fr 1fr`). Both counts, because the 940px rule that collapses this to
       one track only HIDES the brand panel - it stays mounted, so a child count
       on its own says nothing about which layout is on screen. Auth/SignIn's
       phone story is the collapsed reading. */
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
          'The form as the link opens it. Both fields carry their own eye toggle with independent ' +
          'state, so revealing one does not reveal the other - deliberate on a confirm pair, ' +
          'since the point of the second field is that it was typed rather than copied.',
      },
    },
  },
};

export const LinkExpired: Story = {
  name: 'Reset link expired',
  beforeEach: withInvalidToken,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitNewPassword(canvasElement);

    const panel = await canvas.findByTestId('reset-invalid');

    /* The badge is the first thing in the panel and the only danger-tinted element
       on the page. 52px square via getBoundingClientRect, not getComputedStyle:
       the latter reports the content box, which would read short the moment anyone
       gives this pill a border. */
    const badge = panel.firstElementChild as HTMLElement;
    await expect(badge.getBoundingClientRect().width).toBe(52);
    await expect(badge.getBoundingClientRect().height).toBe(52);

    await expect(canvas.getByRole('heading', { name: 'Reset link expired' })).toBeInTheDocument();
    await expect(
      within(panel).getByText(
        'This password reset link is invalid or has expired. Request a new one to continue.'
      )
    ).toBeInTheDocument();

    const request = within(panel).getByRole('link', { name: 'Request new link' });
    const back = within(panel).getByRole('link', { name: 'Back to sign in' });
    await expect(request).toHaveAttribute('href', '/forgot-password');
    await expect(back).toHaveAttribute('href', '/signin');

    /* Stacked and equal, not a side-by-side pair: the column is `flex-direction:
       column` and both actions are `width: 100%` with `box-sizing: border-box`, so
       the ghost button and the primary must measure the same despite one having a
       border and the other not. That equality is the whole reason box-sizing is set
       there, and it is invisible in the markup. */
    const column = request.parentElement as HTMLElement;
    await expect(getComputedStyle(column).flexDirection).toBe('column');
    await expect(request.getBoundingClientRect().width).toBe(back.getBoundingClientRect().width);
    await expect(Math.round(request.getBoundingClientRect().width)).toBe(
      Math.round(column.getBoundingClientRect().width)
    );

    // The form is gone, not merely covered - there is nothing left to resubmit.
    await expect(canvas.queryByLabelText('New password')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a spent or expired link produces after a valid password was already typed twice. ' +
          'The primary action goes back to `/forgot-password` to mint a new link rather than ' +
          'retrying this one, and the ghost action leads to sign-in for the user who has ' +
          'remembered their password in the meantime.\n\n' +
          'Note what does not happen: no toast. The other rejection paths on this page raise ' +
          'one, but an expired link is not a transient error the user can retry through, so it ' +
          'takes over the column instead of floating above it.',
      },
    },
  },
};
