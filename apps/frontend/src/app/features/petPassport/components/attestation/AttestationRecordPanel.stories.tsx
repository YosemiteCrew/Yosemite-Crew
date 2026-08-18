import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import AttestationRecordPanel from './AttestationRecordPanel';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';

/** A complete pet-parent upload: every review field has something to show. */
const RABIES_RECORD: CompanionRecord = {
  id: 'doc-rabies-2026',
  title: 'Rabies vaccination certificate',
  category: 'HEALTH',
  subcategory: 'VACCINATION',
  issueDate: '2026-01-04',
  issuingBusinessName: 'Harbourside Veterinary Group',
  uploadedByParentId: 'parent-42',
  attachments: [{ key: 'rabies-cert.pdf', mimeType: 'application/pdf' }],
};

const meta = {
  title: 'Pet Passport/Attestation/AttestationRecordPanel',
  component: AttestationRecordPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The parsed record beside the uploaded file: what the attestation actually says. The status ' +
          'pill and the sentence under it come from one table, so the pill can never claim something ' +
          'the sentence contradicts - "Signature pending" in particular reads as *not yet valid*, ' +
          'because a record only counts once Documenso reports the signature back.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    record: RABIES_RECORD,
    status: 'DRAFT',
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['DRAFT', 'IN_PROGRESS', 'SIGNED', 'VOID'],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AttestationRecordPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Draft: Story = {
  name: 'Not attested',
};

export const SignaturePending: Story = {
  name: 'Signature pending',
  args: { status: 'IN_PROGRESS' },
};

export const Attested: Story = {
  name: 'Attested',
  args: { status: 'SIGNED' },
};

export const Revoked: Story = {
  name: 'Revoked',
  args: { status: 'VOID' },
};

/**
 * The record as a hurried upload actually arrives: no issuer, no date, no file.
 * Nothing is dropped - an absent value reads as a dash or a plain statement, so
 * the vet can see exactly how little they would be signing their name to.
 */
export const SparseRecord: Story = {
  name: 'Sparse record',
  args: {
    record: {
      title: '',
      category: 'HEALTH',
      subcategory: 'OTHER',
      attachments: [],
    },
  },
};

/**
 * A long clinic name and a long title have to wrap inside a fixed 96px label
 * column rather than push the panel wider - it shares a two-up grid with the
 * document preview.
 */
export const LongValues: Story = {
  name: 'Long values',
  args: {
    record: {
      ...RABIES_RECORD,
      title: 'Rabies vaccination certificate and rabies antibody titration result (EU Annex IV)',
      issuingBusinessName:
        'Harbourside Veterinary Group - Referral Hospital and Travel Certification Centre',
      attachments: [
        { key: 'cert.pdf', mimeType: 'application/pdf' },
        { key: 'titration.jpg', mimeType: 'image/jpeg' },
      ],
    },
  },
};

export const EveryStatus: Story = {
  name: 'Every status',
  render: (args) => (
    <div className="flex flex-col gap-3">
      <AttestationRecordPanel {...args} status="DRAFT" />
      <AttestationRecordPanel {...args} status="IN_PROGRESS" />
      <AttestationRecordPanel {...args} status="SIGNED" />
      <AttestationRecordPanel {...args} status="VOID" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The four lifecycle states together, which is the view that catches a tone or wording drift ' +
          'between the pill and the sentence beneath it.',
      },
    },
  },
};
