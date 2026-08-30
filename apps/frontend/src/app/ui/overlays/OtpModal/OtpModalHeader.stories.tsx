import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import OtpModalHeader from './OtpModalHeader';

const meta = {
  title: 'Overlays/OtpModalHeader',
  component: OtpModalHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The heading block of the email-verification dialog. Its two ids are the dialog's " +
          '`aria-labelledby` and `aria-describedby` targets, so they are a contract with the ' +
          'modal around it rather than decoration: a screen reader announces this title and this ' +
          'description when the dialog opens.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    dialogTitleId: 'otp-dialog-title',
    dialogDescriptionId: 'otp-dialog-description',
    email: 'ravi.patel@example.com',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, color: 'var(--ink-body)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OtpModalHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Awaiting a code',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // The address is the one piece of state here - it tells the user WHERE to
    // look, so it has to be the real one, not a placeholder.
    await expect(canvas.getByText(args.email)).toBeInTheDocument();
  },
};

export const IdsAreWiredForTheDialog: Story = {
  name: 'The title and description carry the ids the dialog points at',
  play: async ({ args, canvasElement }) => {
    /* If either id goes missing the dialog still LOOKS right and still opens, and
       a screen reader announces an unnamed dialog. Nothing visual catches that,
       which is why it is asserted here. */
    const title = canvasElement.querySelector(`#${args.dialogTitleId}`);
    const description = canvasElement.querySelector(`#${args.dialogDescriptionId}`);
    await expect(title).not.toBeNull();
    await expect(description).not.toBeNull();
    await expect(title?.tagName).toBe('H2');
  },
};

export const LongAddress: Story = {
  name: 'A long address still wraps inside the card',
  args: { email: 'konstantina.papadopoulou-lindqvist@veterinary-referrals-north.example.com' },
  play: async () => {
    // Email addresses are unbounded user data in a fixed-width dialog, so this is
    // where the block either wraps or pushes the modal wider than the screen.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { email: 'konstantina.papadopoulou-lindqvist@veterinary-referrals-north.example.com' },
  play: async () => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
