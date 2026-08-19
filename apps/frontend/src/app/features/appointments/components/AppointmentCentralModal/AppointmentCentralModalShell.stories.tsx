import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import AppointmentCentralModalShell from './AppointmentCentralModalShell';

type ShellProps = ComponentProps<typeof AppointmentCentralModalShell>;

/** Stand-in for a real form body, enough to prove the body slot actually rendered. */
const BODY = (
  <div className="flex flex-col gap-4">
    <p className="text-body-4 text-text-secondary">
      The body scrolls on its own; the header row above it never moves.
    </p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-card-border p-4 text-[13px] text-text-primary">
        Appointment type
      </div>
      <div className="rounded-2xl border border-card-border p-4 text-[13px] text-text-primary">
        Assigned lead
      </div>
    </div>
  </div>
);

/**
 * The shell is portalled and gated on `showModal`, so it is driven from a trigger the way a
 * page drives it, and left closed at rest. That is not decoration: `ModalBase` takes a
 * ref-counted lock on `document.body` while open, so a story that sat open would hold the
 * whole docs page under `overflow: hidden`.
 */
const ShellHarness = (args: ShellProps) => {
  const [open, setOpen] = useState(args.showModal);
  return (
    <div className="flex min-h-[440px] items-start p-6">
      <button
        type="button"
        className="px-6 py-3 bg-text-primary text-[var(--screen)] rounded-2xl text-body-3-emphasis"
        onClick={() => setOpen(true)}
      >
        Open appointment panel
      </button>
      <AppointmentCentralModalShell
        {...args}
        showModal={open}
        setShowModal={(value) => {
          setOpen(value);
          args.setShowModal(value);
        }}
      />
    </div>
  );
};

/** The dialog lives on `document.body`, not in the story canvas. */
const getDialog = () => document.body.querySelector('dialog.yc-modal-dialog') as HTMLElement | null;

const openShell = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open appointment panel' }));
  const dialog = getDialog();
  await expect(dialog).toBeInTheDocument();
  return dialog as HTMLElement;
};

const meta = {
  title: 'Appointments/AppointmentCentralModalShell',
  component: AppointmentCentralModalShell,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The chrome every central appointment panel is built from - Add appointment, ' +
          'Reschedule, Hospitalize. It had no story, and none of it is reachable from a ' +
          'render: `ModalBase` `createPortal`s the whole thing to `document.body` and gates it ' +
          'on `showModal`, so nothing in Storybook or Chromatic had drawn the panel it ' +
          'produces.\n\n' +
          'Two things here are only visible with it open. The panel is a `flex flex-col` in a ' +
          '`max-w-[860px]` / `modal-max-h` container where the header is `shrink-0` and the ' +
          'body is `flex-1 min-h-0 overflow-y-auto` - the arrangement that decides whether a ' +
          'long form scrolls inside the panel or pushes the header off screen. And the loading ' +
          'state is a *sibling* layer, `absolute inset-0 z-50` on the same rounded 22px box, so ' +
          'it covers the header AND the body rather than replacing the body: a branch that ' +
          'exists only while a booking request is in flight, and that no snapshot contained.\n\n' +
          'The closed state is worth seeing too, because the panel is not unmounted. ' +
          '`ModalBase` keeps the `<dialog>` in the DOM and switches it to `inert` with ' +
          '`opacity-0 pointer-events-none`, which is why a stale panel can still hold focusable ' +
          'children if that attribute ever regresses.\n\n' +
          'Every story below opens the panel through its trigger in a `play` function and then ' +
          'asserts the panel has its header and its body - not merely that a `<dialog>` ' +
          'appeared, since an empty dialog satisfies that.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: false,
    setShowModal: fn(),
    onClose: fn(),
    title: 'Add appointment',
    children: BODY,
  },
  render: (args) => <ShellHarness {...args} />,
} satisfies Meta<typeof AppointmentCentralModalShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Closed (mounted but inert)',
  play: async () => {
    const dialog = getDialog();
    // The panel is NOT unmounted while closed - it is parked, inert, on document.body.
    await expect(dialog).toBeInTheDocument();
    await expect(dialog).toHaveAttribute('inert');
    await expect(dialog).not.toHaveAttribute('open');
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the page shows before anything is opened. The dialog is already on ' +
          '`document.body`, carrying `inert` and `opacity-0 pointer-events-none` rather than ' +
          'being removed - so its contents stay out of the tab order only for as long as that ' +
          'attribute is right.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Open',
  play: async ({ canvasElement }) => {
    const dialog = await openShell(canvasElement);
    await expect(dialog).toHaveAttribute('open');
    // Assert the panel drew a header AND a body. An empty dialog would satisfy
    // the open attribute on its own, which is how a blank panel stays invisible.
    const panel = within(dialog);
    await expect(panel.getByRole('heading', { name: 'Add appointment' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    await expect(panel.getByText('Appointment type')).toBeInTheDocument();
    await expect(panel.getByText('Assigned lead')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The 860px panel: a `--screen` header band with a hairline under it, then the ' +
          'scrolling body on `bg-neutral-0`. This is the surface every appointment panel ' +
          'inherits, and the one that had never been rendered.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading overlay',
  args: { isLoading: true, loadingLabel: 'Booking appointment' },
  play: async ({ canvasElement }) => {
    const dialog = await openShell(canvasElement);
    const panel = within(dialog);
    await expect(panel.getByLabelText('Booking appointment')).toBeInTheDocument();
    await expect(panel.getByText('Finalizing your appointment…')).toBeInTheDocument();
    // The overlay sits ABOVE the header and body rather than replacing them -
    // both are still mounted underneath the opaque layer.
    await expect(panel.getByRole('heading', { name: 'Add appointment' })).toBeInTheDocument();
    await expect(panel.getByText('Appointment type')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The in-flight state. The overlay is an opaque `absolute inset-0 z-50` layer on the ' +
          'same 22px box, so it hides the header as well as the body - including the close ' +
          'button, which is the point: the panel cannot be dismissed mid-booking. Reachable only ' +
          'while a request is pending, so no snapshot had ever held it.',
      },
    },
  },
};

export const CloseBlocked: Story = {
  name: 'Close blocked by canClose',
  args: { canClose: fn(() => false) },
  play: async ({ canvasElement }) => {
    const dialog = await openShell(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    // `canClose` returning false must veto the dismissal outright.
    await expect(dialog).toHaveAttribute('open');
    await expect(within(dialog).getByRole('heading', { name: 'Add appointment' })).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A panel with unsaved work returns `false` from `canClose`, and the header X then does ' +
          'nothing. The control is deliberately not disabled - the guard lives in the handler - ' +
          'so the only way to see the behaviour is to press it.',
      },
    },
  },
};

export const LongTitle: Story = {
  name: 'Long title (truncates)',
  args: { title: 'Convert this outpatient encounter to an inpatient admission' },
  play: async ({ canvasElement }) => {
    const dialog = await openShell(canvasElement);
    const heading = within(dialog).getByRole('heading', { level: 2 });
    await expect(heading).toHaveClass('truncate');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header title is a single truncating line, so a long panel name clips instead of ' +
          'wrapping and pushing the body down. Only visible with a title long enough to hit the ' +
          'edge of the 860px panel.',
      },
    },
  },
};
