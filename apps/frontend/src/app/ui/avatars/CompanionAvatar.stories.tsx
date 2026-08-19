import type { Meta, StoryObj } from '@storybook/react';

import CompanionAvatar from './CompanionAvatar';

const meta = {
  title: 'Avatars/CompanionAvatar',
  component: CompanionAvatar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The companion (pet) avatar used in the directory table, companion header and the ' +
          'add-companion modal. It shows the real photo when the companion has one, and otherwise a ' +
          'Newsreader monogram on a tinted disc — never a stock species photo, which would read as a ' +
          'real picture of that animal. The disc colour is picked deterministically from `seed` (or the ' +
          'name), so a companion keeps the same colour everywhere. The photo branch is left out of ' +
          'these stories on purpose: `getSafeImageUrl` only accepts an https source, so any photo ' +
          'story would pull a remote CDN image into every snapshot.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'range', min: 24, max: 96, step: 2 } },
    photoUrl: { control: 'text' },
  },
  args: {
    name: 'Bella',
    size: 46,
    textClassName: 'text-[20px]',
  },
} satisfies Meta<typeof CompanionAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No photo on file — the monogram disc. This is the common case in the directory. */
export const Monogram: Story = {};

/**
 * The palette cycles over three warm-bone tints keyed off `seed`, so two
 * companions side by side stay visually distinct and neither one drifts colour
 * between the table, the header and the modal.
 */
export const PaletteRotation: Story = {
  name: 'Palette rotation',
  render: (args) => (
    <div className="flex items-center gap-3">
      <CompanionAvatar {...args} name="Bella" seed="a" />
      <CompanionAvatar {...args} name="Coco" seed="b" />
      <CompanionAvatar {...args} name="Duke" seed="c" />
    </div>
  ),
};

/**
 * The three sizes the app actually uses: 38px in the compact table row, 44px in
 * the card row and 46px in the roomy row. `textClassName` carries the matching
 * monogram type scale.
 */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-3">
      <CompanionAvatar {...args} size={38} textClassName="text-[17px]" />
      <CompanionAvatar {...args} size={44} textClassName="text-[19px]" />
      <CompanionAvatar {...args} size={46} textClassName="text-[20px]" />
    </div>
  ),
};

/**
 * No name at all — the monogram falls back to `?` rather than rendering an
 * empty disc, so a half-imported record still looks deliberate.
 */
export const MissingName: Story = {
  name: 'Missing name',
  args: { name: null, alt: 'Companion' },
};
