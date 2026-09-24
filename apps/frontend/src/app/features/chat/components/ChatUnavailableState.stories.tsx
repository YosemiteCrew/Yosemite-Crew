import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import ChatUnavailableState from './ChatUnavailableState';

const meta = {
  title: 'Chat/ChatUnavailableState',
  component: ChatUnavailableState,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'What /chat renders when the build has no Stream API key, which is every self-hosted ' +
          'install without Stream. It uses the shared state-card recipe with the informational ' +
          'blue icon rather than an error tone: nothing failed, chat is simply not configured, ' +
          'and the chat workspace is not loaded behind it.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ChatUnavailableState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConfigured: Story = {
  name: 'Not configured',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Chat isn't set up for this workspace")).toBeInTheDocument();
    await expect(canvas.getByText(/no Stream API key/)).toBeInTheDocument();
    // A settled state, not a failure: no error copy and no retry action.
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};
