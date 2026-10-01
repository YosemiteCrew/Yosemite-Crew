import type { Meta, StoryObj } from '@storybook/react';
import type { UserOrganization } from '@yosemite-crew/types';
import { expect, fn, userEvent, within } from 'storybook/test';

import { useOrgStore } from '@/app/stores/orgStore';
import type { CareReminder } from '@/app/services/careReminderService';
import CareReminderList from './CareReminderList';

const ORG_ID = 'org-care-reminder-list-story';

const membership = (revokedPermissions: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/story-vet',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions,
});

/**
 * Seeds the membership the Send button's `PermissionGate` reads, before the story
 * renders rather than from an effect after its first render, so the gate never
 * answers for whatever organisation the previous story left in the store.
 * `parameters.revokedPermissions` takes a right off, as a practice would.
 */
const seedOrg = ({ parameters }: { parameters: { revokedPermissions?: string[] } }) => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: membership(parameters.revokedPermissions) },
    status: 'loaded',
  });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

const base: CareReminder = {
  id: 'reminder-pending',
  patientId: 'pet-milo',
  reminderType: 'VACCINATION_BOOSTER',
  dueDate: '2026-10-14T11:00:00.000Z',
  sendAt: null,
  status: 'PENDING',
  sendingAt: null,
  lastAttemptAt: null,
  lastDelivery: null,
};

const REMINDERS: CareReminder[] = [
  base,
  {
    ...base,
    id: 'reminder-sent',
    patientId: 'pet-luna',
    reminderType: 'DENTAL_CLEANING',
    status: 'SENT',
    lastAttemptAt: '2026-09-28T09:30:00.000Z',
    lastDelivery: { push: 'delivered', email: 'suppressed' },
  },
  {
    ...base,
    id: 'reminder-failed',
    patientId: 'pet-otis',
    reminderType: 'PARASITE_TREATMENT',
    lastAttemptAt: '2026-09-29T08:00:00.000Z',
    lastDelivery: { push: 'failed', email: 'unreachable' },
  },
];

const NAMES = { 'pet-milo': 'Milo', 'pet-luna': 'Luna', 'pet-otis': 'Otis' };

const meta = {
  title: 'Care reminders/CareReminderList',
  component: CareReminderList,
  parameters: { layout: 'padded' },
  args: {
    organisationId: ORG_ID,
    loading: false,
    reminders: REMINDERS,
    namesById: NAMES,
    sendingId: null,
    onSend: fn(),
  },
  beforeEach: seedOrg,
  decorators: [
    (Story) => (
      <div className="w-full max-w-[640px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CareReminderList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeliveryOutcomes: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Milo · Vaccination booster')).toBeVisible();
    await expect(canvas.getByText('Not sent yet')).toBeVisible();
    await expect(canvas.getByText('Push delivered · Email opted out')).toBeVisible();
    await expect(canvas.getByText('Push not delivered · Email no destination')).toBeVisible();
    await expect(canvas.getByText('Sent')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Retry send' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Send now' }));
    await expect(args.onSend).toHaveBeenCalledWith('reminder-pending');
  },
};

export const SendInProgress: Story = {
  args: {
    reminders: [{ ...base, status: 'SENDING', sendingAt: '2026-09-30T10:00:00.000Z' }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Delivery in progress')).toBeVisible();
    await expect(canvas.getByText('Sending')).toBeVisible();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

export const ViewOnly: Story = {
  parameters: { revokedPermissions: ['appointments:edit:any'] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not sent yet')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Send now' })).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { reminders: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No care reminders yet.')).toBeVisible();
  },
};

export const NoPractice: Story = {
  args: { organisationId: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Select a practice to view care reminders.')
    ).toBeVisible();
  },
};
