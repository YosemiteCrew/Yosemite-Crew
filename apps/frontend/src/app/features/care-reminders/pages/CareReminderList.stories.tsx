import { useLayoutEffect, type ReactNode } from 'react';
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

const OrgFixture = ({ children, revoked }: { children: ReactNode; revoked?: string[] }) => {
  useLayoutEffect(() => {
    const snapshot = useOrgStore.getState();
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    return () => {
      useOrgStore.setState(snapshot);
    };
  }, [revoked]);
  return <>{children}</>;
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
  decorators: [
    (Story, { parameters }) => (
      <OrgFixture revoked={parameters.revokedPermissions as string[] | undefined}>
        <div className="w-full max-w-[640px]">
          <Story />
        </div>
      </OrgFixture>
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
