import type { Meta, StoryObj } from '@storybook/react';
import ConsentList from './ConsentList';
import type { PatientConsent } from '@/app/features/companionHistory/services/patientConsentService';

const consent = (over: Partial<PatientConsent>): PatientConsent => ({
  id: over.id ?? 'c-1',
  organisationId: 'org-1',
  patientId: 'pat-1',
  consentType: over.consentType ?? 'SURGICAL',
  status: over.status ?? 'ACTIVE',
  procedureDesc: over.procedureDesc ?? null,
  consentedByName: over.consentedByName ?? null,
  consentedAt: over.consentedAt ?? '2026-01-10T09:00:00.000Z',
  expiresAt: over.expiresAt ?? null,
  witnessedBy: over.witnessedBy ?? null,
  revokedAt: over.revokedAt ?? null,
  revokedReason: over.revokedReason ?? null,
  documentId: null,
  notes: over.notes ?? null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

const SAMPLE: PatientConsent[] = [
  consent({
    id: 'c-1',
    consentType: 'SURGICAL',
    status: 'ACTIVE',
    procedureDesc: 'Cranial cruciate ligament repair (left stifle)',
    consentedByName: 'Lena Hartmann',
    consentedAt: '2026-01-08T09:00:00.000Z',
    witnessedBy: 'Dr. Okafor',
    notes: 'Owner briefed on anaesthetic risk and post-op physiotherapy.',
  }),
  consent({
    id: 'c-2',
    consentType: 'DNR',
    status: 'ACTIVE',
    consentedByName: 'Lena Hartmann',
    consentedAt: '2026-01-08T09:05:00.000Z',
    notes: 'Do not resuscitate on cardiac or respiratory arrest.',
  }),
  consent({
    id: 'c-3',
    consentType: 'DATA_SHARING',
    status: 'EXPIRED',
    consentedByName: 'Lena Hartmann',
    consentedAt: '2025-01-02T09:00:00.000Z',
    expiresAt: '2026-01-02T00:00:00.000Z',
  }),
  consent({
    id: 'c-4',
    consentType: 'ANESTHESIA',
    status: 'REVOKED',
    consentedByName: 'Lena Hartmann',
    consentedAt: '2025-11-02T09:00:00.000Z',
    revokedAt: '2025-11-20T09:00:00.000Z',
    revokedReason: 'Procedure postponed at the owner’s request.',
  }),
];

const meta = {
  title: 'CompanionHistory/ConsentList',
  component: ConsentList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: {
    canEdit: true,
    consents: SAMPLE,
    onGrant: async () => true,
    onRevoke: async () => true,
  },
} satisfies Meta<typeof ConsentList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const ReadOnly: Story = {
  args: { canEdit: false },
};

export const Empty: Story = {
  args: { consents: [] },
};

export const Loading: Story = {
  args: { consents: [], loading: true },
};

export const WithError: Story = {
  args: { error: 'Could not load the consent list. Please try again.' },
};
