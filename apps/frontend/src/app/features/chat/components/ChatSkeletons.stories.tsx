import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import React from 'react';
import { ChatListSkeleton, ChatThreadSkeleton } from './ChatSkeletons';

const meta = {
  title: 'Chat/Skeletons',
  component: ChatListSkeleton,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Warm-bone stand-ins for Stream Chat's LoadingChannels and LoadingChannel placeholders, " +
          'rendered while the channel list and the thread load. They mirror the loaded layout on ' +
          "the app's --inset shimmer so the chat never flashes a white panel in dark mode.",
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ChatListSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

const Layout = () => (
  <div className="flex h-[560px] w-full bg-[var(--screen-2)]">
    <div className="w-[340px] shrink-0 border-r border-[var(--hairline)] bg-[var(--screen-2)]">
      <ChatListSkeleton />
    </div>
    <div className="flex min-w-0 flex-1 flex-col bg-[var(--screen)]">
      <ChatThreadSkeleton />
    </div>
  </div>
);

export const ListAndThread: Story = {
  name: 'List and thread',
  render: () => <Layout />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('chat-list-skeleton')).toBeVisible();
    await expect(canvas.getByTestId('chat-thread-skeleton')).toBeVisible();
    await expect(canvas.getByRole('status', { name: 'Loading conversations' })).toBeVisible();
  },
};

export const ListAndThreadDark: Story = {
  name: 'List and thread (dark)',
  render: () => <Layout />,
  globals: { theme: 'dark' },
};
