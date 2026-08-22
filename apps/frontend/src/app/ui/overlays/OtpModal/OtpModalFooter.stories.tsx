import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';

import OtpModalFooter from './OtpModalFooter';

// Every rule for this block is scoped under `.VerifyModalSec` in the modal's
// stylesheet, so the story has to load the sheet and reproduce that wrapper.
import './OtpModal.css';

const EMPTY_CODE = ['', '', '', '', '', ''];
const FULL_CODE = ['4', '8', '2', '9', '1', '3'];

const meta = {
  title: 'Overlays/OtpModalFooter',
  component: OtpModalFooter,
  parameters: {
    layout: 'centered',
    // "Request New Code" and "Change Email" are `next/link`s, so the App Router
    // mock has to be on even though neither navigates in these stories.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The action block under the six OTP boxes: the verify button, the live countdown that ' +
          'tells the user how long the code is good for, and the resend / change-email links. The ' +
          'countdown is an `aria-live="polite"` `<output>`, so a screen reader hears the code expire ' +
          'rather than only seeing it. Verify stays disabled until all six digits are present and ' +
          'the timer is still running — the two states that make the request pointless.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    timer: { control: { type: 'range', min: 0, max: 180, step: 1 } },
    isVerifying: { control: 'boolean' },
  },
  args: {
    isVerifying: false,
    timer: 150,
    code: EMPTY_CODE,
    onVerify: fn(),
    onResend: fn(),
    onChangeEmail: fn(),
  },
  decorators: [
    (Story) => (
      <div className="VerifyModalSec" style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OtpModalFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How the footer opens: 02:30 on the clock and Verify disabled, because no
 * digits have been typed yet.
 */
export const CountingDown: Story = {
  name: 'Counting down',
};

/** All six digits in and time left — the only combination that enables Verify. */
export const Ready: Story = {
  name: 'Code complete',
  args: { code: FULL_CODE },
};

/**
 * Mid-request. The label swaps to "Verifying..." and the button locks, so a
 * double tap cannot fire a second confirm against the same code.
 */
export const Verifying: Story = {
  args: { code: FULL_CODE, isVerifying: true },
};

/**
 * The resend countdown has run out. The clock is replaced by the prompt to
 * request a new code, but Verify stays enabled: the countdown governs when a NEW
 * code may be requested, not how long the current one lasts, and the auth
 * provider is the authority on whether the code on screen is still good.
 */
export const Expired: Story = {
  name: 'Resend countdown elapsed',
  args: { code: FULL_CODE, timer: 0 },
};
