import type { Meta, StoryObj } from '@storybook/react';
import { DevRouteGuard } from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import DeveloperMyIntegrations from '@/app/features/developers/pages/DeveloperMyIntegrations/DeveloperMyIntegrations';

const meta: Meta<typeof DeveloperMyIntegrations> = {
  title: 'Developers/My Integrations',
  component: DeveloperMyIntegrations,
  decorators: [
    (Story) => (
      <DevRouteGuard>
        <div style={{ padding: '24px', minWidth: '800px' }}>
          <Story />
        </div>
      </DevRouteGuard>
    ),
  ],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof DeveloperMyIntegrations>;

export const Default: Story = {};

export const Empty: Story = {
  decorators: [
    (Story) => (
      <DevRouteGuard>
        <div style={{ padding: '24px', minWidth: '800px' }}>
          <Story />
        </div>
      </DevRouteGuard>
    ),
  ],
};
