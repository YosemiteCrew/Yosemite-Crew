import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { WaitlistStatus } from '@/app/features/appointments/services/waitlistService';
import Waitlist, { type WaitlistEntryView } from './Waitlist';

const ORG_ID = 'org-storybook';

/**
 * A waitlist row as the container hands it to the presentational component: the
 * raw API entry plus the resolved `companionName`/`ownerName`. The dates are ISO
 * strings because the clinical handler returns the Prisma row unwrapped, and the
 * nullable columns are `null`, not `undefined`.
 */
const entry = (
  id: string,
  status: WaitlistStatus,
  companionName: string,
  ownerName: string,
  overrides: Partial<WaitlistEntryView> = {}
): WaitlistEntryView => ({
  id,
  organisationId: ORG_ID,
  patientId: `patient-${id}`,
  requestedBy: 'user-1',
  preferredLeadId: null,
  appointmentType: 'Dental',
  earliestDate: null,
  latestDate: null,
  notes: null,
  status,
  offeredAt: status === 'OFFERED' ? '2026-09-02T09:00:00.000Z' : null,
  bookedAt: status === 'BOOKED' ? '2026-09-02T11:00:00.000Z' : null,
  expiresAt: null,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-02T09:00:00.000Z',
  companionName,
  ownerName,
  ...overrides,
});

const ENTRIES: WaitlistEntryView[] = [
  entry('1', 'WAITING', 'Bruno', 'Sarah Whitfield', {
    appointmentType: 'Dental cleaning',
    notes: 'Flexible mornings',
  }),
  entry('2', 'WAITING', 'Mochi', 'Lena Hartmann', { appointmentType: 'Vaccination' }),
  entry('3', 'OFFERED', 'Poppy', 'Amir Rahimi', { appointmentType: 'Recheck' }),
  entry('4', 'BOOKED', 'Cleo', 'Nina Alvarez', { appointmentType: 'Surgery consult' }),
  entry('5', 'CANCELLED', 'Rex', 'Tom Becker', { appointmentType: 'Grooming' }),
];

const COMPANIONS = [
  { id: 'patient-1', name: 'Bruno', ownerName: 'Sarah Whitfield' },
  { id: 'patient-9', name: 'Ziggy', ownerName: 'Priya Nair' },
];

const meta = {
  title: 'Appointments/Waitlist',
  component: Waitlist,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Presentational waitlist panel. Each row shows the companion and owner, the ' +
          'requested service and reason, its FIFO queue position while WAITING, and a ' +
          '`StatusPill` for the status. The offer/book/cancel actions on a row follow what ' +
          'the backend permits from that status, and every action (plus the add form) only ' +
          'renders when the matching handler prop is supplied - which is how the container ' +
          'hides them from users without edit permission.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    entries: ENTRIES,
    companions: COMPANIONS,
    onOffer: fn(),
    onBook: fn(),
    onCancel: fn(),
    onAdd: fn(async () => true),
  },
} satisfies Meta<typeof Waitlist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Uppercased by StatusPill, so query the DOM casing.
    await expect(canvas.getAllByText('Waiting').length).toBe(2);
    await expect(canvas.getByText('Offered')).toBeInTheDocument();
    await expect(canvas.getByText('Booked')).toBeInTheDocument();
    // A WAITING row offers all three actions; a BOOKED row is terminal.
    await expect(canvas.getAllByRole('button', { name: 'Offer' }).length).toBe(2);
    await expect(canvas.getAllByRole('button', { name: 'Book' }).length).toBe(3);
  },
};

export const ReadOnly: Story = {
  name: 'Read only (no edit permission)',
  args: { onOffer: undefined, onBook: undefined, onCancel: undefined, onAdd: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: 'Offer' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Add to waitlist' })).not.toBeInTheDocument();
  },
};

export const AddForm: Story = {
  name: 'Add form open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Add to waitlist/ }));
    await expect(canvas.getByText('Companion')).toBeInTheDocument();
    await expect(canvas.getByText('Requested service')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No one is on the waitlist')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    // The skeleton renders instead of the empty message and instead of rows.
    await expect(
      within(canvasElement).queryByText('No one is on the waitlist')
    ).not.toBeInTheDocument();
  },
};

export const WithError: Story = {
  name: 'Error banner',
  args: { error: 'Unable to load the waitlist right now.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Unable to load the waitlist right now.'
    );
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
};
