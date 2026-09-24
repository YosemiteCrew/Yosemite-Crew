import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import ConsentList from './ConsentList';
import type { PatientConsent } from '@/app/features/companionHistory/services/patientConsentService';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';

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

// Consent PDFs from the e-signing portal, titled with their template's name: a
// submitted consent is listed before anyone signs it.
const CONSENT_DOCUMENTS: CompanionRecord[] = [
  {
    id: 'doc-signed',
    title: 'Surgical consent',
    category: 'HEALTH',
    subcategory: 'SURGERY_OR_PROCEDURE',
    attachments: [],
    signedAt: '2026-01-08T10:00:00.000Z',
    pdfUrl: 'https://files.example.com/surgical-consent.pdf',
    sourceKind: 'TEMPLATE_INSTANCE',
  },
  {
    id: 'doc-unsigned',
    title: 'Anaesthesia consent',
    category: 'HEALTH',
    subcategory: 'SURGERY_OR_PROCEDURE',
    attachments: [],
    signedAt: null,
    pdfUrl: null,
    sourceKind: 'TEMPLATE_INSTANCE',
  },
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

export const WithConsentDocuments: Story = {
  args: { signedDocuments: CONSENT_DOCUMENTS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Consent documents')).toBeVisible();
    await expect(canvas.queryByText('Signed documents')).not.toBeInTheDocument();

    const signedRow = canvas.getByText('Surgical consent').closest('li') as HTMLElement;
    await expect(within(signedRow).getByText(/^Signed /)).toBeVisible();
    await expect(
      within(signedRow).getByRole('button', { name: 'View consent document: Surgical consent' })
    ).toBeVisible();

    const unsignedRow = canvas.getByText('Anaesthesia consent').closest('li') as HTMLElement;
    await expect(within(unsignedRow).getByText('Not signed yet')).toBeVisible();
    await expect(within(unsignedRow).queryByRole('button')).not.toBeInTheDocument();
  },
};
