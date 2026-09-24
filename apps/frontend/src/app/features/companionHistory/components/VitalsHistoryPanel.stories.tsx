import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { VitalsHistoryList } from './VitalsHistoryPanel';
import type { VitalsHistoryEntry } from '@/app/features/companionHistory/services/patientVitalsService';

const entries: VitalsHistoryEntry[] = [
  {
    measuredAt: '2026-06-30T10:00:00.000Z',
    recordedBy: 'staff-1',
    recordedByDisplay: 'Sample Nurse',
    source: {
      type: 'VITAL_RECORD',
      id: 'vital-3',
      appointmentId: 'appt-3',
      encounterId: null,
      status: 'SIGNED',
    },
    measurements: [
      { code: 'weightKg', value: 12.4, unit: 'kg' },
      { code: 'tempC', value: 38.6, unit: '°C' },
      { code: 'heartRateBpm', value: 110, unit: 'beats/min' },
      { code: 'respRateBpm', value: 24, unit: 'breaths/min' },
      { code: 'crtSec', value: '<2', unit: 's' },
      { code: 'bcs', value: 5, unit: 'score' },
    ],
  },
  {
    measuredAt: '2026-06-12T08:00:00.000Z',
    recordedBy: null,
    recordedByDisplay: null,
    source: {
      type: 'INPATIENT_MONITORING',
      id: 'obs-1',
      admissionId: 'adm-1',
      encounterId: null,
    },
    measurements: [
      { code: 'tempC', value: 39.4, unit: '°C' },
      { code: 'heartRateBpm', value: 132, unit: 'beats/min' },
      { code: 'spo2', value: 96, unit: '%' },
      { code: 'bloodPressureSystolic', value: 140, unit: 'mmHg' },
      { code: 'bloodPressureDiastolic', value: 85, unit: 'mmHg' },
    ],
  },
  {
    measuredAt: '2026-05-14T08:30:00.000Z',
    recordedBy: 'staff-2',
    recordedByDisplay: 'Sample Vet',
    source: {
      type: 'VITAL_RECORD',
      id: 'vital-1',
      appointmentId: 'appt-1',
      encounterId: null,
      status: 'COMPLETED',
    },
    measurements: [
      { code: 'weightKg', value: 12.1, unit: 'kg' },
      { code: 'tempC', value: 38.4, unit: '°C' },
    ],
  },
];

const meta = {
  title: 'CompanionHistory/VitalsHistoryList',
  component: VitalsHistoryList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { history: { entries, truncated: false }, loading: false, error: null },
} satisfies Meta<typeof VitalsHistoryList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Latest weight 12.4 kg')).toBeInTheDocument();
    await expect(canvas.getByText('Inpatient observation')).toBeInTheDocument();
  },
};
export const Truncated: Story = { args: { history: { entries, truncated: true } } };
export const Empty: Story = { args: { history: { entries: [], truncated: false } } };
export const Loading: Story = {
  args: { history: { entries: [], truncated: false }, loading: true },
};
export const WithError: Story = {
  args: {
    history: { entries: [], truncated: false },
    error: 'Could not load weight and vitals. Please try again.',
  },
};
