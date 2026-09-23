import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import DocumentsListPanel from './DocumentsListPanel';

const ORG_ID = 'org-storybook-documents-panel';
const COMPANION_ID = 'companion-documents-panel';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Foxglove Animal Hospital',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const record = (over: Partial<CompanionRecord> & { title: string }): CompanionRecord => ({
  category: 'HEALTH',
  subcategory: 'LAB_TEST',
  attachments: [{ key: 'doc.pdf', mimeType: 'application/pdf', size: 184_320 }],
  pmsVisible: true,
  ...over,
});

const RECORDS_BY_COMPANION: Record<string, CompanionRecord[]> = {
  [COMPANION_ID]: [
    record({
      id: 'rec-1',
      title: 'Rabies vaccination certificate',
      subcategory: 'VACCINATION',
      issueDate: '2026-07-14',
      issuingBusinessName: ORG.name,
      syncedFromPms: true,
      uploadedByPmsUserId: 'pms-user-1',
    }),
  ],
  'companion-documents-panel-empty': [],
};

const REAL_ADAPTER = api.defaults.adapter;

/**
 * This panel is a thin card shell; the fetch, filters and empty state all
 * belong to `CompanionDocumentsSection` and are exercised in full over there.
 * What only this file can prove is that the shell threads `companionId`
 * through correctly and keeps its own heading/icon on screen regardless of
 * what the section renders inside it - the same seam
 * `CompanionDocumentsSection.stories.tsx` stubs, routed on the id in the URL.
 */
const documentsAdapter: AxiosAdapter = async (config) => {
  const url = String(config.url ?? '');
  // The id is the URL's own trailing path segment (/v1/document/pms/<id>), so
  // matching on that rather than substring inclusion keeps the empty-state id
  // from also matching the loaded one it's prefixed with.
  const companionId = Object.keys(RECORDS_BY_COMPANION).find((id) => url.endsWith(`/${id}`));
  if (!companionId) {
    throw new Error(`Unstubbed request in DocumentsListPanel.stories: ${url}`);
  }
  const response: AxiosResponse = {
    data: RECORDS_BY_COMPANION[companionId],
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
  return response;
};

const seedEnvironment = () => {
  const snapshot = useOrgStore.getState();
  api.defaults.adapter = documentsAdapter;

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgIds: [ORG_ID],
    orgsById: { [ORG_ID]: ORG },
    membershipsByOrgId: { [ORG_ID]: OWNER },
    status: 'loaded',
  });

  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    useOrgStore.setState(snapshot);
  };
};

const meta = {
  title: 'CompanionHistory/DocumentsListPanel',
  component: DocumentsListPanel,
  tags: ['autodocs'],
  args: { companionId: COMPANION_ID },
  beforeEach: seedEnvironment,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The card shell around `CompanionDocumentsSection` on the companion-history page. ' +
          'Every other panel here (Problem list, Allergies, Consents, Patient flags, In-house lab ' +
          'results) fetches and renders itself; this one only supplies the heading, icon and card ' +
          'chrome, and passes `companionId` straight through - `CompanionDocumentsSection` owns ' +
          'its own permission gate, fetching and empty state.',
      },
    },
  },
} satisfies Meta<typeof DocumentsListPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Documents loaded',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(await canvas.findByText('Rabies vaccination certificate')).toBeVisible();
  },
};

export const Empty: Story = {
  name: 'No documents yet',
  args: { companionId: 'companion-documents-panel-empty' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The shell's own heading stays up even when the section inside it has
    // nothing to show - it is not conditional on the fetch result.
    await expect(await canvas.findByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(await canvas.findByText('No records yet')).toBeVisible();
  },
};
