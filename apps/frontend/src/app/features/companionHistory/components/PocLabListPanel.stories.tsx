import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { PocLabList } from './PocLabListPanel';
import type { PointOfCareLabResult } from '@/app/features/companionHistory/services/pocLabService';

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

const meta = {
  title: 'CompanionHistory/PocLabList',
  component: PocLabList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { records: results, loading: false, error: null },
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
