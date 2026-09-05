import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type {
  CheckInStatus,
  TriagePriority,
} from '@/app/features/appointments/services/patientCheckInService';
import CheckInBoard, { type PatientCheckInView } from './CheckInBoard';

const ORG_ID = 'org-storybook';

/**
 * A check-in row as the container hands it to the presentational board: the raw
 * API row plus the resolved `companionName`/`ownerName`/`roomName`. Dates are
 * ISO strings and the nullable columns are `null`, not `undefined`, because the
 * clinical handler returns the Prisma row unwrapped.
 */
const row = (
  id: string,
  status: CheckInStatus,
  triagePriority: TriagePriority,
  companionName: string,
  ownerName: string,
  overrides: Partial<PatientCheckInView> = {}
): PatientCheckInView => ({
  id,
  organisationId: ORG_ID,
  patientId: `patient-${id}`,
  clientId: `client-${id}`,
  appointmentId: null,
  arrivedAt: '2026-09-05T08:30:00.000Z',
  triagePriority,
  triageNote: null,
  assignedRoomId: null,
  checkedInBy: null,
  waitStartedAt: '2026-09-05T08:30:00.000Z',
  seenAt: null,
  waitMinutes: null,
  status,
  notes: null,
  createdAt: '2026-09-05T08:30:00.000Z',
  updatedAt: '2026-09-05T08:30:00.000Z',
  companionName,
  ownerName,
  ...overrides,
});

const ENTRIES: PatientCheckInView[] = [
  row('1', 'WAITING', 'STANDARD', 'Bruno', 'Sarah Whitfield', { waitMinutes: 12 }),
  row('2', 'WAITING', 'IMMEDIATE', 'Mochi', 'Lena Hartmann', {
    triageNote: 'Collapsed in the waiting room',
    waitMinutes: 2,
  }),
  row('3', 'WAITING', 'URGENT', 'Poppy', 'Amir Rahimi', { waitMinutes: 20 }),
  row('4', 'IN_CONSULTATION', 'LESS_URGENT', 'Cleo', 'Nina Alvarez', {
    roomName: 'Exam 2',
    assignedRoomId: 'room-2',
    waitMinutes: 8,
  }),
];

const COMPANIONS = [
  { id: 'patient-1', name: 'Bruno', ownerName: 'Sarah Whitfield', clientId: 'client-1' },
  { id: 'patient-9', name: 'Ziggy', ownerName: 'Priya Nair', clientId: 'client-9' },
];

const ROOMS = [
  { id: 'room-1', name: 'Exam 1' },
  { id: 'room-2', name: 'Exam 2' },
];

const meta = {
  title: 'Appointments/CheckInBoard',
  component: CheckInBoard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Presentational patient check-in / waiting-room board. Rows are sorted by ' +
          'triage priority then arrival, so the most urgent waiting patient is first. Each ' +
          'row shows a triage pill (IMMEDIATE/URGENT in a danger/warning tone), the patient ' +
          'and owner, the live wait time, a status pill, and the transition buttons the ' +
          'status permits. Every action (plus the add form and room assignment) only renders ' +
          'when the matching handler prop is supplied - which is how the container hides them ' +
          'from users without edit permission.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    entries: ENTRIES,
    companions: COMPANIONS,
    rooms: ROOMS,
    onToggleShowAll: fn(),
    onSeen: fn(),
    onComplete: fn(),
    onCancel: fn(),
    onNoShow: fn(),
    onAssignRoom: fn(),
    onAdd: fn(async () => true),
  },
} satisfies Meta<typeof CheckInBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Sorted most-urgent-first: the IMMEDIATE row is rendered ahead of the rest.
    const titles = canvas.getAllByText(/Bruno|Mochi|Poppy|Cleo/).map((el) => el.textContent);
    await expect(titles[0]).toBe('Mochi');
    await expect(canvas.getByText('Immediate')).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: 'Start consult' }).length).toBe(3);
    await expect(canvas.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Read only (no edit permission)',
  args: {
    onSeen: undefined,
    onComplete: undefined,
    onCancel: undefined,
    onNoShow: undefined,
    onAssignRoom: undefined,
    onAdd: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Start consult' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Check in patient' })
    ).not.toBeInTheDocument();
  },
};

export const AddForm: Story = {
  name: 'Add form open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Check in patient/ }));
    await expect(canvas.getByText('Patient')).toBeInTheDocument();
    await expect(canvas.getByText('Triage priority')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No patients are checked in')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText('No patients are checked in')
    ).not.toBeInTheDocument();
  },
};

export const WithError: Story = {
  name: 'Error banner',
  args: { error: 'Unable to load the check-in board right now.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Unable to load the check-in board right now.'
    );
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
};
