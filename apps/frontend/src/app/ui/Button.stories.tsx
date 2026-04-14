import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import React from 'react';
import Button from './Button';

/**
 * The primary shared action and navigation trigger.
 *
 * **Status: Approved**
 *
 * - Use `variant="primary"` for the main CTA on a surface.
 * - Use `variant="secondary"` for alternative or cancel actions.
 * - Use `variant="danger"` for destructive confirmations only.
 * - Omit `href` for in-page actions; provide `href` for navigation.
 *
 * @see src/app/ui/Button.tsx
 */
const meta = {
  title: 'Primitives/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Shared Button component. Renders a semantic `<button>` when no `href` is provided, ' +
          'or a Next.js `<Link>` for navigation. All three variants (primary, secondary, danger) ' +
          'follow the same API.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
      description: 'Visual and semantic variant',
    },
    size: {
      control: 'radio',
      options: ['default', 'large'],
      description: 'Button height scale',
    },
    isDisabled: {
      control: 'boolean',
      description: 'Disabled state — blocks pointer events and dims the button',
    },
    href: {
      control: 'text',
      description:
        'Navigation target. When provided renders a Next.js Link. When omitted renders a <button>.',
    },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description: 'HTML button type (only applies when href is not provided)',
    },
    text: {
      control: 'text',
    },
    onClick: { action: 'clicked' },
  },
  args: {
    text: 'Button',
    onClick: fn(),
    isDisabled: false,
    size: 'default',
    variant: 'primary',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Variant stories
// ---------------------------------------------------------------------------

export const Primary: Story = {
  args: {
    variant: 'primary',
    text: 'Save changes',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    text: 'Cancel',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    text: 'Delete account',
  },
};

// ---------------------------------------------------------------------------
// Size stories
// ---------------------------------------------------------------------------

export const PrimaryLarge: Story = {
  name: 'Primary / large',
  args: {
    variant: 'primary',
    size: 'large',
    text: 'Get started',
  },
};

// ---------------------------------------------------------------------------
// State stories
// ---------------------------------------------------------------------------

export const Disabled: Story = {
  args: {
    variant: 'primary',
    text: 'Unavailable',
    isDisabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled buttons use `aria-disabled` and opacity-60. Pointer events are blocked.',
      },
    },
  },
};

export const DisabledSecondary: Story = {
  name: 'Secondary / disabled',
  args: {
    variant: 'secondary',
    text: 'Cannot cancel',
    isDisabled: true,
  },
};

// ---------------------------------------------------------------------------
// As navigation link
// ---------------------------------------------------------------------------

export const AsLink: Story = {
  name: 'As navigation link',
  args: {
    variant: 'primary',
    text: 'Go to dashboard',
    href: '/dashboard',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `href` is provided the button renders as a Next.js `<Link>`. ' +
          'Use this pattern only for page navigation, not for in-page actions.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// All variants side-by-side
// ---------------------------------------------------------------------------

export const AllVariants: Story = {
  name: 'All variants',
  render: (args: React.ComponentProps<typeof Button>) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} variant="primary" text="Primary" />
      <Button {...args} variant="secondary" text="Secondary" />
      <Button {...args} variant="danger" text="Danger" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All three variants at default size.',
      },
    },
  },
};
