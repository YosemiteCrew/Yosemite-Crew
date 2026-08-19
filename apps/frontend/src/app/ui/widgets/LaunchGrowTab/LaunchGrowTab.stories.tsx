import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';

import LaunchGrowTab from './LaunchGrowTab';

const meta = {
  title: 'Widgets/LaunchGrowTab',
  component: LaunchGrowTab,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "build and launch" accordion on the developer landing page: four fixed panels (APIs, ' +
          'SDKs, pre-built templates, documentation) that expand one at a time, each tinted a step ' +
          'deeper into the blue ramp. The active tab owns its content; the others collapse to a ' +
          'numbered spine. It keeps its own `activeTab` state and takes no props, so the stories ' +
          'drive it the way a visitor would - by clicking.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LaunchGrowTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The resting state: panel 01 (APIs) open, the other three collapsed.
 */
export const Default: Story = {};

export const DocumentationOpen: Story = {
  name: 'Last panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Documentation'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'Panel 04 selected. It is the deepest tint and the longest list, so it is the one that ' +
          'shows whether the expanded panel can hold five bullets without the collapsed spines ' +
          'losing their labels.',
      },
    },
  },
};

export const Mobile: Story = {
  name: 'Mobile (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below the breakpoint the accordion is replaced entirely: the desktop panels are hidden, ' +
          'the active panel renders on its own, and a floating numbered nav pinned at the bottom ' +
          'does the switching. That is why the tab titles are abbreviated in the data - "PBT" and ' +
          '"Docs" are what the mobile nav shows, `fullTitle` is what desktop shows.',
      },
    },
  },
};
