import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PhoneWorkspaceActionBar from './PhoneWorkspaceActionBar';

const meta = {
  title: 'Workspace/PhoneWorkspaceActionBar',
  component: PhoneWorkspaceActionBar,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The sticky bar at the foot of the phone workspace: three 44px icon buttons (records, ' +
          'chat, more) and one wide `--cta` pill. The pill advances to the next step by default, ' +
          'and a step can override it - Treatment offers "Skip to Summary", Summary carries the ' +
          'terminal action - which is how the phone flow stays identical to the desktop meta bar.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onAdvance: fn(),
    onRecords: fn(),
    onChat: fn(),
    onMore: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--screen)', paddingTop: 220 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneWorkspaceActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AdvancesToNextStep: Story = {
  name: 'On SOAP: the pill names the next step',
  args: { activeStep: 'SOAP' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // The label is the DESTINATION, not "Next" - the vet should know where the
    // pill goes before tapping it.
    const cta = canvas.getByRole('button', { name: 'Diagnostics' });
    await userEvent.click(cta);
    await expect(args.onAdvance).toHaveBeenCalledTimes(1);

    /* Four controls in one row on a 375px screen is the tightest arrangement in
       the workspace. All three icon buttons have to keep a 44px touch target and
       the pill has to take the remaining width, not the other way round. */
    const icons = ['Records', 'Chat', 'More'].map((name) =>
      canvas.getByRole('button', { name }).getBoundingClientRect()
    );
    for (const box of icons) {
      await expect(Math.round(box.width)).toBe(44);
      await expect(Math.round(box.height)).toBe(44);
    }
    await expect(cta.getBoundingClientRect().width).toBeGreaterThan(icons[0].width);
  },
};

export const StepOverride: Story = {
  name: 'Treatment: skipping ahead',
  args: {
    activeStep: 'TREATMENT',
    primaryCta: { label: 'Skip to Summary', onClick: fn() },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // The override REPLACES the advance action rather than sitting beside it.
    await expect(canvas.queryByRole('button', { name: 'Passport' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Skip to Summary' }));
    await expect(args.primaryCta?.onClick).toHaveBeenCalledTimes(1);
    await expect(args.onAdvance).not.toHaveBeenCalled();
  },
};

export const AdvanceBlocked: Story = {
  name: 'The step is not ready yet',
  args: { activeStep: 'SOAP', advanceDisabled: true },
  play: async ({ args, canvasElement }) => {
    const cta = within(canvasElement).getByRole('button', { name: 'Diagnostics' });
    await expect(cta).toBeDisabled();
    await userEvent.click(cta);
    await expect(args.onAdvance).not.toHaveBeenCalled();
  },
};

export const UnreadChat: Story = {
  name: 'A message is waiting',
  args: { activeStep: 'DIAGNOSTICS', chatUnread: true },
  play: async ({ canvasElement }) => {
    const chat = within(canvasElement).getByRole('button', { name: 'Chat' });
    // The dot is decoration on top of a control that already has an accessible
    // name, so it must not add a second one.
    await expect(chat).toHaveAccessibleName('Chat');
    await expect(chat.querySelector('[aria-hidden="true"].rounded-full')).not.toBeNull();
  },
};

export const LastStep: Story = {
  name: 'Summary: no next step to offer',
  args: { activeStep: 'SUMMARY' },
  play: async ({ canvasElement }) => {
    /* Nothing follows Summary, so with no override the pill is ABSENT rather than
       disabled or looping back to SOAP. The three icon buttons stay. */
    const buttons = within(canvasElement).getAllByRole('button');
    await expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Records',
      'Chat',
      'More',
    ]);
  },
};
