import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import CalBookingOverlay from './CalBookingOverlay';

const EMBED_URL =
  'https://app.cal.com/yosemitecrew/onboarding/embed?theme=light&layout=month_view&embedType=inline&embed=30min';

type HarnessProps = {
  onClose: () => void;
};

/**
 * Mirrors the two real callers (`DashboardProfile` and the organisation
 * `ProfileCard`): a button that flips `calOpen`, with page content behind it so
 * the scrim and its backdrop blur have something to sit over. The overlay is
 * opened from a `play` function rather than a default-open arg, so the docs page
 * never mounts a `fixed inset-0` panel over itself.
 */
const Harness = ({ onClose }: HarnessProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-[520px] space-y-4 p-8">
      <h2 className="text-[22px] font-semibold text-[var(--ink-body)]">Get set up</h2>
      <p className="max-w-[52ch] text-[14px] leading-6 text-[var(--ink-muted)]">
        Page content behind the overlay. The scrim is `bg-black/60` with `backdrop-blur-sm`, so this
        paragraph is what shows whether the blur is doing anything at all.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[12px] border border-[var(--hairline)] px-4 py-2 text-[13px] font-semibold text-[var(--ink-body)]"
      >
        Book onboarding call
      </button>
      <CalBookingOverlay
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      />
    </div>
  );
};

const findOverlay = async (canvasElement: HTMLElement) => {
  const overlay = await waitFor(() => {
    const element = document.querySelector<HTMLElement>('[data-cal-booking-overlay="true"]');
    if (!element) throw new Error('Booking overlay is not mounted');
    return element;
  });
  // It portals: a direct child of <body>, not of the story canvas.
  await expect(overlay.parentElement).toBe(document.body);
  await expect(canvasElement.contains(overlay)).toBe(false);
  return overlay;
};

const meta = {
  title: 'Overlays/CalBookingOverlay',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The full-screen scheduling overlay behind "Book onboarding call" on the dashboard ' +
          'profile widget and the organisation profile card.\n\n' +
          'It returns `null` unless `open`, and it `createPortal`s everything it draws onto ' +
          '`document.body` - so its entire DOM, scrim included, existed only after an ' +
          'interaction and no story had ever rendered it. That is the same blind spot that let ' +
          'four production bugs ship on this branch: an invalid comma-separated grid template ' +
          'that collapsed six children into one column, two calendar overlays whose orphaned ' +
          'grid child doubled their height, and dropdown text using fill tokens instead of ink ' +
          'tokens - all on surfaces tsc, eslint and jest cannot reach.\n\n' +
          'What is worth reviewing here is the chrome, not the calendar. The scrim is a ' +
          '`fixed inset-0 z-[10000]` flex centre with `p-4`, and the close chip is a child of it ' +
          'in the DOM but takes no part in that centring: it is itself `fixed` at ' +
          '`right-4 top-4 z-[10001]`, pinned to the viewport rather than to the frame. So it ' +
          'overlaps the frame’s own top-right corner instead of sitting outside it, and it stays ' +
          'put no matter what the embed does. Both layers also set `pointerEvents: auto` ' +
          'explicitly, because a third-party iframe underneath will otherwise swallow the ' +
          'press.\n\n' +
          'Two dismissals exist and only one of them is visible in the markup: the close chip, ' +
          'and a `keydown` listener on `document` that calls `stopPropagation()` before closing ' +
          'so an Escape here does not also close whatever modal the overlay was opened from. ' +
          'Pressing outside the frame does **not** dismiss it - the scrim has no click handler - ' +
          'which is a deliberate difference from the other overlays in this folder and only ' +
          'checkable with the thing on screen.\n\n' +
          'The frame itself is a live Cal.com embed. These stories render the container and ' +
          'assert the URL it is configured with; they do not wait for the third-party script, so ' +
          'the calendar area is expected to be empty offline.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Closed (nothing in the DOM)',
  play: async () => {
    // Not merely invisible - the component returns null, so there is no scrim
    // holding a stacking context or a keydown listener while it is shut.
    await expect(document.querySelector('[data-cal-booking-overlay="true"]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting page. Worth asserting rather than assuming: an overlay that renders a ' +
          'hidden `inset-0` scrim would look identical here and quietly eat every click on the ' +
          'page behind it.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Overlay open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Book onboarding call' }));
    const overlay = await findOverlay(canvasElement);
    // Assert the overlay has its content, not just that a flag flipped - an
    // empty scrim satisfies every weaker check and looks like a hung page.
    const frame = within(overlay).getByLabelText('Book onboarding call');
    await expect(frame).toHaveAttribute('data-cal-embed-src', EMBED_URL);
    await expect(
      within(overlay).getByRole('button', { name: 'Close booking overlay' })
    ).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface. The embed container is `size-full border-0` inside a `p-4` flex ' +
          'centre, and it advertises the exact Cal link it will mount via `data-cal-embed-src` - ' +
          'which is how these stories check the configuration without waiting on the network. ' +
          'The calendar area stays blank offline; the chrome around it is the reviewable part.',
      },
    },
  },
};

export const CloseChip: Story = {
  name: 'Dismissed by the close chip',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Book onboarding call' }));
    const overlay = await findOverlay(canvasElement);
    await userEvent.click(within(overlay).getByRole('button', { name: 'Close booking overlay' }));
    await expect(args.onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(document.querySelector('[data-cal-booking-overlay="true"]')).toBeNull()
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The chip sits beside the embed container inside the scrim, but its own `fixed` ' +
          'positioning takes it out of that flex row, and it carries its own `z-[10001]` and ' +
          '`pointerEvents: auto` so a third-party iframe cannot take the press from it. Its only ' +
          'label is `aria-label`; the visible glyph is a 28px icon with no text, so that label is ' +
          'the entire accessible name.',
      },
    },
  },
};

export const EscapeCloses: Story = {
  name: 'Dismissed by Escape',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Book onboarding call' }));
    await findOverlay(canvasElement);
    await userEvent.keyboard('{Escape}');
    await expect(args.onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(document.querySelector('[data-cal-booking-overlay="true"]')).toBeNull()
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second dismissal, and the one with no visible affordance at all. The listener is ' +
          'on `document` rather than on the overlay - nothing inside it is focused, so a ' +
          'component-scoped handler would never fire - and it calls `stopPropagation()` first so ' +
          'the same keystroke does not also close the card that opened this.',
      },
    },
  },
};
