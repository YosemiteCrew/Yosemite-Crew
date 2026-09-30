import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { OrganisationAuditEntry } from '@/app/features/audit/types/audit';
import { useOrgStore } from '@/app/stores/orgStore';
import { OrganisationAuditContent } from './OrganisationAuditPage';

const ORG_ID = 'org-audit-story';

const ENTRIES: OrganisationAuditEntry[] = [
  {
    id: 'audit-event-1',
    patientId: 'patient-1042',
    eventType: 'APPOINTMENT_CREATED',
    actorType: 'PMS_USER',
    actorName: 'Avery Chen',
    entityType: 'APPOINTMENT',
    occurredAt: '2026-09-28T09:00:00.000Z',
  },
  {
    id: 'audit-event-2',
    patientId: 'patient-2086',
    eventType: 'INVOICE_PAID',
    actorType: 'SYSTEM',
    actorName: null,
    entityType: 'INVOICE',
    occurredAt: '2026-09-27T15:30:00.000Z',
  },
];

const loadStoryFeed = async () => ({ entries: ENTRIES, nextCursor: null });

const setup = () => {
  const snapshot = useOrgStore.getState();

  useOrgStore.setState({ primaryOrgId: ORG_ID });

  return () => {
    useOrgStore.setState(snapshot);
  };
};

const meta = {
  title: 'Audit/Organisation audit log',
  component: OrganisationAuditContent,
  parameters: { layout: 'fullscreen' },
  args: { loadFeed: loadStoryFeed },
  beforeEach: setup,
} satisfies Meta<typeof OrganisationAuditContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Activity: Story = {
  tags: ['audit-log'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    // The heading renders at once; the rows arrive when the feed resolves.
    await expect(await canvas.findByText('Appointment booked')).toBeInTheDocument();
    await expect(canvas.getByText('Payment received')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Export loaded activity' })).toBeEnabled();
  },
};
