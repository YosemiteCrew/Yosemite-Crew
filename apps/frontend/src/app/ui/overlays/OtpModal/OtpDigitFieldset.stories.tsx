import { type ComponentProps, useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn, userEvent, within } from 'storybook/test';

import OtpDigitFieldset from './OtpDigitFieldset';
import { useOtpCodeInput } from '@/app/hooks/useOtpCodeInput';
import './OtpModal.css';

type FieldsetProps = ComponentProps<typeof OtpDigitFieldset>;

/**
 * The fieldset is fully controlled — code, refs and both keyboard handlers come
 * from the parent — so the stories drive it with the same `useOtpCodeInput`
 * hook `OtpModal` uses. Nothing is reimplemented, which is the point: auto
 * advance, backspace and the arrow keys behave here exactly as they do in the
 * modal.
 */
const StatefulOtpDigitFieldset = ({ invalidOtp }: Pick<FieldsetProps, 'invalidOtp'>) => {
  const uid = useId();
  const { code, handleCodeChange, handleCodeKeyDown, setOtpRef } = useOtpCodeInput();

  return (
    <OtpDigitFieldset
      code={code}
      otpHintId={`otp-hint-${uid}`}
      otpStatusId={`otp-status-${uid}`}
      invalidOtp={invalidOtp}
      setOtpRef={setOtpRef}
      onCodeChange={handleCodeChange}
      onCodeKeyDown={handleCodeKeyDown}
    />
  );
};

/** Types a code into the boxes the way a person would, one digit at a time. */
const typeCode = async (canvasElement: HTMLElement, digits: string) => {
  const canvas = within(canvasElement);
  for (const [index, digit] of [...digits].entries()) {
    await userEvent.type(canvas.getByRole('textbox', { name: `Digit ${index + 1} of 6` }), digit);
  }
};

const meta = {
  title: 'Overlays/OtpDigitFieldset',
  component: OtpDigitFieldset,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The six single-digit boxes of the email-verification step, plus the hint line under them ' +
          'and the "Invalid OTP" alert. Only the first box carries `autocomplete="one-time-code"`, so ' +
          'iOS offers the code once rather than into every box, and every box is `inputmode="numeric"`. ' +
          'It is worth reviewing on its own because `Overlays/OtpModal` has Chromatic snapshots ' +
          'disabled (its resend countdown ticks every second), which leaves these boxes as the only ' +
          'snapshotted view of the field.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    invalidOtp: false,
    // The controlled half of the contract is owned by the wrapper below, so
    // these satisfy the component's prop types without steering the render;
    // they are hidden from the controls table for the same reason.
    code: ['', '', '', '', '', ''],
    otpHintId: 'otp-hint',
    otpStatusId: 'otp-status',
    setOtpRef: fn(),
    onCodeChange: fn(),
    onCodeKeyDown: fn(),
  },
  argTypes: {
    invalidOtp: { control: 'boolean' },
    code: { table: { disable: true } },
    otpHintId: { table: { disable: true } },
    otpStatusId: { table: { disable: true } },
    setOtpRef: { table: { disable: true } },
    onCodeChange: { table: { disable: true } },
    onCodeKeyDown: { table: { disable: true } },
  },
  render: (args) => <StatefulOtpDigitFieldset invalidOtp={args.invalidOtp} />,
} satisfies Meta<typeof OtpDigitFieldset>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Awaiting the code',
  parameters: {
    docs: {
      description: {
        story:
          'The resting state: six empty 44x52 boxes on `--greyborder`, the caret in the first, and the ' +
          'hint line telling the user where the code came from.',
      },
    },
  },
};

export const Filled: Story = {
  name: 'Code entered',
  play: async ({ canvasElement }) => {
    await typeCode(canvasElement, '482913');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typed one digit at a time, which is also the auto-advance test — each entry moves focus to ' +
          'the next box, so six keystrokes fill six boxes with no tabbing.',
      },
    },
  },
};

export const Invalid: Story = {
  name: 'Invalid code',
  args: { invalidOtp: true },
  play: async ({ canvasElement }) => {
    await typeCode(canvasElement, '000000');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A rejected code. The alert row appears under the boxes and is wired to the fieldset through ' +
          '`aria-describedby`, so a screen reader hears it without moving focus; the digits stay put so ' +
          'the user can fix one instead of retyping all six.',
      },
    },
  },
};
