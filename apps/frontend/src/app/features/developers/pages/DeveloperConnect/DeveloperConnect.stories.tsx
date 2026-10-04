import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { useAuthStore } from '@/app/stores/authStore';
import DeveloperConnect from './DeveloperConnect';

const withDeveloperAccount = () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({
    status: 'authenticated',
    role: 'developer',
    roles: ['developer'],
  });
  return () => useAuthStore.setState(snapshot);
};

const meta = {
  title: 'Developers/DeveloperConnect',
  component: DeveloperConnect,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/connect' } },
  },
  tags: ['autodocs'],
  beforeEach: withDeveloperAccount,
} satisfies Meta<typeof DeveloperConnect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const Phone: Story = {
  globals: { viewport: { value: 'mobile', isRotated: false } },
};

export const EditorJourney: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Editor extension/ }));
    await expect(
      canvas.getByText('the extension connection settings', { exact: false })
    ).toBeVisible();
    // Choosing a tool lands on the key step; an existing key moves on to setup.
    await expect(canvas.getByRole('link', { name: 'Create a test key' })).toHaveAttribute(
      'href',
      '/developers/api-keys?setup=appointment-test'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'I have a key' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Connection added' }));
    await expect(
      canvas.getByText('List the practices available to me.', { exact: false })
    ).toBeVisible();
  },
};
