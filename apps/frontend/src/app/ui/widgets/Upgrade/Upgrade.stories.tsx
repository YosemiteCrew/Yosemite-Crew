import type { Meta, StoryObj } from '@storybook/react';
import { screen, userEvent, within } from 'storybook/test';

import Upgrade from './index';

const openBillingCycleModal = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Upgrade' }));
  // The modal portals to document.body, so it is queried off `screen`.
  await screen.findByText('Select billing cycle');
};

const meta = {
  title: 'Widgets/Upgrade',
  component: Upgrade,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The Business-plan upgrade entry point: a single `Primary` CTA that opens a centered modal ' +
          'where the billing cycle is chosen. The selected cycle is a filled `--blue` pill, the other ' +
          'an outlined one, and the price block swaps between the monthly and yearly per-seat price. ' +
          'Confirming asks the API for a Stripe checkout link and redirects — that call only happens ' +
          'on click, so the stories below never leave the page.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Upgrade>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Upgrade CTA',
};

export const MonthlySelected: Story = {
  name: 'Billing cycle — monthly',
  play: async ({ canvasElement }) => {
    await openBillingCycleModal(canvasElement);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The modal as it opens: monthly is preselected and the price block shows the monthly rate.',
      },
    },
  },
};

export const YearlySelected: Story = {
  name: 'Billing cycle — yearly',
  play: async ({ canvasElement }) => {
    await openBillingCycleModal(canvasElement);
    await userEvent.click(screen.getByRole('button', { name: 'Pay yearly' }));
  },
  parameters: {
    docs: {
      description: {
        story:
          'Switching to yearly moves the filled pill and drops the per-seat price to the discounted rate.',
      },
    },
  },
};
