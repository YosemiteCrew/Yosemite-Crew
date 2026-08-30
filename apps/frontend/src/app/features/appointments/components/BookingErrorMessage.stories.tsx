import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, within } from 'storybook/test';

import BookingErrorMessage from './BookingErrorMessage';

const SLOT = 'caption-slot';

/**
 * Everything the component itself put on the page.
 *
 * `canvasElement` is never empty - the preview decorator always wraps the story
 * in a `<main>` with an sr-only heading, and this file's own decorator adds a
 * mock field above the caption. Counting the children of the slot the story is
 * rendered into is the only way to tell "rendered nothing" apart from "rendered
 * an empty box".
 */
const renderedByComponent = (canvasElement: HTMLElement): Element[] => {
  const slot = canvasElement.querySelector(`[data-testid="${SLOT}"]`);
  return slot ? [...slot.children] : [];
};

/** The `top` of each rendered LINE of an element's text, in order. */
const lineTops = (el: Element): number[] => {
  const range = globalThis.document.createRange();
  range.selectNodeContents(el);
  const tops = [...range.getClientRects()].map((rect) => Math.round(rect.top));
  return [...new Set(tops)].sort((a, b) => a - b);
};

/**
 * The width a validation caption actually gets on the booking form, with the
 * field it hangs off. At full canvas width even the longest message fits on one
 * line, so the wrapping story would silently prove nothing.
 */
const Field = (Story: React.ComponentType) => (
  <div className="w-[320px] p-4">
    <div className="h-10 rounded-lg border border-card-border bg-neutral-0" />
    <div data-testid={SLOT}>
      <Story />
    </div>
  </div>
);

const meta = {
  title: 'Appointments/BookingErrorMessage',
  component: BookingErrorMessage,
  decorators: [Field],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The validation caption under a booking field: a warning glyph and the message, both in ' +
          '`text-text-error`.\n\n' +
          'The branch worth guarding is the empty one. `if (!error) return null` means an absent ' +
          'message contributes NO node at all - not a hidden node, not an empty `mt-1.5` row. ' +
          'Every booking field renders one of these unconditionally, so had it returned an empty ' +
          '`<div>` instead, each field would carry a permanent strip of dead space and the form ' +
          'would grow taller with every field added. It is also `!error` rather than ' +
          '`error !== undefined`, so the empty string a cleared validator produces collapses the ' +
          'caption too.\n\n' +
          'The other silent failure is colour. The glyph paints from `currentColor` and the text ' +
          'from the same `text-text-error` on the wrapper, so if that utility ever resolves to ' +
          'nothing both halves quietly inherit body ink and the caption stops reading as an ' +
          'error while still saying the right words.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    error: 'Select a time slot before continuing.',
  },
} satisfies Meta<typeof BookingErrorMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithError: Story = {
  name: 'With a message',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const message = canvas.getByText('Select a time slot before continuing.');
    const row = message.parentElement as HTMLElement;
    const icon = row.querySelector('svg');

    // The glyph belongs to this component, not to the field above it, and it
    // must share the row with the words rather than stack over them.
    await expect(icon).not.toBeNull();
    await expect(icon?.parentElement).toBe(row);
    await expect(lineTops(message)).toHaveLength(1);

    /* Both halves must resolve to the SAME non-inherited ink. `text-text-error`
       maps to `--color-text-error`, and the svg inherits it through
       `fill="currentColor"`; a Tailwind utility that resolved to nothing would
       leave both at body ink, which the comparison against the ground catches. */
    const messageColour = globalThis.getComputedStyle(message).color;
    const iconColour = globalThis.getComputedStyle(icon as Element).color;
    await expect(iconColour).toBe(messageColour);

    const bodyColour = globalThis.getComputedStyle(globalThis.document.body).color;
    await expect(messageColour).not.toBe(bodyColour);
  },
};

export const NoError: Story = {
  name: 'No message renders nothing',
  args: { error: undefined },
  play: async ({ canvasElement }) => {
    /* Not "is hidden", not "has no text" - has no NODE. Every booking field
       mounts one of these, so an empty wrapper here would be dead space repeated
       down the whole form. */
    await expect(renderedByComponent(canvasElement)).toHaveLength(0);
    await expect(canvasElement.querySelector('svg')).toBeNull();
  },
};

export const EmptyString: Story = {
  name: 'A cleared message collapses too',
  args: { error: '' },
  play: async ({ canvasElement }) => {
    /* The guard is `!error`, not a null check. A validator that clears itself by
       writing `''` must collapse the caption rather than leave a bare glyph
       floating under the field. */
    await expect(renderedByComponent(canvasElement)).toHaveLength(0);
  },
};

export const LongMessage: Story = {
  name: 'Long message wraps under the field',
  args: {
    error:
      'This practitioner is already booked for the selected slot. Choose another time, another ' +
      'practitioner, or shorten the appointment duration.',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The row is `flex items-center`, so a message long enough to wrap centres the glyph ' +
          'against the whole block rather than against the first line. Worth knowing before ' +
          'someone "fixes" that alignment: it is the wrapping, not the glyph, that the layout ' +
          'has to survive.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const message = canvas.getByText(/This practitioner is already booked/);
    const row = message.parentElement as HTMLElement;
    const slot = row.parentElement as HTMLElement;

    // It really wrapped at this width - otherwise the story proves nothing.
    await expect(lineTops(message).length).toBeGreaterThan(1);

    /* And wrapping is all it does. `whitespace-nowrap` anywhere on this row, or
       a flex item that refused to shrink below its content, would push the
       caption out past the field it belongs to instead of stacking under it. */
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
    await expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(
      slot.getBoundingClientRect().right + 1
    );
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    error:
      'This practitioner is already booked for the selected slot. Choose another time, another ' +
      'practitioner, or shorten the appointment duration.',
  },
  play: async () => {
    // A caption that overflows the viewport takes the whole booking form with it.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
