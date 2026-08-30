import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import GlobalFullscreenLoader from './GlobalFullscreenLoader';

const meta = {
  title: 'Layout/GlobalFullscreenLoader',
  component: GlobalFullscreenLoader,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The app-level blocking loader, shown while a whole surface is being swapped - switching ' +
          'organisation, for instance, where the page under it is about to be replaced entirely. ' +
          'It is translucent rather than opaque so the user keeps their place in the app rather ' +
          'than watching it disappear and come back.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', minHeight: 420, background: 'var(--page)' }}>
        <div style={{ padding: 24, color: 'var(--ink-body)' }}>
          <h2 style={{ font: '700 20px var(--font-newsreader)' }}>Dashboard</h2>
          <p style={{ fontSize: 13 }}>
            The page underneath stays visible through the translucent scrim.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GlobalFullscreenLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Blocking the surface',
  play: async ({ canvasElement }) => {
    /* The default test id is what the org-switch flow and its tests key on, so
       it is part of the contract rather than an implementation detail. */
    await expect(within(canvasElement).getByTestId('global-fullscreen-loader')).toBeInTheDocument();
  },
};

export const CustomTestId: Story = {
  name: 'With a caller-supplied test id',
  args: { testId: 'org-switch-loader' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('org-switch-loader')).toBeInTheDocument();
    // The override REPLACES the default rather than adding to it, so a test
    // waiting on the default id would not silently match two loaders.
    await expect(canvas.queryByTestId('global-fullscreen-loader')).toBeNull();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
