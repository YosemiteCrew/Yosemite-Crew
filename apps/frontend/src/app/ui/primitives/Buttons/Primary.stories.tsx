import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { IoAddOutline, IoArrowForwardOutline } from 'react-icons/io5';

import Primary from './Primary';

/** Pill heights per size, measured off the 19 July design frames (see BaseButton). */
const HEIGHTS = { compact: 32, small: 36, default: 40, large: 44 } as const;

const meta = {
  title: 'Primitives/Buttons/Primary button',
  component: Primary,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The main call to action: a flat `--cta` pill that darkens on hover. It renders a ' +
          '`<button>` by default and a Next `<Link>` when `href` is set, and both branches share ' +
          'the same classes, so the two look identical. Four sizes travel with the height, the ' +
          'horizontal padding and the label size together: `compact` (32px), `small` (36px), ' +
          '`default` (40px) and `large` (44px). An optional icon sits before the label, or after ' +
          'it with `iconPosition="right"`, inside a 16px box so a trailing arrow never shifts ' +
          'the text.\n\n' +
          'Disabled is drawn at 60% opacity with pointer events off. On the button branch that ' +
          'is a real `disabled` attribute; on the link branch it is `aria-disabled`, a `-1` tab ' +
          'index and a prevented click, because an anchor cannot be disabled natively.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'radio', options: ['compact', 'small', 'default', 'large'] },
    iconPosition: { control: 'radio', options: ['left', 'right'] },
    isDisabled: { control: 'boolean' },
    type: { control: 'select', options: ['button', 'submit', 'reset'] },
    href: { control: 'text' },
    icon: { table: { disable: true } },
  },
  args: {
    text: 'Save changes',
    size: 'default',
    isDisabled: false,
    onClick: fn(),
  },
} satisfies Meta<typeof Primary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save changes' });
    await expect(button).toBeEnabled();
    await expect(Math.round(button.getBoundingClientRect().height)).toBe(HEIGHTS.default);
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Compact: Story = {
  args: { size: 'compact', text: 'Open workspace' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Open workspace' });
    await expect(Math.round(button.getBoundingClientRect().height)).toBe(HEIGHTS.compact);
  },
};

export const Small: Story = {
  args: { size: 'small', text: 'Add to invoice' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Add to invoice' });
    await expect(Math.round(button.getBoundingClientRect().height)).toBe(HEIGHTS.small);
  },
};

export const Large: Story = {
  args: { size: 'large', text: 'Get started' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Get started' });
    await expect(Math.round(button.getBoundingClientRect().height)).toBe(HEIGHTS.large);
  },
};

export const AllSizes: Story = {
  name: 'All four sizes',
  render: () => (
    <div className="flex items-end gap-4">
      <Primary size="compact" text="Compact" onClick={fn()} />
      <Primary size="small" text="Small" onClick={fn()} />
      <Primary size="default" text="Default" onClick={fn()} />
      <Primary size="large" text="Large" onClick={fn()} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const height = (name: string) =>
      Math.round(canvas.getByRole('button', { name }).getBoundingClientRect().height);
    await expect(height('Compact')).toBe(HEIGHTS.compact);
    await expect(height('Small')).toBe(HEIGHTS.small);
    await expect(height('Default')).toBe(HEIGHTS.default);
    await expect(height('Large')).toBe(HEIGHTS.large);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The four sizes side by side, bottom-aligned. Heights are asserted rather than eyeballed ' +
          'because the label size is set with `!important` in `ButtonEffects.css` and a utility ' +
          'class cannot outrank it; a size that lost its class would still render, one step off.',
      },
    },
  },
};

export const WithIcon: Story = {
  name: 'With leading icon',
  args: { text: 'Add companion', icon: <IoAddOutline aria-hidden /> },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Add companion' });
    const icon = button.querySelector('svg');
    await expect(icon).not.toBeNull();
    // Icon first, then the label span.
    await expect(button.firstElementChild?.contains(icon)).toBe(true);
    await expect(button.lastElementChild).toHaveTextContent('Add companion');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A leading glyph. The icon is wrapped in a fixed 16px box with a 7px gap to the label, ' +
          'so swapping icons of different intrinsic sizes never changes the pill width.',
      },
    },
  },
};

export const TrailingIcon: Story = {
  name: 'With trailing icon',
  args: {
    text: 'Continue to billing',
    icon: <IoArrowForwardOutline aria-hidden />,
    iconPosition: 'right',
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Continue to billing' });
    const icon = button.querySelector('svg');
    await expect(icon).not.toBeNull();
    await expect(button.firstElementChild).toHaveTextContent('Continue to billing');
    await expect(button.lastElementChild?.contains(icon)).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          '`iconPosition="right"` moves the same 16px box after the label. Used for "next step" ' +
          'actions in onboarding, where the arrow reads as direction rather than as an object.',
      },
    },
  },
};

export const Disabled: Story = {
  args: { isDisabled: true, text: 'Unavailable' },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Unavailable' });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    /* `pointer-events: none` is the other half of the disabled state, and it is
       what user-event refuses to click through - so the check is opted out of
       (as BaseButton.stories does) to prove the handler is unreachable even
       when the press does land. Asserting the computed value first means the
       opt-out cannot hide the guard going missing. */
    await expect(getComputedStyle(button).pointerEvents).toBe('none');
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const AsLink: Story = {
  name: 'As navigation link',
  args: { href: '/dashboard', text: 'Go to dashboard' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'Go to dashboard' });
    await expect(link).toHaveAttribute('href', '/dashboard');
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(Math.round(link.getBoundingClientRect().height)).toBe(HEIGHTS.default);
  },
  parameters: {
    docs: {
      description: {
        story:
          'With `href` the pill is a real anchor: it has a destination before hydration, it can be ' +
          'opened in a new tab, and it keeps the exact geometry of the button branch.',
      },
    },
  },
};

export const DisabledLink: Story = {
  name: 'Disabled navigation link',
  args: { href: '/dashboard', text: 'Go to dashboard', isDisabled: true },
  play: async ({ args, canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Go to dashboard' });
    await expect(link).toHaveAttribute('aria-disabled', 'true');
    await expect(link).toHaveAttribute('tabindex', '-1');
    await expect(getComputedStyle(link).pointerEvents).toBe('none');
    // Same opt-out as the button above: the anchor's own onClick calls
    // preventDefault before it would ever reach `onClick`.
    await userEvent.click(link, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An anchor has no `disabled` attribute, so the link branch fakes it: `aria-disabled`, ' +
          'removed from the tab order, and the click is prevented before it can navigate or call ' +
          '`onClick`.',
      },
    },
  },
};
