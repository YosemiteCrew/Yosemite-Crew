import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import PluginSlot, { PluginContributionsContext } from './PluginSlot';
import type { PluginContribution } from './extensionPoints';

const CONTRIBUTIONS: PluginContribution[] = [
  {
    pluginId: 'sample',
    pluginName: 'Sample plugin',
    point: 'appointment.workspace.action',
    title: 'Open in sample plugin',
    url: 'https://example.com/',
  },
  {
    pluginId: 'sample',
    pluginName: 'Sample plugin',
    point: 'appointment.workspace.panel',
    title: 'Sample panel',
    url: 'https://example.com/',
  },
];

const meta: Meta<typeof PluginSlot> = {
  title: 'Plugins/PluginSlot',
  component: PluginSlot,
  decorators: [
    (Story) => (
      <PluginContributionsContext.Provider value={CONTRIBUTIONS}>
        <Story />
      </PluginContributionsContext.Provider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PluginSlot>;

export const Actions: Story = {
  args: { point: 'appointment.workspace.action' },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Open in sample plugin' });
    await expect(link).toHaveAttribute('target', '_blank');
  },
};

export const Panel: Story = {
  args: { point: 'appointment.workspace.panel' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTitle('Sample panel').tagName).toBe('IFRAME');
  },
};

export const Empty: Story = {
  args: { point: 'forms.configuration.panel' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-plugin-slot]')).toBeNull();
  },
};
