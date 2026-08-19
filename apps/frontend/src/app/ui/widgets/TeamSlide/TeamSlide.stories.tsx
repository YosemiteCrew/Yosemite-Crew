import type { Meta, StoryObj } from '@storybook/react';

import TeamSlide from './TeamSlide';

const meta = {
  title: 'Widgets/TeamSlide',
  component: TeamSlide,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The founding-team strip on the about page. Despite the name it does not slide: it is a ' +
          'centred, wrapping flex row of four fixed 258x311 portraits, each with a round LinkedIn ' +
          'badge pinned to its bottom-right corner. The roster is hard-coded in the component, so ' +
          'there is nothing to configure - what changes between these stories is only the width it ' +
          'has to wrap into.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TeamSlide>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * All four portraits on one row, which is what the about page shows above
 * 1500px. The 48px gap tightens to 24px below that.
 */
export const Default: Story = {};

export const Wrapped: Story = {
  name: 'Narrow container (wraps to two rows)',
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 640 }}>
        <StoryFn />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'The strip wraps rather than shrinking its portraits, so a container that fits two of them ' +
          'gives a 2x2 block. The row stays centred, which is what keeps a three-person roster from ' +
          'looking left-aligned.',
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
          'One portrait per row on a phone. The images keep their intrinsic 258px width, so this is ' +
          'the case to watch for horizontal overflow on the narrowest supported canvas.',
      },
    },
  },
};
