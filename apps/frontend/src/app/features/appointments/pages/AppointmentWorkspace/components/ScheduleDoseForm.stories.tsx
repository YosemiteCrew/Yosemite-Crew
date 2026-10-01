import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';

import ScheduleDoseForm from './ScheduleDoseForm';

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

const meta = {
  title: 'Workspace/ScheduleDoseForm',
  component: ScheduleDoseForm,
  tags: ['autodocs', 'medication-administration'],
  parameters: { layout: 'padded' },
  args: {
    schedulablePrescriptions: [prescription],
    selectedPrescription: prescription,
    prescriptionId: prescription.id,
    scheduledAt: '2026-09-27T10:00',
    isSaving: false,
    onPrescriptionChange: fn(),
    onScheduledAtChange: fn(),
    onSubmit: fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault()),
    onCancel: fn(),
  },
} satisfies Meta<typeof ScheduleDoseForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Give with food.')).toBeInTheDocument();

    await userEvent.selectOptions(
      canvas.getByRole('combobox', { name: 'Medication' }),
      'rx-line-1'
    );
    await expect(args.onPrescriptionChange).toHaveBeenCalledWith('rx-line-1');

    await userEvent.click(canvas.getByRole('button', { name: 'Save scheduled dose' }));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

export const NoPrescriptionSelected: Story = {
  args: { selectedPrescription: undefined, prescriptionId: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('option', { name: 'Choose an in-house prescription' })
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Give with food.')).not.toBeInTheDocument();
  },
};

export const Saving: Story = {
  args: { isSaving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  },
};
