import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { MedicationAdministrationEntry } from '@/app/features/appointments/services/medicationAdministrationService';

import MedicationAdministrationHistory from './MedicationAdministrationHistory';

const scheduledEntry: MedicationAdministrationEntry = {
  id: 'mar-scheduled',
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
  notes: 'Give with food.',
  createdAt: '2026-09-27T09:00:00.000Z',
  updatedAt: '2026-09-27T09:00:00.000Z',
};

const givenEntry: MedicationAdministrationEntry = {
  ...scheduledEntry,
  id: 'mar-given',
  medicationName: 'Amoxicillin',
  dose: '125 mg',
  status: 'GIVEN',
  administeredAt: '2026-09-27T09:05:00.000Z',
  updatedAt: '2026-09-27T09:05:00.000Z',
  notes: null,
};

const meta = {
  title: 'Workspace/MedicationAdministrationHistory',
  component: MedicationAdministrationHistory,
  tags: ['autodocs', 'medication-administration'],
  parameters: { layout: 'padded' },
  args: {
    entries: [scheduledEntry, givenEntry],
    readOnly: false,
    isSaving: false,
    savingEntryId: null,
    onRecordOutcome: fn(),
  },
} satisfies Meta<typeof MedicationAdministrationHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScheduledAndRecorded: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Scheduled')).toBeInTheDocument();
    await expect(canvas.getByText('Given')).toBeInTheDocument();
    await expect(canvas.getByText('Give with food.')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Hold' }));
    await expect(args.onRecordOutcome).toHaveBeenCalledWith('mar-scheduled', 'HELD');
  },
};

export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole('button');
    for (const button of buttons) await expect(button).toBeDisabled();
  },
};

export const SavingOutcome: Story = {
  args: { isSaving: true, savingEntryId: 'mar-scheduled' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Hold' })).toBeDisabled();
  },
};
