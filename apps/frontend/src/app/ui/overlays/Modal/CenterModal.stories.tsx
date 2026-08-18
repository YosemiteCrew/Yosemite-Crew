import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import React, { useState } from 'react';
import CenterModal from './CenterModal';
import ModalHeader from './ModalHeader';

const meta = {
  title: 'Overlays/CenterModal',
  component: CenterModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Centered dialog wrapper built on `ModalBase`. Provides the backdrop, blur overlay, ' +
          'and responsive container sizing. Compose with `ModalHeader` and your own content.\n\n' +
          'The panel itself had never been drawn. Both original stories render only a trigger and ' +
          'leave `showModal` false, and `ModalBase` portals the dialog to `document.body` with ' +
          '`inert` and `opacity-0 pointer-events-none` until it opens - so every visual property ' +
          'of the actual dialog was unreviewed: the `var(--sh55)` backdrop behind a ' +
          '`backdrop-blur-[6px]` overlay, the `w-[90%] sm:w-[500px]` panel, its `rounded-[20px]` ' +
          'and `border-card-border` edge, and the ' +
          '`shadow-[0_2px_6px_var(--sh05),0_18px_48px_var(--sh08)]` float.\n\n' +
          'This is the same gap that let four layout bugs ship on this branch - a popover with an ' +
          'invalid comma in its `grid-template-columns`, and two calendar overlays with an ' +
          'orphaned grid child that doubled their height. All of them lived on surfaces that only ' +
          'exist after a click, and nothing ever clicked.\n\n' +
          'The stories below open the dialog in a `play` function and assert it has its real ' +
          'content - the heading, the body copy and both action buttons - rather than asserting ' +
          'that a boolean flipped. An empty portalled panel satisfies the weaker check, which is ' +
          'exactly how a regression stays invisible.\n\n' +
          'Worth knowing while reading the open panel: `CenterModal` renders no header of its own, ' +
          'so the `ModalHeader` and the padding around the body come from the caller. The dialog ' +
          'is only named for assistive tech if the caller passes `ariaLabel` or `ariaLabelledBy` - ' +
          'the composed examples here deliberately do not, which is why the open dialog below has ' +
          'no accessible name.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CenterModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const CenterModalDemo = ({ title = 'Confirm action' }: { title?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="px-6 py-3 bg-text-primary text-[var(--screen)] rounded-2xl text-body-3-emphasis"
        onClick={() => setOpen(true)}
      >
        Open modal
      </button>
      <CenterModal showModal={open} setShowModal={setOpen}>
        <ModalHeader title={title} onClose={() => setOpen(false)} />
        <div className="px-3 pb-3 flex flex-col gap-4">
          <p className="text-body-4 text-text-secondary">
            This is the modal body. You can place any content here.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              className="px-6 py-3 border border-text-primary rounded-2xl text-body-3-emphasis"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-6 py-3 bg-text-primary text-[var(--screen)] rounded-2xl text-body-3-emphasis"
              onClick={() => setOpen(false)}
            >
              Confirm
            </button>
          </div>
        </div>
      </CenterModal>
    </div>
  );
};

export const Default: Story = {
  render: () => <CenterModalDemo />,
};

export const DestructiveConfirm: Story = {
  name: 'Destructive confirm',
  render: () => (
    <div>
      <button
        type="button"
        className="px-6 py-3 bg-[var(--danger-strong)] text-[var(--danger-strong-ink)] rounded-2xl text-body-3-emphasis"
        onClick={() => {
          const el = document.getElementById('delete-demo-trigger') as HTMLButtonElement;
          el?.click();
        }}
      >
        Delete item
      </button>
      {(() => {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button
              id="delete-demo-trigger"
              type="button"
              className="hidden"
              onClick={() => setOpen(true)}
            />
            <CenterModal showModal={open} setShowModal={setOpen}>
              <ModalHeader title="Delete item?" onClose={() => setOpen(false)} />
              <div className="px-3 pb-3 flex flex-col gap-4">
                <p className="text-body-4 text-text-secondary">
                  This action cannot be undone. The item will be permanently removed.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    className="px-6 py-3 border border-text-primary rounded-2xl text-body-3-emphasis"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-6 py-3 bg-[var(--danger-strong)] text-[var(--danger-strong-ink)] rounded-2xl text-body-3-emphasis"
                    onClick={() => setOpen(false)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </CenterModal>
          </>
        );
      })()}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Destructive confirmation pattern. Use red confirm button only for irreversible actions.',
      },
    },
  },
};

/** The dialog portals to `document.body` and only carries `open` while showing. */
const openDialog = () => document.querySelector('dialog[open]') as HTMLElement | null;

/**
 * Matched on the `open` attribute rather than on `role`: the closed dialog stays
 * mounted in the portal, hidden only by the UA `dialog:not([open])` rule.
 */
const findOpenDialog = async () => {
  await waitFor(() => expect(openDialog()).toBeInTheDocument());
  return openDialog() as HTMLElement;
};

export const Opened: Story = {
  name: 'Opened (panel drawn)',
  render: () => <CenterModalDemo title="Confirm action" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing is open at rest: the dialog exists in the portal but without `open`.
    await expect(openDialog()).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Open modal' }));

    const dialog = await findOpenDialog();
    const panel = within(dialog);
    // Assert the panel has its real content, not merely that it opened.
    await expect(panel.getByRole('heading', { name: 'Confirm action' })).toBeInTheDocument();
    await expect(
      panel.getByText('This is the modal body. You can place any content here.')
    ).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The surface this file was missing: the centred panel over its blurred `--sh55` backdrop, ' +
        'with a caller-supplied `ModalHeader` and a right-aligned action pair.',
    },
  },
};

export const OpenedThenDismissed: Story = {
  name: 'Opened, then dismissed',
  render: () => <CenterModalDemo title="Confirm action" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open modal' }));
    const dialog = await findOpenDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    // Closing removes `open`, which re-applies `inert` and the pointer-events lock.
    await expect(openDialog()).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Open modal' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The round trip. `ModalBase` restores focus to the trigger and drops the body scroll lock ' +
        'on close, so a dialog that is dismissed has to leave the page exactly as it found it - ' +
        'the leak only shows up after an open/close cycle, never in a resting render.',
    },
  },
};

export const DestructiveOpened: Story = {
  name: 'Destructive confirm (opened)',
  render: () => (
    <div>
      <button
        type="button"
        className="px-6 py-3 bg-[var(--danger-strong)] text-[var(--danger-strong-ink)] rounded-2xl text-body-3-emphasis"
        onClick={() => {
          const el = document.getElementById('delete-opened-trigger') as HTMLButtonElement;
          el?.click();
        }}
      >
        Delete item
      </button>
      {(() => {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button
              id="delete-opened-trigger"
              type="button"
              className="hidden"
              onClick={() => setOpen(true)}
            />
            <CenterModal showModal={open} setShowModal={setOpen}>
              <ModalHeader title="Delete item?" onClose={() => setOpen(false)} />
              <div className="px-3 pb-3 flex flex-col gap-4">
                <p className="text-body-4 text-text-secondary">
                  This action cannot be undone. The item will be permanently removed.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    className="px-6 py-3 border border-text-primary rounded-2xl text-body-3-emphasis"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-6 py-3 bg-[var(--danger-strong)] text-[var(--danger-strong-ink)] rounded-2xl text-body-3-emphasis"
                    onClick={() => setOpen(false)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </CenterModal>
          </>
        );
      })()}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete item' }));
    const dialog = await findOpenDialog();
    const panel = within(dialog);
    await expect(panel.getByRole('heading', { name: 'Delete item?' })).toBeInTheDocument();
    await expect(
      panel.getByText('This action cannot be undone. The item will be permanently removed.')
    ).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The destructive pattern with the panel actually on screen. The red confirm sits to the ' +
          'right of a neutral Cancel inside the same `justify-end` row - the only place the two ' +
          'weights can be compared is with the dialog open.',
      },
    },
  },
};
