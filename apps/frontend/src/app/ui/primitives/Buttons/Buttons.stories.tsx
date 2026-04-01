import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Primary from './Primary';
import Secondary from './Secondary';
import Delete from './Delete';

// ─── Primary ────────────────────────────────────────────────────────────────

const primaryMeta = {
  title: 'Primitives/Buttons/Primary',
  component: Primary,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Main CTA button. Renders a `<button>` by default; pass `href` for Next.js `<Link>` navigation. ' +
          'Hover scale animation. Two sizes: `default` and `large`.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'radio', options: ['default', 'large'] },
    isDisabled: { control: 'boolean' },
    type: { control: 'select', options: ['button', 'submit', 'reset'] },
    href: { control: 'text' },
  },
  args: {
    text: 'Save changes',
    isDisabled: false,
    size: 'default',
    onClick: fn(),
  },
} satisfies Meta<typeof Primary>;

export default primaryMeta;
type PrimaryStory = StoryObj<typeof primaryMeta>;

export const Default: PrimaryStory = {};
export const Large: PrimaryStory = { args: { size: 'large', text: 'Get started' } };
export const Disabled: PrimaryStory = { args: { isDisabled: true, text: 'Unavailable' } };
export const AsLink: PrimaryStory = {
  name: 'As navigation link',
  args: { href: '/dashboard', text: 'Go to dashboard' },
};
