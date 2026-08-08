import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Primary from './Primary';

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
          'Flat --cta fill that darkens to --cta-hover on hover. Four sizes: `compact` (32px), ' +
          '`small` (36px), `default` (40px) and `large` (44px).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'radio', options: ['compact', 'small', 'default', 'large'] },
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
export const Compact: PrimaryStory = { args: { size: 'compact', text: 'Open workspace' } };
export const Small: PrimaryStory = { args: { size: 'small', text: 'Create an API key' } };
export const Large: PrimaryStory = { args: { size: 'large', text: 'Get started' } };
export const Disabled: PrimaryStory = { args: { isDisabled: true, text: 'Unavailable' } };
export const AsLink: PrimaryStory = {
  name: 'As navigation link',
  args: { href: '/dashboard', text: 'Go to dashboard' },
};
