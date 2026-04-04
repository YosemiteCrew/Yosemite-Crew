import type { Meta, StoryObj } from '@storybook/react';
import { BlurIn } from './BlurIn';

// ─── BlurIn ──────────────────────────────────────────────────────────────────

const blurInMeta = {
  title: 'Widgets/Animations/BlurIn',
  component: BlurIn,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Framer Motion heading animation. Blurs in from 20px blur → 0 when element enters the viewport. ' +
          'Triggers once. Wraps children in an `<h2>`.',
      },
    },
  },
  tags: ['autodocs'],
  args: { children: 'Yosemite Crew' },
} satisfies Meta<typeof BlurIn>;

export default blurInMeta;
type BlurInStory = StoryObj<typeof blurInMeta>;

export const Default: BlurInStory = {};
