import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import Documents from './Documents';

const ORG_ID = 'org-storybook-companion-documents';
const ORG_NAME = 'Harbourside Veterinary Group';

const PARENT: StoredParent = {
  id: 'parent-lena',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const companion = (id: string, name: string): StoredCompanion => ({
  id,
  organisationId: ORG_ID,
  parentId: PARENT.id,
  name,
  type: 'dog',
  breed: 'Beagle',
  dateOfBirth: new Date(2021, 3, 18),
  gender: 'female',
  isInsured: false,
});

const POPPY: CompanionParent = { companion: companion('companion-poppy', 'Poppy'), parent: PARENT };
const MISO: CompanionParent = { companion: companion('companion-miso', 'Miso'), parent: PARENT };

const record = (over: Partial<CompanionRecord> & { title: string }): CompanionRecord => ({
  category: 'HEALTH',
  subcategory: 'LAB_TEST',
  attachments: [{ key: 'doc.pdf', mimeType: 'application/pdf', size: 184_320 }],
  pmsVisible: true,
  ...over,
});

const POPPY_RECORDS: CompanionRecord[] = [
  record({
    id: 'rec-rabies',
    title: 'Rabies vaccination certificate',
    subcategory: 'VACCINATION',
    issueDate: '2026-02-14',
    issuingBusinessName: ORG_NAME,
    syncedFromPms: true,
    uploadedByPmsUserId: 'vet-weber',
  }),
  record({
    id: 'rec-dental',
    title: 'Dental chart and treatment plan',
    subcategory: 'SURGERY_OR_PROCEDURE',
    issueDate: '2026-02-02',
    issuingBusinessName: ORG_NAME,
    syncedFromPms: true,
  }),
  record({
    id: 'rec-grooming',
    title: 'Grooming record from previous salon',
    category: 'HYGIENE_MAINTENANCE',
    subcategory: 'GROOMING',
    issueDate: '2026-01-06',
    issuingBusinessName: 'Bayside Grooming',
    uploadedByParentId: PARENT.id,
  }),
];

const RECORDS_BY_COMPANION: Record<string, CompanionRecord[]> = {
  [POPPY.companion.id]: POPPY_RECORDS,
  [MISO.companion.id]: [],
};

/**
 * `loadCompanionDocument` GETs `/v1/document/pms/:companionId` on mount and the
 * section keeps its records in local state, so the loaded list is only reachable
 * through an answered request. The stub is the shared axios instance's adapter,
 * routed on the companion id in the URL.
 */
const REAL_ADAPTER = api.defaults.adapter;

const documentsAdapter: AxiosAdapter = async (config) => {
  const url = String(config.url ?? '');
  const companionId = Object.keys(RECORDS_BY_COMPANION).find((id) => url.includes(id));
  if (!companionId) {
    throw new Error(`Unstubbed request in Companions/Sections/Documents.stories: ${url}`);
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

/** An OWNER membership: `companions:view:any` for the section, `companions:edit:any` for the CTA. */
const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const seed = () => {
  const snapshot = useOrgStore.getState();
  api.defaults.adapter = documentsAdapter;

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgIds: [ORG_ID],
    orgsById: { [ORG_ID]: { _id: ORG_ID, name: ORG_NAME } as unknown as Organisation },
    membershipsByOrgId: { [ORG_ID]: OWNER },
    status: 'loaded',
  });

  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    useOrgStore.setState(snapshot);
  };
};

/** Each row is a button labelled `Open <title>`; this is the list in DOM order. */
const rowTitles = (canvasElement: HTMLElement): string[] =>
  within(canvasElement)
    .queryAllByRole('button', { name: /^Open / })
    .map((row) => row.getAttribute('aria-label') ?? '');

const meta = {
  title: 'Companions/Sections/Documents',
  component: Documents,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Documents pane of the companion drawer. It unwraps the `{ companion, parent }` ' +
          'record the drawer passes every pane and hands `companion.id` to ' +
          '`CompanionDocumentsSection` - which is worth a story precisely because the sibling ' +
          'Core pane reads its field off the wrapper one level too high and shows dashes for ' +
          'a companion that has data.\n\n' +
          'Rendered at 530px, the width of the drawer `CompanionInfo` opens it inside. The ' +
          'records list itself is drawn in full under Documents/CompanionDocumentsSection; ' +
          'these stories answer the document endpoint from a routed axios adapter so the ' +
          'pane can be seen resolving the id for a companion with records and for one without.',
      },
    },
  },
  tags: ['autodocs'],
  args: { companion: POPPY },
  decorators: [
    (Story) => (
      <div className="min-h-[560px] w-full max-w-[530px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed,
} satisfies Meta<typeof Documents>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadedRecords: Story = {
  name: 'Loaded records',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Open Rabies vaccination certificate' });
    await expect(rowTitles(canvasElement)).toEqual([
      'Open Rabies vaccination certificate',
      'Open Dental chart and treatment plan',
      'Open Grooming record from previous salon',
    ]);
    await expect(canvas.getByRole('button', { name: 'All · 3' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Upload record' })).toBeEnabled();
  },
};

export const NoRecordsYet: Story = {
  name: 'No records yet',
  args: { companion: MISO },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No records yet')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Upload record' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Request from pet parent' })).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: /^All · / })).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: strip wraps above the list',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Open Rabies vaccination certificate' });
    await expect(rowTitles(canvasElement)).toHaveLength(3);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
