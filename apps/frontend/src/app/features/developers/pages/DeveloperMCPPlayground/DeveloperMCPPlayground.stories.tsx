import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { useAuthStore } from '@/app/stores/authStore';
import DeveloperMCPPlayground from './DeveloperMCPPlayground';

const withDeveloperSession = () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({ status: 'authenticated', role: 'developer' });
  return () => {
    useAuthStore.setState({ status: snapshot.status, role: snapshot.role });
  };
};

const meta = {
  title: 'Developers/DeveloperMCPPlayground',
  component: DeveloperMCPPlayground,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'var(--screen)' },
        { name: 'dark', value: 'var(--ink)' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--screen)', minHeight: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: withDeveloperSession,
} satisfies Meta<typeof DeveloperMCPPlayground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { level: 1, name: 'MCP playground' })).toBeVisible();
    await expect(canvas.getByLabelText('API key')).toBeVisible();
  },
};

export const WithApiKey: Story = {
  parameters: {
    nextjs: {
      router: {
        pathname: '/developers/mcp',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('API key');

    await userEvent.type(input, 'yc_dev_examplekey123');
    await expect(input).toHaveValue('yc_dev_examplekey123');
  },
};
