import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScheduleDoseForm from '@/app/features/appointments/pages/AppointmentWorkspace/components/ScheduleDoseForm';
import { createMedicationAdministration } from '@/app/features/appointments/services/medicationAdministrationService';
import type { MedicationAdministrationEntry } from '@/app/features/appointments/services/medicationAdministrationService';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';

jest.mock('@/app/features/appointments/services/medicationAdministrationService', () => ({
  createMedicationAdministration: jest.fn(),
}));

const createMock = createMedicationAdministration as jest.MockedFunction<
  typeof createMedicationAdministration
>;

const prescription: PrescriptionItem = {
  id: 'rx-line-1',
  labelPrescriptionId: 'rx-1',
  medicineName: 'Meloxicam',
  dose: '0.4',
  doseUnit: 'ml',
  route: 'Oral',
  fulfillment: 'IN_HOUSE',
  instructions: 'Give with food.',
};

const savedEntry: MedicationAdministrationEntry = {
  id: 'mar-2',
  organisationId: 'org-1',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  prescriptionId: 'rx-1',
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

const renderForm = (props: Partial<React.ComponentProps<typeof ScheduleDoseForm>> = {}) =>
  render(
    <ScheduleDoseForm
      organisationId="org-1"
      patientId="patient-1"
      encounterId="encounter-1"
      schedulablePrescriptions={[prescription]}
      isSaving={false}
      onStartSaving={jest.fn()}
      onStopSaving={jest.fn()}
      onCancel={jest.fn()}
      onScheduled={jest.fn()}
      onFailed={jest.fn()}
      {...props}
    />
  );

const fillInSchedule = async () => {
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Medication' }), 'rx-line-1');
  fireEvent.change(screen.getByLabelText('Scheduled time'), {
    target: { value: '2026-09-27T10:00' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Save scheduled dose' }));
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ScheduleDoseForm', () => {
  it('schedules the chosen dose and hands the saved entry back', async () => {
    const onScheduled = jest.fn();
    const onStartSaving = jest.fn();
    const onStopSaving = jest.fn();
    createMock.mockResolvedValueOnce(savedEntry);
    renderForm({ onScheduled, onStartSaving, onStopSaving });

    await fillInSchedule();

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          patientId: 'patient-1',
          encounterId: 'encounter-1',
          prescriptionId: 'rx-1',
          medicationName: 'Meloxicam',
          dose: '0.4 ml',
          route: 'Oral',
        })
      )
    );
    expect(onScheduled).toHaveBeenCalledWith(savedEntry);
    expect(onStartSaving).toHaveBeenCalled();
    expect(onStopSaving).toHaveBeenCalled();
  });

  it('sends the chosen wall-clock time as an instant', async () => {
    createMock.mockResolvedValueOnce(savedEntry);
    renderForm();

    await fillInSchedule();

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const { scheduledAt } = createMock.mock.calls[0][0];
    expect(scheduledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const scheduled = new Date(scheduledAt);
    expect(scheduled.getFullYear()).toBe(2026);
    expect(scheduled.getMonth()).toBe(8);
    expect(scheduled.getDate()).toBe(27);
    expect(scheduled.getHours()).toBe(10);
    expect(scheduled.getMinutes()).toBe(0);
  });

  it('schedules a prescription that is not linked to a label', async () => {
    const unlinked = { ...prescription, labelPrescriptionId: undefined };
    createMock.mockResolvedValueOnce({ ...savedEntry, prescriptionId: null });
    renderForm({ schedulablePrescriptions: [unlinked] });

    await fillInSchedule();

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0]).not.toHaveProperty('prescriptionId');
  });

  it('falls back to the prescription directions when none are written', async () => {
    renderForm({ schedulablePrescriptions: [{ ...prescription, instructions: '' }] });

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Medication' }),
      'rx-line-1'
    );

    expect(screen.getByText('Use the directions on the prescription.')).toBeInTheDocument();
  });

  it('explains a scheduling failure instead of reporting a saved dose', async () => {
    const onScheduled = jest.fn();
    const onFailed = jest.fn();
    createMock.mockRejectedValueOnce(new Error('request failed'));
    renderForm({ onScheduled, onFailed });

    await fillInSchedule();

    await waitFor(() =>
      expect(onFailed).toHaveBeenCalledWith('Unable to schedule this dose. Please try again.')
    );
    expect(onScheduled).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Medication' })).toBeInTheDocument();
  });

  it('closes on cancel', async () => {
    const onCancel = jest.fn();
    renderForm({ onCancel });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('blocks a second submit while the panel is still saving', () => {
    renderForm({ isSaving: true });

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('will not submit a dose with no prescription or time chosen', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Save scheduled dose' }));

    expect(createMock).not.toHaveBeenCalled();
  });
});
