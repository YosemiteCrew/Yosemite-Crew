import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import api from '@/app/services/axios';
import InpatientMonitoringPanel from './InpatientMonitoringPanel';

const observation = {
  id: 'observation-demo',
  patientId: 'patient-demo',
  encounterId: 'encounter-demo',
  observedAt: '2026-09-27T10:00:00.000Z',
  temperature: 38.2,
  temperatureUnit: 'C' as const,
  heartRate: 90,
  respiratoryRate: 20,
  painScore: 2,
  inputMl: 120,
  outputMl: 80,
  notes: 'Resting comfortably',
  createdAt: '2026-09-27T10:01:00.000Z',
};

const adapter: AxiosAdapter = (config) =>
  Promise.resolve({
    data: [observation],
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  } as AxiosResponse);

const installAdapter = () => {
  const previousAdapter = api.defaults.adapter;
  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = previousAdapter;
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
          'Timestamped inpatient observations with per-entry fluid intake, output, and a net value only when both amounts were recorded. The net is arithmetic on that observation, not a clinical interpretation.',
      },
    },
  },
  beforeEach: installAdapter,
  args: {
    organisationId: 'org-demo',
    patientId: 'patient-demo',
    encounterId: 'encounter-demo',
    readOnly: false,
  },
  tags: ['autodocs'],
} satisfies Meta<typeof InpatientMonitoringPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  name: 'Editable inpatient record',
};

export const ReadOnly: Story = {
  args: { readOnly: true },
};

export const MissingPatientContext: Story = {
  args: { patientId: undefined, encounterId: undefined },
};
