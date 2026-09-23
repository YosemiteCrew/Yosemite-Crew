import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import type { Appointment, Organisation, UserOrganization } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';

import Documents from './Documents';

const ORG_ID = 'org-storybook-appt-documents';
const ORG_NAME = 'Harbourside Veterinary Group';

const COMPANION = {
  poppy: 'companion-poppy',
  miso: 'companion-miso',
};

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
    id: 'rec-bloods',
    title: 'Pre-anaesthetic bloods',
    issueDate: '2026-02-11',
    issuingBusinessName: ORG_NAME,
    syncedFromPms: true,
    uploadedByPmsUserId: 'vet-weber',
  }),
  record({
    id: 'rec-referral',
    title: 'Referral letter from previous clinic',
    subcategory: 'MEDICAL_CONDITION',
    issueDate: '2026-01-22',
    issuingBusinessName: 'Larkspur Small Animal Practice',
    uploadedByParentId: 'parent-lena',
  }),
];

const RECORDS_BY_COMPANION: Record<string, CompanionRecord[]> = {
  [COMPANION.poppy]: POPPY_RECORDS,
  [COMPANION.miso]: [],
};

const appointment = (patientId: string, companionId?: string): Appointment => ({
  id: `appt-${patientId}`,
  patient: {
    id: patientId,
    name: patientId === COMPANION.poppy ? 'Poppy Hartmann' : 'Miso Tanaka',
    species: patientId === COMPANION.poppy ? 'dog' : 'cat',
    breed: patientId === COMPANION.poppy ? 'Beagle' : 'Domestic shorthair',
    parent: { id: 'parent-lena', name: 'Lena Hartmann' },
  },
  ...(companionId
    ? {
        companion: {
          id: companionId,
          name: 'Poppy Hartmann',
          species: 'dog',
          breed: 'Beagle',
          parent: { id: 'parent-lena', name: 'Lena Hartmann' },
        },
      }
    : {}),
  lead: { id: 'vet-weber', name: 'Dr. Amara Weber' },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
});

/**
 * `loadCompanionDocument` GETs `/v1/document/pms/:companionId` on mount and the
 * section keeps its records in local state, so the loaded list is only reachable
 * through an answered request. The stub is the shared axios instance's adapter,
 * routed on the companion id in the URL so every story installs an identical
 * adapter and the docs page cannot race itself.
 */
const REAL_ADAPTER = api.defaults.adapter;

const documentsAdapter: AxiosAdapter = async (config) => {
  const url = String(config.url ?? '');
  const companionId = Object.keys(RECORDS_BY_COMPANION).find((id) => url.includes(id));
  if (!companionId) {
    throw new Error(`Unstubbed request in Prescription/Documents.stories: ${url}`);
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

/**
 * An OWNER membership plus the org name. The section sits behind
 * `companions:view:any` and the upload CTA behind `companions:edit:any`, both
 * derived from `roleCode`; `status: 'loaded'` keeps the gate off its null skeleton.
 */
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
  title: 'Appointments/Prescription/Documents',
  component: Documents,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Documents tab of the appointment record. It is two lines of code over ' +
          '`CompanionDocumentsSection`, and the two lines are the point: the companion id is ' +
          'resolved through `getAppointmentCompanion`, which prefers `appointment.companion` and ' +
          'falls back to `appointment.patient`. An appointment that carries both names the ' +
          'record it belongs to through `companion`, so a wrapper that read `patient` directly ' +
          "would load the wrong animal's documents and look perfectly healthy doing it.\n\n" +
          'The records list itself - filter strip, sort toggle, month groups - is drawn in full ' +
          'under Documents/CompanionDocumentsSection. These stories answer the document ' +
          'endpoint from a routed axios adapter so the wrapper can be seen resolving the id.',
      },
    },
  },
  tags: ['autodocs'],
  args: { activeAppointment: appointment(COMPANION.poppy) },
  decorators: [
    (Story) => (
      <div className="min-h-[560px] w-full max-w-[900px] bg-[var(--screen)] p-5">
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
    // findBy, not getBy: the first render is the empty state until the request answers.
    await canvas.findByRole('button', { name: 'Open Rabies vaccination certificate' });
    await expect(rowTitles(canvasElement)).toEqual([
      'Open Rabies vaccination certificate',
      'Open Pre-anaesthetic bloods',
      'Open Referral letter from previous clinic',
    ]);
    await expect(canvas.getByRole('button', { name: 'All · 3' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Newest first' })).toBeInTheDocument();
  },
};

export const CompanionOutranksPatient: Story = {
  name: 'Companion field outranks patient',
  args: { activeAppointment: appointment(COMPANION.miso, COMPANION.poppy) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* `patient` points at a record with no documents and `companion` at one with
       three. The three appear, which is the only observable proof the wrapper read
       `companion` first - the empty state would look like a valid answer for Miso. */
    await canvas.findByRole('button', { name: 'Open Rabies vaccination certificate' });
    await expect(rowTitles(canvasElement)).toHaveLength(3);
    await expect(canvas.queryByText('No records yet')).not.toBeInTheDocument();
  },
};

export const NoRecordsYet: Story = {
  name: 'No records yet',
  args: { activeAppointment: appointment(COMPANION.miso) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No records yet')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Upload record' })).toBeEnabled();
    await expect(canvas.queryByRole('button', { name: 'Newest first' })).not.toBeInTheDocument();
  },
};
