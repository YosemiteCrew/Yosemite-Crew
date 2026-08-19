import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { UserOrganization } from '@yosemite-crew/types';

import PassportAttestationAction from './PassportAttestationAction';
import type { PassportLinkedRecord, PassportRecordStatus } from './attestationModel';
import { useOrgStore } from '@/app/stores/orgStore';

const ORG_ID = 'org-storybook';

/**
 * Permissions are derived from `roleCode` against the role table rather than
 * from the stored snapshot, so seeding the role is the whole fixture. Only
 * VETERINARIAN carries `passport:attest:any`; TECHNICIAN carries
 * `passport:edit:any` - it may capture passport records but never attest one.
 */
const membership = (roleCode: string, roleDisplay: string): UserOrganization => ({
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode,
  roleDisplay,
  active: true,
});

const withRole = (role: UserOrganization) => () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: role },
    status: 'loaded',
  });
  return () => {
    useOrgStore.setState(snapshot);
  };
};

const VETERINARIAN = membership('VETERINARIAN', 'Veterinarian');
const TECHNICIAN = membership('TECHNICIAN', 'Veterinary technician');

const LINKED_RECORD: PassportLinkedRecord = {
  id: 'doc-rabies-2026',
  title: 'Rabies vaccination certificate',
  category: 'HEALTH',
  subcategory: 'VACCINATION',
  issueDate: '2026-01-04',
  issuingBusinessName: 'Harbourside Veterinary Group',
  uploadedByParentId: 'parent-42',
  attachments: [{ key: 'rabies-cert.pdf', mimeType: 'application/pdf' }],
  passportRecordId: 'artifact-8801',
  passportRecordStatus: 'DRAFT',
};

const recordWithStatus = (
  passportRecordStatus: PassportRecordStatus | null
): PassportLinkedRecord => ({ ...LINKED_RECORD, passportRecordStatus });

/** The same document before it was ever captured into a passport record. */
const UNLINKED_RECORD: PassportLinkedRecord = { ...LINKED_RECORD, passportRecordId: null };

/**
 * The action never stands alone - it sits at the end of the record it belongs
 * to. The row is drawn here so the stories where the action is absent still
 * show something, which is the point of the permission variants.
 */
const RecordRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-full max-w-[560px] items-center justify-between gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--screen)] px-4 py-3">
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-[13px] font-bold text-[var(--ink)]">
        Rabies vaccination certificate
      </span>
      <span className="text-[11.5px] text-[var(--ink-faint)]">
        Uploaded by the pet parent - 4 Jan 2026
      </span>
    </span>
    {children}
  </div>
);

const meta = {
  title: 'Pet Passport/Attestation/PassportAttestationAction',
  component: PassportAttestationAction,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The veterinarian’s way into review-and-attest, beside the record it belongs to. It is hidden ' +
          'for anyone without `passport:attest:any` - the backend is the real boundary, but a button ' +
          'that can only ever 403 is not worth showing - and hidden for records the API has not linked ' +
          'to a passport record, because the attestation routes have nothing to address without that ' +
          'id. The label tracks the record’s status, so the row says what opening it will offer.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    companionId: 'companion-storybook',
    record: LINKED_RECORD,
  },
  beforeEach: withRole(VETERINARIAN),
  render: (args) => (
    <RecordRow>
      <PassportAttestationAction {...args} />
    </RecordRow>
  ),
} satisfies Meta<typeof PassportAttestationAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Veterinarian: Story = {
  name: 'Veterinarian - not attested',
};

export const SignaturePending: Story = {
  name: 'Veterinarian - signature pending',
  args: { record: recordWithStatus('IN_PROGRESS') },
};

export const Attested: Story = {
  name: 'Veterinarian - attested',
  args: { record: recordWithStatus('SIGNED') },
};

export const Revoked: Story = {
  name: 'Veterinarian - revoked',
  args: { record: recordWithStatus('VOID') },
};

/**
 * A record the API returned with an unrecognised status. "Not attested yet" is
 * the only claim that is safe to make without knowing, so the row falls back to
 * the draft label rather than hiding the action or inventing a state.
 */
export const UnknownStatus: Story = {
  name: 'Veterinarian - unknown status',
  args: { record: recordWithStatus(null) },
};

/**
 * A technician holds `passport:edit:any` and captures passport records all day,
 * but attestation is a veterinary act: the affordance is absent, not disabled.
 */
export const NonVetStaff: Story = {
  name: 'Technician - no attest affordance',
  beforeEach: withRole(TECHNICIAN),
};

/**
 * The document has not been captured into a passport record, so there is no
 * ClinicalArtifact id for the attestation routes to address and the action stays
 * hidden - for a veterinarian too.
 */
export const NotLinked: Story = {
  name: 'Record not linked to a passport record',
  args: { record: UNLINKED_RECORD },
};
