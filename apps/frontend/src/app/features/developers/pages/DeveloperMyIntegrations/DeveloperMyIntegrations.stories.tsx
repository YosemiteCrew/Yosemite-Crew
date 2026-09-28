import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { useAuthStore } from '@/app/stores/authStore';
import DeveloperMyIntegrations from './DeveloperMyIntegrations';

const withDeveloperSession = () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({ status: 'authenticated', role: 'developer' });
  return () => useAuthStore.setState({ status: snapshot.status, role: snapshot.role });
};

const meta = {
  title: 'Developers/DeveloperMyIntegrations',
  component: DeveloperMyIntegrations,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/integrations' } },
  },
  tags: ['autodocs'],
  beforeEach: withDeveloperSession,
} satisfies Meta<typeof DeveloperMyIntegrations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyWorkspace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'My integrations' })
    ).toBeInTheDocument();
    await expect(canvas.getByText('Install at a practice')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Start a draft' }));
    await expect(within(document.body).getByRole('dialog')).toBeInTheDocument();
    await expect(
      within(document.body).getByRole('button', { name: 'Open API playground' })
    ).toBeDisabled();
  },
};
