import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { openGlassTooltip } from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import type { Appointment } from '@yosemite-crew/types';

import RequestActionButtons from './RequestActionButtons';

const REQUEST: Appointment = {
  id: 'appt-request-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Maya Whitfield' },
  },
  organisationId: 'org-storybook',
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'REQUESTED',
};

/**
 * Both bubbles are `side="top"`, so they are placed at the trigger's top edge with a
 * 10px gap and then clamped 8px inside the viewport. Without headroom the clamp is the
 * only thing keeping them on screen, and the story would show the clamped placement
 * rather than the real one.
 */
const Room = (Story: React.ComponentType) => (
  <div className="flex min-h-[200px] items-end justify-center pb-8">
    <Story />
  </div>
);

/**
 * `GlassTooltip` binds `mouseenter` / `focusin` natively to its own wrapper span, and it
 * binds them inside an effect. Storybook starts a play function before that effect has
 * necessarily flushed, so a single dispatch at the top of a play can land on an element
 * that is not listening yet. Measured in a probe story: the events were delivered, the
 * bubble never opened, and it was still shut 350ms later; a redispatch loop needed three
 * attempts. `findByRole` retries the query, never the event, so the loss is permanent.
 *
 * The bubble is matched by its own text so a stale one from a neighbouring story - it is
 * `createPortal`ed to `document.body`, outside `canvasElement` - can never satisfy the
 * assertion.
 */
const wrapperFor = (canvasElement: HTMLElement, label: string) =>
  within(canvasElement).getByRole('button', { name: label });

const hoverFor = async (canvasElement: HTMLElement, label: string) => {
  await openGlassTooltip(wrapperFor(canvasElement, label));
  return within(document.body).getByRole('tooltip', { name: label });
};

const meta = {
  title: 'Appointments/RequestActionButtons',
  component: RequestActionButtons,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Accept / Decline pair the calendar popover shows on a booking request. It is gated ' +
          'twice over: `AppointmentPopover` renders it only when the popover is open, the viewer ' +
          '`canEditAppointments`, and `isRequestedLikeStatus(appointment.status)` holds - so on any ' +
          'other status this row does not exist at all. Nothing in Storybook had ever drawn it.\n\n' +
          'Each circle is a 40px `rounded-full!` button (`size-10`) carrying a tinted border and ' +
          'fill from the semantic ramps - `border-success-200 bg-success-100` for Accept, ' +
          '`border-danger-200 bg-danger-100` for Decline - with the glyph itself coloured from ' +
          '`--color-success-400` / `--color-danger-600`. The two are told apart by colour and by an ' +
          'icon alone: there is no label, which is exactly why the tooltip is load-bearing rather ' +
          'than decorative.\n\n' +
          'That tooltip is the second gated surface. `GlassTooltip` mounts nothing until the ' +
          'wrapper sees `mouseenter` or `focusin`, then `createPortal`s a `role="tooltip"` bubble to ' +
          '`document.body` and positions it from the trigger rect. So the bubble lives outside the ' +
          'component tree, outside `canvasElement`, and outside every snapshot taken of this row.\n\n' +
          'The stories hover (and separately focus) each circle and assert the bubble carries its ' +
          'copy, not merely that something portalled - an empty bubble would satisfy the weaker ' +
          'check. Decline is never clicked: its handler calls `rejectAppointment`, a real axios ' +
          'write, so these stories drive it only as far as its tooltip.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointment: REQUEST,
    onAccept: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof RequestActionButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'At rest',
  parameters: {
    docs: {
      description: {
        story:
          'The resting pair: two 40px circles, `gap-2` apart, in a `shrink-0` flex row so the ' +
          "popover's justify-between row cannot squeeze them.",
      },
    },
  },
};

export const AcceptTooltip: Story = {
  name: 'Accept tooltip',
  play: async ({ canvasElement }) => {
    const bubble = await hoverFor(canvasElement, 'Accept request');
    await expect(bubble).toHaveTextContent('Accept request');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Hovering the green circle. The bubble is the only place the word "Accept" appears - the ' +
          'button itself is a bare check glyph - so a bubble that mounts empty leaves the two ' +
          'circles distinguishable by colour alone.',
      },
    },
  },
};

export const DeclineTooltip: Story = {
  name: 'Decline tooltip',
  play: async ({ canvasElement }) => {
    const bubble = await hoverFor(canvasElement, 'Decline request');
    await expect(bubble).toHaveTextContent('Decline request');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The destructive half. Its click handler awaits `rejectAppointment` and only then calls ' +
          '`onClose`, so a failed request leaves the popover open with the row still live - this ' +
          'story deliberately stops at the tooltip rather than firing that write.',
      },
    },
  },
};

export const FocusedTooltip: Story = {
  name: 'Tooltip via keyboard focus',
  play: async ({ canvasElement }) => {
    // `focusin` is a separate listener from `mouseenter` and a separate code path.
    // `.focus()` is not used: it dispatches no focus events at all unless the page
    // itself has focus, which no automated run can guarantee, so the event is
    // dispatched directly at the wrapper the component bound it to.
    await openGlassTooltip(wrapperFor(canvasElement, 'Accept request'), { via: 'focus' });
    const bubble = within(document.body).getByRole('tooltip', { name: 'Accept request' });
    await expect(bubble).toHaveTextContent('Accept request');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The keyboard path. `GlassTooltip` opens on `focusin` as well as `mouseenter`, which is ' +
          'the only way a keyboard user learns which circle is which - and it is a branch no hover ' +
          'story exercises.',
      },
    },
  },
};

export const Accepted: Story = {
  name: 'Accept pressed',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Accept request' }));
    await expect(args.onAccept).toHaveBeenCalledWith(REQUEST);
    // Accept closes the popover unconditionally - unlike Decline, it does not wait
    // on a network round trip before dismissing.
    await expect(args.onClose).toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Accept hands the whole appointment back to the popover and closes it in the same tick. ' +
          'The optimistic close is the design: the parent owns the write and its own error surface.',
      },
    },
  },
};

export const NoAcceptHandler: Story = {
  name: 'Without an onAccept handler',
  args: { onAccept: undefined },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Accept request' }));
    await expect(args.onClose).toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`onAccept` is optional and called through `?.`, so a caller that omits it still gets the ' +
          'close. Worth pinning: the row looks identical, and the difference is only visible in ' +
          'what happens after the press.',
      },
    },
  },
};
