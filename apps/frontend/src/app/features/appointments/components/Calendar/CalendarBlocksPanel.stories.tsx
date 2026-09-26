import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import CalendarBlocksPanel from './CalendarBlocksPanel';

const meta = {
  title: 'Appointments/Calendar/CalendarBlocksPanel',
  component: CalendarBlocksPanel,
  parameters: { layout: 'padded' },
  args: {
    blocks: [
      {
        id: 'block-lunch',
        organisationId: 'org-story',
        targetType: 'STAFF',
        targetId: 'staff-1',
        startAt: '2026-09-26T11:00:00.000Z',
        endAt: '2026-09-26T12:00:00.000Z',
        reason: 'Lunch break',
        createdBy: 'user-1',
        createdAt: '2026-09-26T10:00:00.000Z',
        updatedAt: '2026-09-26T10:00:00.000Z',
      },
    ],
    teams: [
      {
        _id: 'staff-1',
        practionerId: 'staff-1',
        organisationId: 'org-story',
        name: 'Dr. Rivera',
        role: 'Veterinarian',
        speciality: [],
        status: 'Available',
        revokedPermissions: [],
        effectivePermissions: [],
        extraPerissions: [],
      },
    ],
    rooms: [],
    canEdit: true,
    onSave: fn(async () => undefined),
    onDelete: fn(async () => undefined),
  },
} satisfies Meta<typeof CalendarBlocksPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaffLunchBlock: Story = {
  name: 'A named staff block',
};

export const ReadOnly: Story = {
  args: { canEdit: false },
};
