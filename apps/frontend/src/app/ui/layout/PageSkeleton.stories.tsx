import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

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

/**
 * The planner skeleton at phone width. It is the placeholder for appointments,
 * tasks and the appointment workspace, so it is the first thing a phone visit to
 * any of those routes paints - and its title row used to need 568px: a fixed w-72
 * subtitle bar beside a nested action row that will not shrink under 264px.
 */
export const PlannerPhone: Story = {
  name: 'Planner at 390px',
  args: { variant: 'planner' },
  decorators: [
    /* A 390px CONTAINER, not the mobile viewport global. That global is applied by
       the Storybook manager to the preview iframe, so it is inert for any runner
       that loads iframe.html directly - measured: root stays the browser width and
       the story quietly passes at 1280. The wrap this asserts is driven by the box,
       not by a media query, so a container reproduces it honestly. */
    (Story) => (
      <div data-frame="" style={{ width: 390 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const frame = canvasElement.querySelector('[data-frame]') as HTMLElement;
    const titleRow = frame.querySelector('div > div') as HTMLElement;
    const [titles, actions] = [...titleRow.children] as HTMLElement[];

    // Two lines, not one: the action bars sit below the title, not beside it.
    await expect(actions.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      titles.getBoundingClientRect().bottom
    );

    /* And nothing reaches past the frame. Nothing here is inside a scroller, so a
       right-edge comparison means what it looks like it means - unlike a clipped
       box, which keeps reporting its full width whatever the scroller does to it. */
    const frameRight = frame.getBoundingClientRect().right;
    const past = [...frame.querySelectorAll<HTMLElement>('*')].filter(
      (el) => el.getBoundingClientRect().right > frameRight + 0.5
    );
    await expect(past).toHaveLength(0);
  },
};
