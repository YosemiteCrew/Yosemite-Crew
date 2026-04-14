import type { Meta, StoryObj } from '@storybook/react';
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
          'and responsive container sizing. Compose with `ModalHeader` and your own content.',
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
        className="px-6 py-3 bg-text-primary text-white rounded-2xl text-body-3-emphasis"
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
              className="px-6 py-3 bg-text-primary text-white rounded-2xl text-body-3-emphasis"
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
        className="px-6 py-3 bg-text-error text-white rounded-2xl text-body-3-emphasis"
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
                    className="px-6 py-3 bg-text-error text-white rounded-2xl text-body-3-emphasis"
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
