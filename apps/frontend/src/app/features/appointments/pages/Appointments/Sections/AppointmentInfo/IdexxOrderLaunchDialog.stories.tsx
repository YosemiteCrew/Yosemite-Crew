import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import IdexxOrderLaunchDialog from './IdexxOrderLaunchDialog';

const ORDER_URL = 'https://www.vetconnectplus.com/orders/IDX-100244';

/** The dialog portals onto <body>, so it is NOT inside `canvasElement`. */
const page = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

const meta = {
  title: 'Appointments/IdexxOrderLaunchDialog',
  component: IdexxOrderLaunchDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Shown while an IDEXX order is in progress. IDEXX keeps its own session, so it opens ' +
          'in a new browser tab from the "Open IDEXX" link instead of inside this page. The ' +
          'dialog stays open while the panel behind it polls the order, and closes on its own ' +
          'once IDEXX reports the order as submitted. "Done" closes it by hand and refreshes ' +
          'the orders.\n\n' +
          'The link only renders for an https URL on an IDEXX host; anything else renders ' +
          'nothing at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: { open: true, url: ORDER_URL, source: 'order', onClose: fn() },
} satisfies Meta<typeof IdexxOrderLaunchDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewOrder: Story = {
  name: 'A new order',
  play: async ({ canvasElement, args }) => {
    const body = page(canvasElement);
    await expect(body.getByRole('dialog', { name: 'IDEXX ordering' })).toBeInTheDocument();
    const link = body.getByRole('link', { name: 'Open IDEXX' });
    await expect(link).toHaveAttribute('href', ORDER_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    await userEvent.click(body.getByRole('button', { name: 'Done' }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const FollowUp: Story = {
  name: 'A follow-up order',
  args: { source: 'followup' },
  play: async ({ canvasElement }) => {
    const body = page(canvasElement);
    await expect(
      body.getByRole('dialog', { name: 'IDEXX follow-up ordering' })
    ).toBeInTheDocument();
    await expect(body.getByText(/select Done to refresh this appointment/i)).toBeInTheDocument();
  },
};

export const UnsafeUrl: Story = {
  name: 'A URL outside IDEXX renders nothing',
  args: { url: 'https://orders.partner-lab.example.com/IDX-100109' },
  play: async ({ canvasElement }) => {
    const body = page(canvasElement);
    await expect(body.queryByRole('dialog')).toBeNull();
    await expect(body.queryByRole('link', { name: 'Open IDEXX' })).toBeNull();
  },
};
