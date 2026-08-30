import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import OnlineBooking from './OnlineBooking';

const meta = {
  title: 'Organization/OnlineBooking',
  component: OnlineBooking,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The one section on the organisation page that sends the reader somewhere else. It takes ' +
          'no props and holds no state, so the only things that can go wrong with it are its ' +
          'layout and its link.\n\n' +
          'The row is a single `sm:` switch: above 640px the icon, the headline and the helper copy ' +
          'sit on the left with the "Set up" pill pushed to the far right by `justify-between`; ' +
          'below it the pill drops under the copy. The breakpoint is a viewport media query rather ' +
          'than a container query, so the stacked branch belongs to the pinned `mobile` story and ' +
          'cannot be produced by narrowing the wrapper.\n\n' +
          'The pill is a `next/link` to `/public-booking-setup`, not a button that opens a modal, ' +
          'and its arrow is `aria-hidden` - so the accessible name has to stay exactly "Set up".',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[760px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OnlineBooking>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Desktop row',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Exact accessible name. The arrow beside the label is aria-hidden, so
       anything that drops that attribute renames the link to whatever
       react-icons emits and changes every screen-reader listing of the page. */
    const cta = canvas.getByRole('link', { name: 'Set up' });
    await expect(cta).toHaveAttribute('href', '/public-booking-setup');

    const headline = canvas.getByText('Set up your public booking page');
    const ctaBox = cta.getBoundingClientRect();
    const headlineBox = headline.getBoundingClientRect();

    // Above sm the pill is pushed to the far right of the SAME row. Measured as
    // a relation rather than a pixel: `justify-between` collapsing into a stack
    // reads identically to a class-name assertion, and only geometry catches it.
    await expect(ctaBox.left).toBeGreaterThanOrEqual(headlineBox.right);
    await expect(ctaBox.top).toBeLessThan(headlineBox.bottom);
  },
};

export const Phone: Story = {
  name: 'Phone: the CTA drops below the copy',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cta = canvas.getByRole('link', { name: 'Set up' });

    // The pill has `shrink-0` and the copy block has `min-w-0`, which is the pair
    // that decides who gives way. Get it the wrong way round and the card grows
    // past the phone rather than the sentence wrapping inside it.
    const cardBox = canvasElement.getBoundingClientRect();
    await expect(cta.getBoundingClientRect().right).toBeLessThanOrEqual(cardBox.right);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The stacked branch. `gap-3` becomes the vertical gutter and the pill keeps its content ' +
          'width rather than filling the card, because it is an `inline-flex` inside a `flex-col` ' +
          'whose items are not stretched.',
      },
    },
  },
};
