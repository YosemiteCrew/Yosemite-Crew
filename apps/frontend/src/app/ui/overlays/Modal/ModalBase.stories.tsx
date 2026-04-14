import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import React, { useState } from 'react';
import ModalBase from './ModalBase';

/**
 * Low-level modal portal primitive.
 *
 * **Status: Approved**
 *
 * ModalBase provides:
 * - Portal rendering (appended to document.body)
 * - Focus management: moves focus into the dialog on open; restores it on close
 * - Focus trap: Tab/Shift+Tab cycle stays within the dialog
 * - Escape key: closes the dialog
 * - Outside-click: closes the dialog (configurable with `ignoreOutsideClick`)
 * - `role="dialog" aria-modal="true"` with aria-label/aria-labelledby support
 *
 * Compose with `CenterModal` or a custom wrapper for final layout.
 * Do not put onClick or event handlers directly on the overlay div.
 *
 * @see src/app/ui/overlays/Modal/ModalBase.tsx
 */
const meta = {
  title: 'Overlays/ModalBase',
  component: ModalBase,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Portal-based dialog primitive. Handles focus trap, escape key, outside-click, ' +
          'and ARIA dialog semantics. Compose into CenterModal or other layout wrappers.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ModalBase>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Interactive wrapper helper
// ---------------------------------------------------------------------------

const ModalDemo = ({ label, canClose }: { label?: string; canClose?: () => boolean }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="px-6 py-3 bg-text-primary text-white rounded-2xl text-body-3-emphasis"
        onClick={() => setOpen(true)}
      >
        Open modal
      </button>

      <ModalBase
        showModal={open}
        setShowModal={setOpen}
        canClose={canClose}
        aria-labelledby="demo-modal-title"
        overlayClassName={`fixed inset-0 bg-[#302f2e80] backdrop-blur-[2px] z-[1100] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        containerClassName={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] sm:w-[480px] z-[1200] bg-white rounded-2xl border border-card-border p-6 flex flex-col gap-4 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center justify-between">
          <h2 id="demo-modal-title" className="text-body-1 text-text-primary">
            {label ?? 'Modal title'}
          </h2>
          <button
            type="button"
            aria-label="Close modal"
            className="text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
        <p className="text-body-4 text-text-secondary">
          Modal content. Tab through focusable elements — focus stays inside. Press Escape or click
          outside to close.
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
            className="px-6 py-3 bg-text-primary text-white rounded-2xl text-body-3-emphasis"
            onClick={() => setOpen(false)}
          >
            Confirm
          </button>
        </div>
      </ModalBase>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: 'Default (open/close)',
  render: () => <ModalDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Click "Open modal" to see the dialog. Close via Escape, the close button, or clicking outside.',
      },
    },
  },
};

export const FocusTrap: Story = {
  name: 'Focus trap (keyboard interaction)',
  render: () => <ModalDemo label="Focus trap demo" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const openBtn = canvas.getByRole('button', { name: /open modal/i });
    await userEvent.click(openBtn);

    // The first focusable element inside the modal should now have focus.
    const modal = within(document.body).getByRole('dialog');
    const firstFocusable = modal.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])'
    );
    expect(firstFocusable).toHaveFocus();
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the modal opens, focus moves to the first focusable element. ' +
          'Tab/Shift+Tab cycle is trapped within the dialog.',
      },
    },
  },
};

export const EscapeToClose: Story = {
  name: 'Escape to close',
  render: () => <ModalDemo label="Press Escape to close" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /open modal/i });
    await userEvent.click(trigger);
    const modal = within(document.body).getByRole('dialog');
    expect(modal).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    // ModalBase closes by switching to hidden classes (it does not unmount).
    expect(modal).toHaveClass('opacity-0');
    expect(modal).toHaveClass('pointer-events-none');
    // Focus should be restored to the trigger.
    expect(trigger).toHaveFocus();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pressing Escape closes the dialog and restores focus to the trigger button. ' +
          'ModalBase remains mounted and switches to hidden classes.',
      },
    },
  },
};

export const BlockedClose: Story = {
  name: 'Blocked close (canClose=false)',
  render: () => <ModalDemo label="Cannot close via escape/outside click" canClose={() => false} />,
  parameters: {
    docs: {
      description: {
        story:
          'When `canClose` returns false, Escape and outside-click are blocked. ' +
          'Only an explicit in-modal close action can dismiss the dialog.',
      },
    },
  },
};
