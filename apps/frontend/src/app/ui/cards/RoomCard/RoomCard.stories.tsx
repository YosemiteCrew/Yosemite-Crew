import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { OrganisationRoom } from '@yosemite-crew/types';

import RoomCard from './index';

const SPECIALITY_NAMES: Record<string, string> = {
  'spec-cardio': 'Cardiology',
  'spec-derm': 'Dermatology',
  'spec-ortho': 'Orthopaedics',
  'spec-onco': 'Oncology',
};

const STAFF_NAMES: Record<string, string> = {
  'staff-1': 'Dr. Alina Moreau',
  'staff-2': 'Dr. Tomas Reyes',
  'staff-3': 'Nurse Priya Raman',
  'staff-4': 'Dr. Yusuf Adeyemi',
};

const baseRoom: OrganisationRoom = {
  id: 'room-1',
  name: 'Exam Room 2',
  organisationId: 'org-sunrise',
  code: 'EX-02',
  type: 'EXAM_ROOM',
  assignedSpecialiteis: [{ id: 'spec-cardio', name: 'Cardiology' }],
  assignedStaffs: [{ id: 'staff-1', name: 'Dr. Alina Moreau' }],
};

const meta = {
  title: 'Cards/RoomCard',
  component: RoomCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The tile used on the rooms grid in organisation settings. It states the room name, its ' +
          'title-cased type and the specialities and staff assigned to it, with a full-width ' +
          '`Secondary` "View" action that opens the room drawer. Names are resolved through the ' +
          'id-to-name maps the page already holds, so the card never has to fetch anything itself. ' +
          'It sizes itself to half the row from the `sm` breakpoint up and goes full width below it.',
      },
    },
  },
  argTypes: {
    handleViewRoom: { table: { disable: true } },
  },
  args: {
    room: baseRoom,
    handleViewRoom: fn(),
    specialityNameById: SPECIALITY_NAMES,
    staffNameById: STAFF_NAMES,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Assigned room',
};

export const Unassigned: Story = {
  name: 'Nothing assigned',
  args: {
    room: {
      ...baseRoom,
      id: 'room-2',
      name: 'Isolation Bay',
      code: 'ISO-01',
      type: 'ISOLATION',
      assignedSpecialiteis: [],
      assignedStaffs: [],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A room with no specialities or staff yet. Both lines fall back to a single dash rather than ' +
          'collapsing, so every card in the grid keeps the same four-line height and the "View" buttons ' +
          'stay on one baseline.',
      },
    },
  },
};

export const ManyAssignments: Story = {
  name: 'Many assignments (wrapping)',
  args: {
    room: {
      ...baseRoom,
      id: 'room-3',
      name: 'Surgical Theatre 1 - Orthopaedics and Soft Tissue',
      code: 'SURG-01',
      type: 'SURGERY',
      assignedSpecialiteis: [
        { id: 'spec-cardio', name: 'Cardiology' },
        { id: 'spec-derm', name: 'Dermatology' },
        { id: 'spec-ortho', name: 'Orthopaedics' },
        { id: 'spec-onco', name: 'Oncology' },
      ],
      assignedStaffs: [
        { id: 'staff-1', name: 'Dr. Alina Moreau' },
        { id: 'staff-2', name: 'Dr. Tomas Reyes' },
        { id: 'staff-3', name: 'Nurse Priya Raman' },
        { id: 'staff-4', name: 'Dr. Yusuf Adeyemi' },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'The assignment lines are a comma-joined list, so a busy theatre grows the card downwards. ' +
          'This is the case that tells you whether a grid of cards still reads as a grid once one tile ' +
          'is twice the height of its neighbours.',
      },
    },
  },
};
