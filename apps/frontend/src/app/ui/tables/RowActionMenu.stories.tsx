import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  IoCalendarOutline,
  IoEyeOutline,
  IoSwapHorizontalOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import RowActionMenu, { type RowMenuAction } from './RowActionMenu';

const ACTIONS: RowMenuAction[] = [
  {
    key: 'view',
    label: 'View details',
    icon: <IoEyeOutline size={16} />,
    onSelect: fn(),
    primary: true,
  },
  { key: 'reschedule', label: 'Reschedule', icon: <IoCalendarOutline size={16} />, onSelect: fn() },
  {
    key: 'status',
    label: 'Change status',
    icon: <IoSwapHorizontalOutline size={16} />,
    onSelect: fn(),
  },
  {
    key: 'cancel',
    label: 'Cancel appointment',
    icon: <IoTrashOutline size={16} />,
    onSelect: fn(),
    dividerBefore: true,
  },
];

const meta = {
  title: 'Tables/RowActionMenu',
  component: RowActionMenu,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The row kebab: one overflow menu standing in for a rail of icon buttons. Every data ' +
          'table in PIMS renders it - appointments, companions, forms, inventory - and it had no ' +
          'story at all.\n\n' +
          'That is the gap worth naming. The panel is `createPortal`ed and only exists after a ' +
          'click, so nothing in Storybook or Chromatic ever drew it. A whole class of defect ' +
          'hides in surfaces like this: the calendar submenus on the same `yc-glass-overlay` ' +
          'were filling their hovered and selected rows with literal white over a themed ' +
          'surface, and their dividers were invisible in light mode, for exactly as long as no ' +
          'story rendered them.\n\n' +
          'The stories below open the menu with a `play` function so the panel is under visual ' +
          'review, not just the 28px trigger.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    actions: ACTIONS,
    label: 'Row actions',
    onOpenChange: fn(),
  },
} satisfies Meta<typeof RowActionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Trigger only',
  parameters: {
    docs: { story: 'What every table shows until the reader asks for the menu.' },
  },
};

export const Open: Story = {
  name: 'Menu open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Row actions' }));
    // The panel portals out of the canvas, so assert against the document.
    await expect(document.querySelector('[role="menu"]')).toBeInTheDocument();
  },
};

export const SingleAction: Story = {
  name: 'One action',
  args: { actions: [ACTIONS[0]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Row actions' }));
    await expect(document.querySelector('[role="menu"]')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'A row with only one thing you can do. The divider rule ignores the first item, so no ' +
        'stray separator appears above it.',
    },
  },
};

export const ManyActions: Story = {
  name: 'Enough actions to flip the panel',
  args: {
    actions: [
      ...ACTIONS,
      {
        key: 'a',
        label: 'Assign room',
        icon: <IoSwapHorizontalOutline size={16} />,
        onSelect: fn(),
      },
      { key: 'b', label: 'Send reminder', icon: <IoCalendarOutline size={16} />, onSelect: fn() },
      { key: 'c', label: 'Print summary', icon: <IoEyeOutline size={16} />, onSelect: fn() },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Row actions' }));
    await expect(document.querySelector('[role="menu"]')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'The panel picks a side by available room, and falls back when neither side fits. A long ' +
        'menu is where that logic actually shows.',
    },
  },
};
