import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { PanelEmptyState, PanelLoadingRows } from './PanelStates';

const meta = {
  title: 'Primitives/PanelStates',
  component: PanelEmptyState,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Empty and loading states shared by the record panels - waitlist, check-in ' +
          'board, inventory alerts, and any panel that follows the same shape. Every ' +
          'panel used to carry its own byte-identical copy, which drifted and tripped ' +
          'the duplicated-lines gate.',
      },
    },
  },
  tags: ['autodocs'],
  args: { message: 'No entries yet.' },
} satisfies Meta<typeof PanelEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const EmptyInsidePanel: Story = {
  render: (args) => (
    <div className="w-[360px] rounded-2xl border border-[var(--hairline)] bg-[var(--screen)]">
      <PanelEmptyState message={args.message} />
    </div>
  ),
};

/**
 * `rowClass` is the consuming panel's own row class, so the skeleton lines up
 * with the real rows it stands in for - shown here with two different row
 * shapes to make that contract visible.
 */
export const LoadingRows: StoryObj<typeof PanelLoadingRows> = {
  render: () => (
    <div className="w-[360px] rounded-2xl border border-[var(--hairline)] bg-[var(--screen)]">
      <PanelLoadingRows rowClass="flex items-center justify-between gap-3 px-4 py-3" />
    </div>
  ),
};
