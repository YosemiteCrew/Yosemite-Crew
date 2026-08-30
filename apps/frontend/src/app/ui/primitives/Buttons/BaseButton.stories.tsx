import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { IoArrowForward } from 'react-icons/io5';

import BaseButton, { type ButtonSize } from './BaseButton';
import './ButtonEffects.css';

/**
 * `BaseButton` is the shared body behind `Primary`, `Secondary` and `Delete`.
 * It owns no styling of its own - each wrapper injects `sizeClasses` and
 * `baseClasses` - so the stories here pass Primary's maps to render something
 * real while exercising the base's own behaviour: the element it chooses, the
 * disabled handling and the icon side.
 */
const sizeClasses: Record<ButtonSize, string> = {
  compact: 'min-h-8 px-[14px] yc-primary-button--compact',
  small: 'min-h-9 px-4 yc-primary-button--small',
  default: 'min-h-10 px-[18px]',
  large: 'min-h-11 px-5',
};

const baseClasses =
  'yc-primary-button gap-[7px] flex items-center justify-center rounded-full! transition-[background-color] duration-200 ease-out text-center';

const meta = {
  title: 'Primitives/BaseButton',
  component: BaseButton,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The shared body behind every pill button. It decides ONE thing that matters: whether ' +
          'to render a `<Link>` or a `<button>`. A caller passing `href="#"` - which several ' +
          'legacy call sites do purely to get a pointer cursor - gets the button branch, so a ' +
          'placeholder href never turns an action into a navigation. Sizes are measured off the ' +
          'design frames: compact 32px, small 36px, default 40px, large 44px.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    text: 'Save changes',
    sizeClasses,
    baseClasses,
    style: { backgroundColor: 'var(--cta)' },
    onClick: fn(),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['compact', 'small', 'default', 'large'] },
    iconPosition: { control: 'inline-radio', options: ['left', 'right'] },
  },
} satisfies Meta<typeof BaseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A button',
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save changes' });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const AsALink: Story = {
  name: 'With an href it becomes a link',
  args: { href: '/organization', onClick: undefined },
  play: async ({ canvasElement }) => {
    /* A real destination has to be a link, not a button with a click handler:
       middle-click, cmd-click and "open in new tab" all depend on it. */
    const link = within(canvasElement).getByRole('link', { name: 'Save changes' });
    await expect(link).toHaveAttribute('href', '/organization');
  },
};

export const PlaceholderHref: Story = {
  name: 'href="#" stays a button',
  args: { href: '#' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    /* Several call sites pass `href="#"` only to get the styling. Treating that
       as a destination would put a dead anchor in the tab order and jump the
       page to the top on click, so the base normalises it back to a button. */
    await expect(canvas.queryByRole('link')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Disabled: Story = {
  name: 'Disabled',
  args: { isDisabled: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save changes' });
    await expect(button).toBeDisabled();
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const DisabledLink: Story = {
  name: 'Disabled, as a link',
  args: { href: '/organization', isDisabled: true },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Save changes' });
    /* An anchor cannot be `disabled`, so the base takes it out of the tab order
       and marks it - otherwise a "disabled" CTA is still keyboard-reachable and
       still navigates. */
    await expect(link).toHaveAttribute('aria-disabled', 'true');
    await expect(link).toHaveAttribute('tabindex', '-1');
  },
};

export const TrailingIcon: Story = {
  name: 'Icon after the label',
  args: { text: 'Continue', icon: <IoArrowForward aria-hidden />, iconPosition: 'right' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Continue' });
    const label = within(button).getByText('Continue');
    const iconWrapper = button.querySelector('span.inline-flex');
    // Measured, not asserted from the prop: `iconPosition` only means anything if
    // the icon actually lands on that side.
    await expect(iconWrapper!.getBoundingClientRect().left).toBeGreaterThan(
      label.getBoundingClientRect().left
    );
  },
};

export const Toggle: Story = {
  name: 'A toggle announces its pressed state',
  args: { text: 'Show cancelled', ariaPressed: true },
  play: async ({ canvasElement }) => {
    // Buttons that toggle rather than act keep the state the raw <button> they
    // replaced used to announce.
    await expect(
      within(canvasElement).getByRole('button', { name: 'Show cancelled' })
    ).toHaveAttribute('aria-pressed', 'true');
  },
};

export const EverySize: Story = {
  name: 'The four sizes, measured',
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
      {(['compact', 'small', 'default', 'large'] as ButtonSize[]).map((size) => (
        <BaseButton key={size} {...args} size={size} text={size} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    /* 32 / 36 / 40 / 44 off the design frames. Asserted as an increasing
       sequence rather than four exact numbers, so the story documents the scale
       without breaking on a 1px line-height change. */
    const heights = (['compact', 'small', 'default', 'large'] as ButtonSize[]).map(
      (size) =>
        within(canvasElement).getByRole('button', { name: size }).getBoundingClientRect().height
    );
    for (let i = 1; i < heights.length; i++) {
      await expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
    await expect(Math.round(heights[0])).toBeGreaterThanOrEqual(32);
    await expect(Math.round(heights[3])).toBeGreaterThanOrEqual(44);
  },
};

export const LongLabel: Story = {
  name: 'A long label on a phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { text: 'Send the discharge summary to the referring practice' },
  play: async () => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
