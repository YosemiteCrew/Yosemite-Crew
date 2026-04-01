import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Back from './Back';
import Close from './Close';
import Next from './Next';

// ─── Back ────────────────────────────────────────────────────────────────────

const backMeta = {
  title: 'Primitives/Icons/Back',
  component: Back,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Chevron-left icon button. Used for back navigation or previous item in paginated lists.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: { disabled: { control: 'boolean' } },
  args: { onClick: fn(), disabled: false },
} satisfies Meta<typeof Back>;

export default backMeta;
type BackStory = StoryObj<typeof backMeta>;

export const Default: BackStory = {};
export const Disabled: BackStory = { args: { disabled: true } };
