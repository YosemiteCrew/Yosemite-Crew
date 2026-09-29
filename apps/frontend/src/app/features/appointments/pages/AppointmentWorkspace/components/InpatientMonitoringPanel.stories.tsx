import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, userEvent, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { UserOrganization } from '@yosemite-crew/types';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import { formatDateTimeLocal } from '@/app/lib/date';
import type {
  HospitalizationObservation,
  RecordHospitalizationObservation,
} from '@/app/features/appointments/services/hospitalizationMonitoringService';
import InpatientMonitoringPanel from './InpatientMonitoringPanel';

const ORG_ID = 'org-storybook-monitoring';

// The form prefills the current time; a fixed past time keeps the saved entry and the open
// form identical from one visual snapshot to the next.
const setObservedAt = (canvasElement: HTMLElement) =>
  fireEvent.change(within(canvasElement).getByLabelText('Observed at'), {
    target: { value: '2026-09-28T09:15' },
  });

const observation = (
  over: Partial<HospitalizationObservation> & Pick<HospitalizationObservation, 'id'>
): HospitalizationObservation => ({
  patientId: 'patient-demo',
  encounterId: 'encounter-demo',
  observedAt: '2026-09-27T10:00:00.000Z',
  temperature: 38.2,
  temperatureUnit: 'C',
  heartRate: 90,
  respiratoryRate: 20,
  painScore: 2,
  inputMl: 120,
  outputMl: 80,
  notes: null,
  createdAt: '2026-09-27T10:01:00.000Z',
  ...over,
});

// Two observations on the latest day and one the day before, so the fluid balance shows a
// row per day plus the whole-stay total.
const STAY: HospitalizationObservation[] = [
  observation({ id: 'obs-morning', observedAt: '2026-09-27T08:00:00.000Z', notes: 'Resting' }),
  observation({
    id: 'obs-midday',
    observedAt: '2026-09-27T11:00:00.000Z',
    inputMl: 0.2,
    outputMl: 50.1,
  }),
  observation({ id: 'obs-yesterday', observedAt: '2026-09-26T11:00:00.000Z', inputMl: 1000 }),
];

const membership = (revoked: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/vet-monitoring',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

type PostedObservation = Omit<RecordHospitalizationObservation, 'organisationId'>;

const NOTHING_MEASURED = {
  temperature: null,
  temperatureUnit: null,
  heartRate: null,
  respiratoryRate: null,
  painScore: null,
  inputMl: null,
  outputMl: null,
};

let posted: PostedObservation[] = [];

/**
 * The panel reads and writes `/v1/pms/organisation/:id/hospitalization-monitoring` through the
 * shared axios instance, so its adapter is the seam: the list GET answers from the fixture and a
 * POST is echoed back as the stored observation (and remembered, so a story can prove a blocked
 * entry never reached the server).
 */
const buildAdapter =
  (records: HospitalizationObservation[]): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    if (String(config.method ?? 'get').toLowerCase() === 'post') {
      const body = JSON.parse(String(config.data ?? '{}')) as PostedObservation;
      posted.push(body);
      return Promise.resolve(
        respond(config, observation({ ...NOTHING_MEASURED, ...body, id: 'obs-new' }))
      );
    }
    return Promise.resolve(respond(config, records));
  };

const REAL_ADAPTER = api.defaults.adapter;

/**
 * Seeds a real membership on `useOrgStore`, so the panel's `appointments:view:any` /
 * `appointments:edit:any` checks run unmocked; `revoked` takes a right off, the way a practice
 * would.
 */
const prepare =
  ({
    records = STAY,
    revoked = [],
  }: {
    records?: HospitalizationObservation[];
    revoked?: string[];
  }) =>
  () => {
    clearInFlightGetRequests();
    posted = [];
    const orgSnapshot = useOrgStore.getState();
    api.defaults.adapter = buildAdapter(records);
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useOrgStore.setState(orgSnapshot);
      clearInFlightGetRequests();
    };
  };

const meta = {
  title: 'Workspace/InpatientMonitoringPanel',
  component: InpatientMonitoringPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Timestamped inpatient observations for one stay. Times are entered and shown in the ' +
          'clinic time zone. Each entry shows a net only when both intake and output were ' +
          'recorded; the fluid balance sums recorded amounts per clinic day and for the whole ' +
          'stay, rounded to two decimals. Viewing needs `appointments:view:any`; recording ' +
          'needs `appointments:edit:any` and an encounter that is not read-only. Out-of-range ' +
          'entries (for example a Fahrenheit reading in the Celsius field) are blocked by the ' +
          'form before anything is sent.',
      },
    },
  },
  beforeEach: prepare({}),
  args: {
    organisationId: ORG_ID,
    patientId: 'patient-demo',
    encounterId: 'encounter-demo',
    readOnly: false,
  },
  tags: ['autodocs'],
} satisfies Meta<typeof InpatientMonitoringPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  name: 'Observations with fluid balance',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Resting')).toBeVisible();
    await expect(canvas.getByText(formatDateTimeLocal('2026-09-27T11:00:00.000Z'))).toBeVisible();
    const balance = canvas.getByRole('table', { name: /Fluid balance/ });
    await expect(within(balance).getByRole('row', { name: /Whole stay/ })).toHaveTextContent(
      'Whole stay1,120.2 mL210.1 mL+910.1 mL'
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Record observation' }));
    setObservedAt(canvasElement);
    await userEvent.type(canvas.getByLabelText('Fluid intake (mL)'), '25');
    await userEvent.type(canvas.getByLabelText('Notes'), 'Drinking again');
    await userEvent.click(canvas.getByRole('button', { name: 'Save observation' }));
    await expect(await canvas.findByText('Drinking again')).toBeVisible();
    // The time typed is the time shown back, whatever the clinic zone.
    await expect(canvas.getByText('Sep 28, 2026, 09:15 AM')).toBeVisible();
    await expect(posted).toHaveLength(1);
  },
};

export const Empty: Story = {
  name: 'No observations yet',
  beforeEach: prepare({ records: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No monitoring observations recorded for this stay.')
    ).toBeVisible();
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Record observation' })).toBeEnabled();
  },
};

export const OutOfRange: Story = {
  name: 'Out-of-range entry is blocked',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Record observation' }));
    setObservedAt(canvasElement);
    const temperature = canvas.getByLabelText('Temperature (°C)');
    await userEvent.type(temperature, '101.5');
    await userEvent.type(canvas.getByLabelText('Pain score (0–10)'), '11');
    await expect(temperature).toBeInvalid();
    await expect(canvas.getByLabelText('Pain score (0–10)')).toBeInvalid();
    await expect(canvasElement.querySelector('form')?.checkValidity()).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Save observation' }));
    // Give a submission that should not happen time to reach the adapter and close the form.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(canvas.getByRole('button', { name: 'Save observation' })).toBeVisible();
    await expect(posted).toHaveLength(0);
  },
};

export const ReadOnly: Story = {
  name: 'Read-only encounter',
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Resting')).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Record observation' })
    ).not.toBeInTheDocument();
  },
};

export const EditPermissionRevoked: Story = {
  name: 'View only - edit permission revoked',
  beforeEach: prepare({ revoked: ['appointments:edit:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Resting')).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Record observation' })
    ).not.toBeInTheDocument();
  },
};

export const MissingPatientContext: Story = {
  name: 'Waiting for patient context',
  args: { patientId: undefined, encounterId: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(
        'Monitoring is available when the patient and inpatient encounter are loaded.'
      )
    ).toBeVisible();
  },
};
