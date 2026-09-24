import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import PocLabListPanel, { PocLabList } from './PocLabListPanel';
import type {
  CreatePocLabResultInput,
  PointOfCareLabResult,
} from '@/app/features/companionHistory/services/pocLabService';

const results: PointOfCareLabResult[] = [
  {
    id: 'lab-1',
    organisationId: 'org-1',
    patientId: 'patient-1',
    encounterId: null,
    conductedAt: '2026-06-30T10:00:00.000Z',
    conductedBy: 'staff-1',
    testType: 'BLOOD_CHEMISTRY',
    analyzerName: 'Catalyst One',
    sampleType: 'Serum',
    results: [
      {
        name: 'Creatinine',
        value: 210,
        unit: 'µmol/L',
        referenceRangeLow: 44,
        referenceRangeHigh: 159,
        flag: 'H',
      },
      {
        name: 'Potassium',
        value: 6.9,
        unit: 'mmol/L',
        referenceRangeLow: 3.5,
        referenceRangeHigh: 5.8,
        flag: 'HH',
      },
    ],
    overallInterpretation: 'Azotaemia with marked hyperkalaemia.',
    abnormalFlags: ['Creatinine'],
    criticalFlags: ['Potassium'],
    followUpRecommended: true,
    notes: 'Confirm potassium on a fresh sample.',
    createdAt: '2026-06-30T10:00:00.000Z',
    updatedAt: '2026-06-30T10:00:00.000Z',
  },
  {
    id: 'lab-2',
    organisationId: 'org-1',
    patientId: 'patient-1',
    encounterId: null,
    conductedAt: '2026-05-14T08:30:00.000Z',
    conductedBy: 'staff-2',
    testType: 'CBC',
    analyzerName: 'ProCyte One',
    sampleType: 'Whole blood',
    results: [{ name: 'Haematocrit', value: 42, unit: '%', flag: 'N' }],
    overallInterpretation: 'Within expected limits.',
    abnormalFlags: [],
    criticalFlags: [],
    followUpRecommended: false,
    notes: null,
    createdAt: '2026-05-14T08:30:00.000Z',
    updatedAt: '2026-05-14T08:30:00.000Z',
  },
];

/** The design's saved state, in local time: a CBC recorded this morning and an older urinalysis. */
const SAVED: PointOfCareLabResult[] = [
  {
    ...results[1],
    id: 'lab-cbc',
    conductedAt: new Date(2026, 8, 24, 9, 15).toISOString(),
    sampleType: 'Whole blood (EDTA)',
    analyzerName: null,
    results: [
      {
        name: 'WBC',
        value: 18.2,
        unit: '×10⁹/L',
        referenceRangeLow: 6,
        referenceRangeHigh: 17,
        flag: 'H',
      },
      {
        name: 'HCT',
        value: 0.41,
        unit: 'L/L',
        referenceRangeLow: 0.37,
        referenceRangeHigh: 0.55,
        flag: 'N',
      },
      {
        name: 'PLT',
        value: 38,
        unit: '×10⁹/L',
        referenceRangeLow: 200,
        referenceRangeHigh: 500,
        flag: 'LL',
      },
    ],
    overallInterpretation:
      'Marked thrombocytopenia with mild leukocytosis. Recheck platelets on a fresh sample.',
    abnormalFlags: ['WBC'],
    criticalFlags: ['PLT'],
    followUpRecommended: true,
  },
  {
    ...results[1],
    id: 'lab-ua',
    conductedAt: new Date(2026, 8, 18, 14, 40).toISOString(),
    testType: 'URINALYSIS',
    sampleType: 'Urine (cystocentesis)',
    analyzerName: 'In-clinic urine analyzer',
    results: [{ name: 'Protein', value: '2+', flag: 'H' }],
    overallInterpretation: null,
    abnormalFlags: ['Protein'],
    criticalFlags: [],
    followUpRecommended: false,
  },
];

const meta = {
  title: 'CompanionHistory/PocLabList',
  component: PocLabList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'In-house (point-of-care) lab results on the patient record. Members with ' +
          '`appointments:view:any` see the list; members who also hold `appointments:edit:any`, ' +
          'the gate on the backend POST, get "Add lab result", which opens `PocLabResultForm` ' +
          'inline below the header. A result saved here opens expanded in its date position.',
      },
    },
  },
  tags: ['autodocs'],
  args: { records: results, loading: false, error: null, canEdit: false, onCreate: fn() },
} satisfies Meta<typeof PocLabList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Blood chemistry/ }));
    await expect(canvas.getByText('Azotaemia with marked hyperkalaemia.')).toBeVisible();
  },
};

export const Empty: Story = { args: { records: [] } };
export const Loading: Story = { args: { records: [], loading: true } };
export const WithError: Story = {
  args: { records: [], error: 'Could not load in-house lab results. Please try again.' },
};

const EMPTY_COPY = 'No in-house lab results recorded for this patient yet.';

export const EmptyCanRecord: Story = {
  name: 'Empty - can record',
  args: { records: [], canEdit: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(EMPTY_COPY)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add lab result' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  },
};

export const ReadOnly: Story = {
  name: 'View only - no add control',
  args: { records: SAVED, canEdit: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('2 recorded')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Add lab result' })).toBeNull();
  },
};

export const FormOpen: Story = {
  name: 'Add form open',
  args: { records: [], canEdit: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add lab result' }));
    await expect(canvas.getByRole('form', { name: 'Record a lab result' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Close' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  },
};

export const FormErrors: Story = {
  name: 'Add form - validation errors',
  args: { records: [], canEdit: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add lab result' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save lab result' }));
    await expect(canvas.getByText('Choose a test type.')).toBeVisible();
    await expect(canvas.getByText('Enter a parameter name.')).toBeVisible();
    await expect(canvas.getByText('Enter a value.')).toBeVisible();
    await expect(args.onCreate).not.toHaveBeenCalled();
  },
};

export const Saved: Story = {
  name: 'Saved - new result open',
  args: { records: SAVED, canEdit: true, createdId: 'lab-cbc' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole('button', { name: /Complete blood count/ });
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(
      canvas.getByRole('list', { name: 'Complete blood count parameters' })
    ).toBeVisible();
    await expect(canvas.getByText('Critical')).toBeVisible();
  },
};

// Pinned as a global: Storybook 10 reads the viewport selection from globals only.
const phone = { globals: { viewport: { value: 'mobile', isRotated: false } } } as const;

export const PhoneEmpty: Story = {
  ...phone,
  name: 'Phone - empty',
  args: { records: [], canEdit: true },
  play: async ({ canvasElement }) => {
    const add = within(canvasElement).getByRole('button', { name: 'Add lab result' });
    const box = add.getBoundingClientRect();
    await expect(Math.round(box.width)).toBe(44);
    await expect(Math.round(box.height)).toBe(44);
  },
};

export const PhoneFormOpen: Story = {
  ...phone,
  name: 'Phone - add form open',
  args: { records: [], canEdit: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add lab result' }));
    await expect(canvas.getByRole('form', { name: 'Record a lab result' })).toBeVisible();
    await expect(canvas.getByText('Parameter 1')).toBeVisible();
  },
};

export const PhoneSaved: Story = {
  ...phone,
  name: 'Phone - saved',
  args: { records: SAVED, canEdit: true, createdId: 'lab-cbc' },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: /Complete blood count/ });
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};

const ORG_ID = 'org-storybook-poc-lab';
const COMPANION_ID = 'patient-storybook-luna';

const membership = (): UserOrganization => ({
  practitionerReference: 'Practitioner/vet-luna',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: [],
});

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/** What the server would store for a POST body. */
const storedRecord = (body: CreatePocLabResultInput): PointOfCareLabResult => ({
  ...SAVED[1],
  ...body,
  id: 'lab-recorded',
  organisationId: ORG_ID,
  encounterId: null,
  analyzerName: body.analyzerName ?? null,
  sampleType: body.sampleType ?? null,
  overallInterpretation: body.overallInterpretation ?? null,
  notes: body.notes ?? null,
  abnormalFlags: body.abnormalFlags ?? [],
  criticalFlags: body.criticalFlags ?? [],
  followUpRecommended: body.followUpRecommended ?? null,
});

/**
 * The panel talks to `/v1/pms/organisation/:id/poc-lab` through the shared axios
 * instance, so its adapter is the seam: a small in-memory server whose GET lists
 * one older result plus anything posted, and whose POST stores and echoes the
 * record. `failFirstGet` makes the first list request fail.
 */
const pocLabServer = ({ failFirstGet = false } = {}): AxiosAdapter => {
  const stored: PointOfCareLabResult[] = [{ ...SAVED[1], patientId: COMPANION_ID }];
  let failNextGet = failFirstGet;
  return (config) => {
    const url = String(config.url ?? '');
    if (!url.includes('/poc-lab')) return Promise.resolve(respond(config, []));
    if (String(config.method).toLowerCase() === 'post') {
      const record = storedRecord(JSON.parse(String(config.data ?? '{}')));
      stored.unshift(record);
      return Promise.resolve(respond(config, record));
    }
    if (failNextGet) {
      failNextGet = false;
      return Promise.reject(new Error('The lab results service is unavailable.'));
    }
    return Promise.resolve(respond(config, [...stored]));
  };
};

const REAL_ADAPTER = api.defaults.adapter;

/** Points the shared axios instance at `adapter` and the org store at the story org. */
const installLiveServer = (adapter: AxiosAdapter) => {
  clearInFlightGetRequests();
  const orgSnapshot = useOrgStore.getState();
  api.defaults.adapter = adapter;
  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgIds: [ORG_ID],
    membershipsByOrgId: { [ORG_ID]: membership() },
    status: 'loaded',
  });
  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    useOrgStore.setState(orgSnapshot);
    clearInFlightGetRequests();
  };
};

/** Opens the form, records the smallest valid CBC and waits for the form to close. */
const recordPlatelets = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Add lab result' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Test type' }));
  const listbox = await within(canvasElement.ownerDocument.body).findByRole('listbox');
  await userEvent.click(within(listbox).getByRole('option', { name: 'Complete blood count' }));
  fireEvent.change(canvas.getByLabelText('Parameter 1 name'), { target: { value: 'PLT' } });
  fireEvent.change(canvas.getByLabelText('Parameter 1 value'), { target: { value: '38' } });
  await userEvent.click(canvas.getByRole('button', { name: 'Save lab result' }));
  await waitFor(() =>
    expect(canvas.queryByRole('form', { name: 'Record a lab result' })).toBeNull()
  );
};

export const RecordsAResult: Story = {
  name: 'Records a result (live panel)',
  args: { records: [] },
  beforeEach: () => installLiveServer(pocLabServer()),
  render: () => <PocLabListPanel companionId={COMPANION_ID} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Urinalysis', {}, { timeout: 10000 });
    await recordPlatelets(canvasElement);
    const saved = await canvas.findByRole('button', { name: /Complete blood count/ });
    await expect(saved).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('2 recorded')).toBeVisible();
  },
};

export const RecordsAfterLoadError: Story = {
  name: 'Records a result after a failed load (live panel)',
  args: { records: [] },
  beforeEach: () => installLiveServer(pocLabServer({ failFirstGet: true })),
  render: () => <PocLabListPanel companionId={COMPANION_ID} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent(
      'Could not load in-house lab results'
    );
    await recordPlatelets(canvasElement);
    // The list is fetched again, so it shows the older result as well as the new one.
    await expect(await canvas.findByText('2 recorded', {}, { timeout: 10000 })).toBeVisible();
    await expect(canvas.queryByRole('alert')).toBeNull();
    const saved = canvas.getByRole('button', { name: /Complete blood count/ });
    await expect(saved).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', { name: /Urinalysis/ })).toBeVisible();
  },
};
