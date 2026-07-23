import type { Meta, StoryObj } from '@storybook/react';
import PageSkeleton from './PageSkeleton';

/**
 * PageSkeleton is the app-wide full-page loading placeholder. The `generic`
 * variant is the one the "Chrome & States" design depicts: a `--screen` card
 * with an eyebrow, a title bar, a 3-column tile grid and stacked rows that
 * shimmer via the shared `yc-shimmer` keyframe. No spinners — the shape mirrors
 * the loaded page. The other variants pre-shape specific page templates.
 */
const meta = {
  title: 'Layout/PageSkeleton',
  component: PageSkeleton,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'subtle' },
  },
} satisfies Meta<typeof PageSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The design-spec generic skeleton: eyebrow, title bar, tile trio, stacked rows. */
export const Generic: Story = {
  args: { variant: 'generic' },
};

/** Planner template (default): title row, header bar, large calendar body. */
export const Planner: Story = {
  args: { variant: 'planner' },
};

/** List template: title, search bar, six list rows. */
export const List: Story = {
  args: { variant: 'list' },
};

/** Settings template: nav column + content panel. */
export const Settings: Story = {
  args: { variant: 'settings' },
};

/** Dashboard template: four stat tiles over a 2×2 card grid. */
export const Dashboard: Story = {
  args: { variant: 'dashboard' },
};
