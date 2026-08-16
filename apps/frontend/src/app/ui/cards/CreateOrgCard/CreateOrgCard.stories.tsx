import type { Meta, StoryObj } from '@storybook/react';
import CreateOrgCard from './CreateOrgCard';

/**
 * The dashed "add" affordance that closes the organisation list on
 * `/organizations`. It is a link, not a button, so the whole card is one
 * keyboard stop and one hover target.
 */
const meta = {
  title: 'Cards/CreateOrgCard',
  component: CreateOrgCard,
  parameters: {
    layout: 'padded',
    // The card renders a next/link, which needs the App Router mock.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Dashed-outline call to action pinned under the organisation list. 1.5px dashed `--divider` at radius 18, ' +
          '`--ink-muted` label with a `--blue-text` plus glyph; hovering swaps the border to `--blue` and the label to `--ink`. ' +
          'It stretches to its container, so the stories below pin it to the widths it actually ships at.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CreateOrgCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** As it appears on the organisations page — a 640px column, full-bleed card. */
export const Default: Story = {
  decorators: [
    (StoryFn) => (
      <div style={{ width: 'min(640px, 100%)' }}>
        <StoryFn />
      </div>
    ),
  ],
};

/**
 * Narrow container. The label is a single line at 13px/600, so a cramped
 * column is where wrapping would first show up.
 */
export const Narrow: Story = {
  decorators: [
    (StoryFn) => (
      <div style={{ width: 260 }}>
        <StoryFn />
      </div>
    ),
  ],
};

/** The destination is overridable — onboarding flows point it at their own route. */
export const CustomHref: Story = {
  args: { href: '/onboarding/new-organization' },
  decorators: [
    (StoryFn) => (
      <div style={{ width: 'min(640px, 100%)' }}>
        <StoryFn />
      </div>
    ),
  ],
};
