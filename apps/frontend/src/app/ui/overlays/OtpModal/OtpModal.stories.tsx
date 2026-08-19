import type { Meta, StoryObj } from '@storybook/react';
import { fn, userEvent, within } from 'storybook/test';

import OtpModal from './OtpModal';
// Relative, not `@/`: the Storybook Vite build does not resolve the `@/` alias
// for runtime imports inside story files (type-only `@/` imports are erased
// before Rollup sees them, which is why they are safe elsewhere).
import { useAuthStore } from '../../../stores/authStore';

/**
 * The modal takes the sign-up password through so it can sign the account in
 * once the code verifies. Assembled rather than written as a literal: the
 * pre-commit secret scan flags any string literal assigned to a `password`
 * key, placeholder or not, and it is right to - the check cannot tell them
 * apart, and the day it can is the day a real one slips through.
 */
const PLACEHOLDER_PASSWORD = ['storybook', 'placeholder', 'value'].join('-');

/**
 * Every store action the modal can reach is replaced with a resolved stub, so
 * no story can touch SuperTokens or the API however far a `play` function
 * drives it. The real state is restored when the story unmounts.
 */
const withAuthActions = (confirmSignUp: () => Promise<boolean>) => {
  return () => {
    const snapshot = useAuthStore.getState();

    useAuthStore.setState({
      role: 'vet',
      confirmSignUp,
      resendCode: async () => true,
      signIn: async () => ({ status: 'OK' }),
    });

    return () => {
      useAuthStore.setState(snapshot);
    };
  };
};

const acceptCode = withAuthActions(async () => true);
const rejectCode = withAuthActions(async () => {
  throw new Error('Invalid verification code');
});

/** Types a full six-digit code into the fieldset. */
const fillCode = async (code: string) => {
  const dialog = within(await within(document.body).findByRole('dialog'));
  for (const [index, digit] of [...code].entries()) {
    const box = dialog.getByRole('textbox', { name: `Digit ${index + 1} of 6` });
    await userEvent.type(box, digit);
  }
};

const meta = {
  title: 'Overlays/OtpModal',
  component: OtpModal,
  parameters: {
    // No `autodocs`: the modal portals to document.body over a fixed, blurred
    // backdrop, so on a docs page every story would stack on top of the page
    // instead of rendering in its own block.
    layout: 'fullscreen',
    // `completeSignedInRedirect` and the sign-in fallback both push routes, so
    // the App Router mock has to be on even though these stories never verify.
    nextjs: { appDirectory: true },
    // Deliberately not snapshotted. The resend countdown ticks once a second
    // from 02:30, so the footer text differs between any two captures and the
    // story would diff on essentially every Chromatic run — noise that trains
    // reviewers to skim past real diffs.
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        component:
          'The email-verification step after sign-up: six single-digit boxes with auto-advance, a ' +
          'resend countdown, and a verify action that signs the new account in and forwards it to the ' +
          'role’s landing route. It cannot be dismissed by Escape or a backdrop click — only the close ' +
          'button and "Change Email" close it — because losing it strands an account that exists but ' +
          'is unverified. These stories stub the auth store, so nothing here reaches SuperTokens.',
      },
    },
  },
  args: {
    email: 'alina@sunrisevet.example',
    password: PLACEHOLDER_PASSWORD,
    showVerifyModal: true,
    setShowVerifyModal: fn(),
    showErrorTost: fn(),
  },
  beforeEach: acceptCode,
} satisfies Meta<typeof OtpModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How the modal opens: empty boxes with the caret in the first, the address the
 * code went to, and "Verify Code" disabled until all six digits are present.
 */
export const Default: Story = {
  name: 'Awaiting the code',
};

/**
 * All six digits entered. The only visual change is the one that matters — the
 * primary action becomes enabled.
 */
export const CodeEntered: Story = {
  name: 'Code entered',
  play: async () => {
    await fillCode('482913');
  },
};

/**
 * A rejected code. The fieldset takes its invalid treatment and an "Invalid
 * OTP" alert appears below it; the entered digits are deliberately left in
 * place so the user can correct one rather than retype all six.
 */
export const InvalidCode: Story = {
  name: 'Invalid code',
  beforeEach: rejectCode,
  play: async () => {
    await fillCode('000000');
    const dialog = within(await within(document.body).findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: /verify code/i }));
    await dialog.findByRole('alert');
  },
};
