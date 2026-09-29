import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import api from '@/app/services/axios';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';
import MedicationAdministrationPanel from './MedicationAdministrationPanel';

const prescription: PrescriptionItem = {
  id: 'rx-line-1',
  labelPrescriptionId: 'prescription-1',
  medicineName: 'Meloxicam',
  dose: '0.4',
  doseUnit: 'ml',
  route: 'Oral',
  fulfillment: 'IN_HOUSE',
  instructions: 'Give with food.',
};

const entry = {
  id: 'mar-1',
  organisationId: 'org-storybook',
  patientId: 'patient-storybook',
  encounterId: 'encounter-storybook',
  prescriptionId: 'prescription-1',
  medicationName: 'Meloxicam',
  dose: '0.4 ml',
  route: 'Oral',
  scheduledAt: '2026-09-27T10:00:00.000Z',
  administeredAt: null,
  administeredBy: null,
  status: 'SCHEDULED',
  notes: null,
  createdAt: '2026-09-27T09:00:00.000Z',
  updatedAt: '2026-09-27T09:00:00.000Z',
};

const stubMedicationApi = (hasScheduledEntry: boolean) => {
  const previousAdapter = api.defaults.adapter;
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) =>
    Promise.resolve({
      data:
        config.method === 'get'
          ? hasScheduledEntry
            ? [entry]
            : []
          : config.url?.endsWith('/administer')
            ? {
                ...entry,
                status: 'GIVEN',
                administeredAt: '2026-09-27T10:05:00.000Z',
                updatedAt: '2026-09-27T10:05:00.000Z',
              }
            : { ...entry, id: 'mar-2' },
      status: config.method === 'get' ? 200 : 201,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse);
  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = previousAdapter;
  };
};

const meta = {
  title: 'Workspace/MedicationAdministrationPanel',
  component: MedicationAdministrationPanel,
  parameters: { layout: 'padded' },
  args: {
    organisationId: 'org-storybook',
    patientId: 'patient-storybook',
    encounterId: 'encounter-storybook',
    prescriptions: [prescription],
    readOnly: false,
  },
} satisfies Meta<typeof MedicationAdministrationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScheduledDose: Story = {
  beforeEach: () => stubMedicationApi(true),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Meloxicam')).toBeInTheDocument();
    await expect(canvas.getByText('Scheduled')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Record given' }));
    await expect(await canvas.findByText('Given')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Record given' })).not.toBeInTheDocument();
  },
};

export const AvailableActions: Story = {
  beforeEach: () => stubMedicationApi(true),
};

export const ScheduleAnotherDose: Story = {
  beforeEach: () => stubMedicationApi(false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('No medication doses are scheduled for this inpatient stay.')
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Schedule a dose' }));
    await expect(canvas.getByRole('combobox', { name: 'Medication' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Scheduled time' })).toBeInTheDocument();
    await expect(canvas.getByText('Give with food.')).toBeInTheDocument();
  },
};
