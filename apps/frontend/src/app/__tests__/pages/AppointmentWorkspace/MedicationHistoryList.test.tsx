import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MedicationHistoryList from '@/app/features/appointments/pages/AppointmentWorkspace/components/MedicationHistoryList';
import { MEDICATION_OUTCOMES } from '@/app/features/appointments/pages/AppointmentWorkspace/components/medicationOutcomes';
import type { MedicationAdministrationEntry } from '@/app/features/appointments/services/medicationAdministrationService';

jest.mock('@/app/features/appointments/services/medicationAdministrationService', () => ({
  administerMedication: jest.fn(),
  holdMedication: jest.fn(),
  missMedication: jest.fn(),
  refuseMedication: jest.fn(),
}));

const entry = (
  overrides: Partial<MedicationAdministrationEntry> = {}
): MedicationAdministrationEntry => ({
  id: 'mar-1',
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
  ...overrides,
});

const renderList = (props: Partial<React.ComponentProps<typeof MedicationHistoryList>> = {}) =>
  render(
    <MedicationHistoryList
      entries={[entry()]}
      readOnly={false}
      isSaving={false}
      saving={null}
      onRecordOutcome={jest.fn()}
      {...props}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MedicationHistoryList', () => {
  it('offers every outcome on a dose that is still scheduled', async () => {
    renderList();

    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    for (const outcome of MEDICATION_OUTCOMES) {
      expect(screen.getByRole('button', { name: outcome.label })).toBeEnabled();
    }
  });

  it('reports the dose and the action the nurse chose', async () => {
    const onRecordOutcome = jest.fn();
    renderList({ onRecordOutcome });

    await userEvent.click(screen.getByRole('button', { name: 'Hold' }));

    expect(onRecordOutcome).toHaveBeenCalledWith('mar-1', 'Hold', MEDICATION_OUTCOMES[1].action);
  });

  it('replaces the actions of a dose whose outcome is already recorded', () => {
    renderList({
      entries: [entry({ status: 'REFUSED', administeredAt: new Date().toISOString() })],
    });

    expect(screen.getByText('Refused')).toBeInTheDocument();
    expect(screen.getByText('Outcome recorded · Today')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record given' })).not.toBeInTheDocument();
  });

  it('names a dose recorded as given in its own words', () => {
    renderList({
      entries: [entry({ status: 'GIVEN', administeredAt: new Date().toISOString() })],
    });

    expect(screen.getByText('Recorded as given · Today')).toBeInTheDocument();
  });

  it('shows the note a nurse left against the dose', () => {
    renderList({
      entries: [entry({ status: 'HELD', notes: 'Dose held after the patient refused food.' })],
    });

    expect(screen.getByText('Dose held after the patient refused food.')).toBeInTheDocument();
  });

  it('disables every action while a read-only panel is displayed', () => {
    renderList({ readOnly: true });

    for (const outcome of MEDICATION_OUTCOMES) {
      expect(screen.getByRole('button', { name: outcome.label })).toBeDisabled();
    }
  });

  it('disables every action while another write is in flight', () => {
    renderList({ isSaving: true });

    for (const outcome of MEDICATION_OUTCOMES) {
      expect(screen.getByRole('button', { name: outcome.label })).toBeDisabled();
    }
  });

  it('marks only the dose and action being written as saving', () => {
    renderList({
      entries: [entry(), entry({ id: 'mar-2', medicationName: 'Gabapentin' })],
      isSaving: true,
      saving: { entryId: 'mar-2', label: 'Mark missed' },
    });

    const [first, second] = screen.getAllByRole('listitem');
    expect(within(first).getByRole('button', { name: 'Mark missed' })).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: 'Saving…' })).not.toBeInTheDocument();
    expect(within(second).getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
  });
});
