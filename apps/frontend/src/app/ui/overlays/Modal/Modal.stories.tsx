import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import Modal from './index';

const Body = ({ title }: { title: string }) => (
  <div className="flex flex-col gap-3">
    <h2 id="modal-title" className="text-[17px] font-bold text-[var(--ink)]">
      {title}
    </h2>
    <p className="text-[13px] text-[var(--ink-muted)]">
      Panels supply their own header and actions. The Modal owns only the scrim, the panel geometry
      and the outside-click and escape handling, so anything inside here is the caller&apos;s.
    </p>
    <div className="rounded-2xl border border-card-border bg-card-hover p-3 text-[12px] text-[var(--ink-muted)]">
      Content block, to show the panel&apos;s inset and how it scrolls once the content outgrows the
      viewport.
    </div>
  </div>
);

/** Renders the modal already open. `showModal` is a prop, so no interaction is needed. */
const OpenModal = ({
  variant,
  size,
  title,
}: {
  variant?: 'drawer' | 'centered';
  size?: 'sm' | 'md' | 'lg';
  title: string;
}) => (
  <div className="min-h-[520px] bg-[var(--screen)] p-6">
    <p className="text-[13px] text-[var(--ink-muted)]">
      Page content behind the scrim, so the backdrop blur and tint are visible.
    </p>
    <Modal
      showModal
      setShowModal={fn()}
      variant={variant}
      size={size}
      aria-labelledby="modal-title"
    >
      <Body title={title} />
    </Modal>
  </div>
);

/** A real trigger, for the one story that exercises opening rather than the open state. */
const Triggered = ({ variant }: { variant?: 'drawer' | 'centered' }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-[520px] bg-[var(--screen)] p-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-primary-600 px-5 py-2 text-[14px] font-semibold text-white"
      >
        Open panel
      </button>
      <Modal
        showModal={open}
        setShowModal={setOpen}
        variant={variant}
        aria-labelledby="modal-title"
      >
        <Body title="Opened from a trigger" />
      </Modal>
    </div>
  );
};

const meta = {
  title: 'Overlays/Modal',
  component: OpenModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The shared overlay behind **26 call sites** across PIMS, and until now it had no story ' +
          'at all - the single most-used overlay in the app, never once drawn in Storybook or ' +
          'Chromatic.\n\n' +
          'It is really six panels, not one. Two variants (`drawer`, `centered`) x three widths ' +
          '(sm/md/lg), and each variant has its own width scale: a drawer is 360/470/530 because ' +
          'the design sizes a drawer to its content, while a centered dialog is 480/680/840. The ' +
          'defaults differ too - a caller naming no size gets `lg` as a drawer and `md` as a ' +
          'centered panel, so that adding sizes never moved an existing screen.\n\n' +
          'Below 768px both re-form: `centered` becomes a bottom sheet with a grabber, `drawer` ' +
          'goes full-screen. Callers pass nothing extra for that, so the phone stories are the ' +
          'only place the swap is visible.\n\n' +
          'The scrims differ as well, which is easy to miss without the stories side by side: the ' +
          'centered panel and the phone sheet use `var(--sh55)` with a 6px blur, the desktop ' +
          'drawer uses `--color-overlay-backdrop` with a 2px blur.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Panel title',
  },
} satisfies Meta<typeof OpenModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'Drawer (default, lg 530px)',
  args: { variant: 'drawer', title: 'Record detail' },
};

export const DrawerSmall: Story = {
  name: 'Drawer sm (360px)',
  args: { variant: 'drawer', size: 'sm', title: 'Record detail' },
  parameters: {
    docs: { story: 'The detail-peek width, used by Records.' },
  },
};

export const DrawerMedium: Story = {
  name: 'Drawer md (470px)',
  args: { variant: 'drawer', size: 'md', title: 'Restock item' },
  parameters: {
    docs: { story: 'The form width, used by Inventory restock.' },
  },
};

export const Centered: Story = {
  name: 'Centered (default, md 680px)',
  args: { variant: 'centered', title: 'Confirm changes' },
};

export const CenteredSmall: Story = {
  name: 'Centered sm (480px)',
  args: { variant: 'centered', size: 'sm', title: 'Delete record?' },
};

export const CenteredLarge: Story = {
  name: 'Centered lg (840px)',
  args: { variant: 'centered', size: 'lg', title: 'Add appointment' },
};

export const PhoneSheet: Story = {
  name: 'Phone: centered re-forms to a sheet',
  args: { variant: 'centered', title: 'Confirm changes' },
  globals: { viewport: { value: 'mobile1' } },
  parameters: {
    docs: {
      story:
        'Under 768px the centered panel becomes a bottom sheet with a grabber. `useIsPhone` is ' +
        'false during SSR and the first client render, so this is a post-mount swap - which is ' +
        'exactly the kind of state a static snapshot of the desktop markup never shows.',
    },
  },
};

export const PhoneFullScreen: Story = {
  name: 'Phone: drawer goes full-screen',
  args: { variant: 'drawer', title: 'Record detail' },
  globals: { viewport: { value: 'mobile1' } },
};

export const OpensFromTrigger: Story = {
  name: 'Opening from a trigger',
  render: () => <Triggered variant="centered" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Opened from a trigger')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Open panel' }));
    await expect(await canvas.findByText('Opened from a trigger')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The other stories render the panel already open, because `showModal` is a prop. This one ' +
        'goes through the real transition, so the fade and the panel mount are under review rather ' +
        'than only the resting state.',
    },
  },
};
