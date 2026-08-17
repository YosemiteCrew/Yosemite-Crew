import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import RoomSubmenu from './RoomSubmenu';
import { getRoomSavingKey, type RoomOption } from './appointmentContextMenuHelpers';

const room = (key: string, label: string, selected = false): RoomOption => ({
  key,
  label,
  selected,
  onSelect: fn(),
});

const ROOMS: RoomOption[] = [
  room('consult-1', 'Consult 1'),
  room('consult-2', 'Consult 2', true),
  room('theatre', 'Theatre'),
  room('isolation', 'Isolation ward'),
];

const meta = {
  title: 'Appointments/RoomSubmenu',
  component: RoomSubmenu,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The room picker that flies out of the appointment context menu. It renders on the ' +
          '`yc-glass-overlay` surface, whose background is `var(--screen)` and therefore follows ' +
          'the theme.\n\n' +
          'Two contrast defects lived here and both are only visible with the theme switched, ' +
          'which is why this story exists. The hovered and currently-assigned rows were filled ' +
          'with **literal white** (`bg-white/50` and `bg-white/58`) while the label used ' +
          '`text-text-primary`, a themed ink - in dark that put a light ink on a near-#a1a1a0 row ' +
          'at roughly 2.1:1. They now use the themed hairline tints, so fill and ink move ' +
          'together. Separately the "Current" badge was `opacity-60` on 8px text; the row is an ' +
          'enabled button except while a save is in flight, so the dim was not a disabled state - ' +
          'it is `--ink-muted` now.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    submenuRef: React.createRef<HTMLDivElement>(),
    submenuStyle: { position: 'static', width: 240 },
    roomOptions: ROOMS,
    savingKey: null,
  },
} satisfies Meta<typeof RoomSubmenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'With a current room',
};

export const Saving: Story = {
  args: { savingKey: getRoomSavingKey('theatre') },
  parameters: {
    docs: {
      description: {
        story:
          'While a reassignment is in flight every row is disabled and the pending one carries a ' +
          '"Saving" badge. This is the only state in which the rows are genuinely inactive.',
      },
    },
  },
};

export const NoRooms: Story = {
  name: 'No rooms configured',
  args: { roomOptions: [] },
};
