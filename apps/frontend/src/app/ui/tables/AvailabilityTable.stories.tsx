import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import AvailabilityTable from './AvailabilityTable';
import type { Team } from '@/app/features/organization/types/team';

const ORG_ID = 'org-availability-table-story';

const speciality = (name: string, index: number) =>
  ({ _id: `spec-${index}`, name, organisationId: ORG_ID }) as Team['speciality'][number];

const member = (
  index: number,
  name: string,
  role: string,
  specialities: string[],
  overrides: Partial<Team> = {}
): Team => ({
  _id: `team-${index}`,
  practionerId: `prac-${index}`,
  organisationId: ORG_ID,
  name,
  role,
  speciality: specialities.map((s, i) => speciality(s, index * 10 + i)),
  todayAppointment: String(index + 2),
  weeklyWorkingHours: '38',
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
  ...overrides,
});

const TEAM: Team[] = [
  member(1, 'Dr. Amara Weber', 'VET', ['General practice']),
  member(2, 'Dr. Ravi Menon', 'VET', ['Orthopaedics', 'Diagnostic imaging']),
  member(3, 'Nurse Halloran', 'NURSE', ['General practice'], {
    todayAppointment: '0',
    status: 'Off-Duty',
  }),
  member(4, 'Priya Raman', 'RECEPTIONIST', [], { weeklyWorkingHours: '20' }),
  member(5, 'Dr. Lena Lindqvist', 'VET', ['Dentistry', 'Dermatology'], {
    status: 'Consulting',
  }),
];

const meta = {
  title: 'Tables/AvailabilityTable',
  component: AvailabilityTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The team roster with each member's specialities, today's load and weekly hours. The " +
          'speciality cell is the interesting one: joining every name made it the only cell in ' +
          'PIMS whose height tracked its data - six specialities wrapped to six lines and ' +
          'stretched the row to 159px beside a 67px neighbour - so it now leads with the first ' +
          'and counts the rest, keeping the full list on hover.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: TEAM,
    setActive: fn(),
    setView: fn(),
  },
} satisfies Meta<typeof AvailabilityTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'The team roster',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Dr. Amara Weber').length).toBeGreaterThan(0);
    // Roles are stored SCREAMING_CASE and shown title-cased.
    await expect(canvas.queryByText('RECEPTIONIST')).toBeNull();
  },
};

export const OverflowCount: Story = {
  name: 'A member with more specialities than fit',
  args: {
    filteredList: [
      member(9, 'Dr. Konstantina Papadopoulou', 'VET', [
        'Internal medicine',
        'Cardiology',
        'Oncology',
        'Neurology',
        'Soft tissue surgery',
        'Emergency and critical care',
      ]),
      ...TEAM,
    ],
  },
  play: async ({ canvasElement }) => {
    /* The "+5" is a non-shrinking sibling of the truncating name, not a child of
       it - clamping the combined line let a long first speciality push the count
       past the clip edge, so the only hint that more existed vanished exactly
       when it was needed most. */
    const counts = within(canvasElement).getAllByText('+5');
    await expect(counts.length).toBeGreaterThan(0);
    await expect(counts[0].getBoundingClientRect().width).toBeGreaterThan(0);
  },
};

export const NoSpeciality: Story = {
  name: 'A member with no speciality',
  play: async ({ canvasElement }) => {
    // A hyphen rather than a blank: the roster row still reads as complete.
    await expect(within(canvasElement).getAllByText('-').length).toBeGreaterThan(0);
  },
};

export const OpensAMember: Story = {
  name: 'Viewing a member',
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getAllByRole('button')[0]);
    await expect(args.setActive).toHaveBeenCalledTimes(1);
    await expect(args.setView).toHaveBeenCalledWith(true);
  },
};

export const WithoutActions: Story = {
  name: 'Read-only (actions hidden)',
  args: { hideActions: true },
  play: async ({ canvasElement }) => {
    // `hideActions` is used where the roster is embedded for reference only, so
    // no view control should survive it.
    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
  },
};

export const Empty: Story = {
  name: 'No team members',
  args: { filteredList: [] },
};

export const Phone: Story = {
  name: 'Phone: the rows become cards',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
