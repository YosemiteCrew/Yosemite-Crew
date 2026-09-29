import type { Meta, StoryObj } from '@storybook/react';
import DeveloperMCPPlayground from './DeveloperMCPPlayground';

const meta = {
  title: 'Developers/DeveloperMCPPlayground',
  component: DeveloperMCPPlayground,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#faf9f6' },
        { name: 'dark', value: '#1a1a1a' },
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
} satisfies Meta<typeof DeveloperMCPPlayground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithApiKey: Story = {
  parameters: {
    nextjs: {
      router: {
        pathname: '/developers/mcp',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input[type="password"]') as HTMLInputElement;
    if (input) {
      input.value = 'yc_dev_examplekey123';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  },
};
