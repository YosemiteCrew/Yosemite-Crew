import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { useAuthStore } from '@/app/stores/authStore';
import DeveloperPlayground from './DeveloperPlayground';

/** Seeds a signed-in developer so `DevRouteGuard` renders the page, and restores the store after. */
const seedDeveloper = () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({
    status: 'authenticated',
    role: 'developer',
    user: {
      userId: 'dev-storybook',
      email: 'dev@example.test',
      authProfile: null,
      loginMethod: 'emailpassword',
      emailVerified: true,
      getUsername: () => 'dev-storybook',
    },
    attributes: { sub: 'dev-storybook', email: 'dev@example.test' },
  });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

const meta = {
  title: 'Developers/DeveloperPlayground',
  component: DeveloperPlayground,
  args: { baseUrl: 'https://api.example.test' },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/playground' } },
    docs: {
      description: {
        component:
          'Runs one of the published `/v1/developer` read operations with a pasted API key and ' +
          'shows the real response. The key stays in component state; every export reads ' +
          '`YC_API_KEY` instead. No story sends a request.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: seedDeveloper,
} satisfies Meta<typeof DeveloperPlayground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Resting (List practices)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'API playground' })).toBeInTheDocument();
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('$YC_API_KEY');
  },
};

export const ValidationErrors: Story = {
  name: 'List appointments with invalid inputs',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('API key'), 'synthetic-story-key');
    await userEvent.selectOptions(canvas.getByLabelText('Operation'), 'listAppointments');
    await userEvent.type(canvas.getByLabelText('Page size'), '500');
    await userEvent.click(canvas.getByRole('button', { name: 'Run' }));
    await expect(canvas.getByText('Practice (x-org-id) is required.')).toBeInTheDocument();
    await expect(canvas.getByText('Use a whole number from 1 to 100.')).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText('Operation'), 'getAppointment');
    await expect(canvas.getByLabelText(/Appointment id/)).toBeInTheDocument();
  },
};
