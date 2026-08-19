import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { Team } from '@/app/features/organization/types/team';
import AvailabilityCard from './index';

const speciality = (name: string): Team['speciality'][number] => ({
  _id: name.toLowerCase(),
  organisationId: 'org-1',
  name,
});

const baseTeam: Team = {
  _id: 'team-1',
  practionerId: 'practitioner-1',
  organisationId: 'org-1',
  name: 'Dr. Amelia Hart',
  role: 'VETERINARIAN',
  speciality: [speciality('Cardiology')],
  todayAppointment: '6',
  weeklyWorkingHours: '38.5',
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
};

const meta = {
  title: 'Cards/AvailabilityCard',
  component: AvailabilityCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The phone/tablet stand-in for one row of the team availability table. It carries the same ' +
          'avatar, role, specialities, appointment count and weekly hours as the desktop row, and closes ' +
          'with the shared StatusPill plus a full-width Secondary "View" action. Status tone comes from ' +
          '`getAvailabilityStatusTone`, so the card and the table row can never disagree about a colour.',
      },
    },
  },
  tags: ['autodocs'],
  args: { team: baseTeam, handleViewTeam: fn() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 340 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AvailabilityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {};

export const Consulting: Story = {
  args: {
    team: {
      ...baseTeam,
      _id: 'team-2',
      name: 'Dr. Ravi Menon',
      role: 'TECHNICIAN',
      status: 'Consulting',
      todayAppointment: '11',
    },
  },
};

export const OffDuty: Story = {
  name: 'Off duty',
  args: {
    team: {
      ...baseTeam,
      _id: 'team-3',
      name: 'Priya Raman',
      role: 'RECEPTIONIST',
      status: 'Off-Duty',
      todayAppointment: '0',
      weeklyWorkingHours: '0',
    },
  },
};

export const EmptyAndOverflowingFields: Story = {
  name: 'Empty and overflowing fields',
  args: {
    team: {
      ...baseTeam,
      _id: 'team-4',
      name: 'Dr. Wilhelmina Fitzgerald-Okonkwo',
      role: 'SUPERVISOR',
      speciality: [
        speciality('Cardiology'),
        speciality('Dermatology'),
        speciality('Internal Medicine'),
        speciality('Emergency & Critical Care'),
      ],
      status: 'Requested',
      weeklyWorkingHours: undefined,
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A long name plus four specialities: the label/value rows wrap rather than truncate, and ' +
          'a missing `weeklyWorkingHours` falls back to `0` instead of printing `NaN`.',
      },
    },
  },
};
