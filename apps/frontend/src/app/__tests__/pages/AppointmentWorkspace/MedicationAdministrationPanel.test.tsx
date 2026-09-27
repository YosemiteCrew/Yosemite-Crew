import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MedicationAdministrationPanel from '@/app/features/appointments/pages/AppointmentWorkspace/components/MedicationAdministrationPanel';
import {
  administerMedication,
  createMedicationAdministration,
  holdMedication,
  listMedicationAdministrations,
  missMedication,
  refuseMedication,
} from '@/app/features/appointments/services/medicationAdministrationService';
import type { MedicationAdministrationEntry } from '@/app/features/appointments/services/medicationAdministrationService';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';

jest.mock('@/app/features/appointments/services/medicationAdministrationService', () => ({
  administerMedication: jest.fn(),
  createMedicationAdministration: jest.fn(),
  holdMedication: jest.fn(),
  listMedicationAdministrations: jest.fn(),
  missMedication: jest.fn(),
  refuseMedication: jest.fn(),
}));

const listMock = listMedicationAdministrations as jest.MockedFunction<
  typeof listMedicationAdministrations
>;
const createMock = createMedicationAdministration as jest.MockedFunction<
  typeof createMedicationAdministration
>;
const administerMock = administerMedication as jest.MockedFunction<typeof administerMedication>;
const holdMock = holdMedication as jest.MockedFunction<typeof holdMedication>;
const missMock = missMedication as jest.MockedFunction<typeof missMedication>;
const refuseMock = refuseMedication as jest.MockedFunction<typeof refuseMedication>;

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

const scheduledEntry: MedicationAdministrationEntry = {
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
};

const renderPanel = (
  props: Partial<React.ComponentProps<typeof MedicationAdministrationPanel>> = {}
) =>
  render(
    <MedicationAdministrationPanel
      organisationId="org-1"
      patientId="patient-1"
      encounterId="encounter-1"
      prescriptions={[prescription]}
      readOnly={false}
      {...props}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  listMock.mockResolvedValue([]);
});

describe('MedicationAdministrationPanel', () => {
  it('loads scheduled doses and records a dose as given once', async () => {
    listMock.mockResolvedValueOnce([scheduledEntry]);
    administerMock.mockResolvedValueOnce({
      ...scheduledEntry,
      status: 'GIVEN',
      administeredAt: '2026-09-27T10:05:00.000Z',
    });
    renderPanel();

    expect(await screen.findByText('Meloxicam')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record given' }));

    expect(await screen.findByText('Given')).toBeInTheDocument();
    expect(screen.getByText(/Recorded as given/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record given' })).not.toBeInTheDocument();
    expect(administerMock).toHaveBeenCalledWith('org-1', 'mar-1');
  });

  it('preserves other scheduled doses when one outcome is recorded', async () => {
    listMock.mockResolvedValueOnce([
      scheduledEntry,
      { ...scheduledEntry, id: 'mar-2', medicationName: 'Gabapentin' },
    ]);
    administerMock.mockResolvedValueOnce({ ...scheduledEntry, status: 'GIVEN' });
    renderPanel();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Record given' }))[0]);

    expect(await screen.findByText('Given')).toBeInTheDocument();
    expect(screen.getByText('Gabapentin')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('orders the history by scheduled time', async () => {
    listMock.mockResolvedValueOnce([
      { ...scheduledEntry, id: 'mar-later', scheduledAt: '2026-09-28T10:00:00.000Z' },
      { ...scheduledEntry, id: 'mar-earlier', scheduledAt: '2026-09-26T10:00:00.000Z' },
    ]);
    renderPanel();

    const medicationRows = await screen.findAllByRole('listitem');
    expect(medicationRows[0]).toHaveTextContent('Sep 26');
    expect(medicationRows[1]).toHaveTextContent('Sep 28');
  });

  it.each([
    ['Hold', holdMock, 'HELD'],
    ['Mark missed', missMock, 'MISSED'],
    ['Record refused', refuseMock, 'REFUSED'],
  ] as const)(
    'records the %s outcome and removes the available actions',
    async (label, action, status) => {
      listMock.mockResolvedValueOnce([scheduledEntry]);
      action.mockResolvedValueOnce({ ...scheduledEntry, status });
      renderPanel();

      await userEvent.click(await screen.findByRole('button', { name: label }));

      const outcomeLabel = { HELD: 'Held', MISSED: 'Missed', REFUSED: 'Refused' }[status];
      expect(await screen.findByText(outcomeLabel)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
  );

  it('schedules a dose linked to the selected in-house prescription', async () => {
    listMock.mockResolvedValueOnce([]);
    createMock.mockResolvedValueOnce({ ...scheduledEntry, id: 'mar-2' });
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Schedule a dose' }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Medication' }),
      'rx-line-1'
    );
    fireEvent.change(screen.getByLabelText('Scheduled time'), {
      target: { value: '2026-09-27T10:00' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save scheduled dose' }));

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
          scheduledAt: expect.any(String),
        })
      )
    );
    expect(await screen.findByText('Scheduled')).toBeInTheDocument();
    expect(
      screen.queryByText('No medication doses are scheduled for this inpatient stay.')
    ).not.toBeInTheDocument();
  });

  it('schedules without an optional prescription link and uses fallback directions', async () => {
    const unlinkedPrescription = {
      ...prescription,
      labelPrescriptionId: undefined,
      doseUnit: undefined,
      instructions: '',
    };
    createMock.mockResolvedValueOnce({ ...scheduledEntry, prescriptionId: null });
    renderPanel({ prescriptions: [unlinkedPrescription] });

    await userEvent.click(await screen.findByRole('button', { name: 'Schedule a dose' }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Medication' }),
      'rx-line-1'
    );
    expect(screen.getByText('Use the directions on the prescription.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Scheduled time'), {
      target: { value: '2026-09-27T10:00' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save scheduled dose' }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0]).not.toHaveProperty('prescriptionId');
  });

  it('keeps the form open and explains a scheduling failure', async () => {
    createMock.mockRejectedValueOnce(new Error('request failed'));
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Schedule a dose' }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Medication' }),
      'rx-line-1'
    );
    fireEvent.change(screen.getByLabelText('Scheduled time'), {
      target: { value: '2026-09-27T10:00' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save scheduled dose' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to schedule this dose.');
    expect(screen.getByRole('combobox', { name: 'Medication' })).toBeInTheDocument();
  });

  it('retries loading medication history after a load failure', async () => {
    listMock.mockRejectedValueOnce(new Error('request failed'));
    listMock.mockResolvedValueOnce([scheduledEntry]);
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load medication history.'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Meloxicam')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('shows a helpful state until inpatient identifiers are loaded', () => {
    renderPanel({ encounterId: undefined, prescriptions: [] });

    expect(
      screen.getByText('Medication history will be available once the inpatient record is loaded.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schedule a dose' })).not.toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('requires an in-house prescription with a dose and route before scheduling', async () => {
    renderPanel({
      prescriptions: [
        { ...prescription, fulfillment: 'PRESCRIPTION_ONLY' },
        { ...prescription, id: 'rx-no-dose', dose: undefined },
        { ...prescription, id: 'rx-no-route', route: undefined },
      ],
    });

    expect(
      await screen.findByText('No medication doses are scheduled for this inpatient stay.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Add an in-house prescription with a dose and route/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule a dose' })).toBeDisabled();
  });

  it('shows loaded history as read-only without outcome actions', async () => {
    listMock.mockResolvedValueOnce([scheduledEntry]);
    renderPanel({ readOnly: true });

    const row = await screen.findByText('Meloxicam');
    expect(screen.queryByRole('button', { name: 'Schedule a dose' })).not.toBeInTheDocument();
    const listItem = row.closest('li');
    expect(listItem).not.toBeNull();
    expect(
      within(listItem as HTMLElement).getByRole('button', { name: 'Record given' })
    ).toBeDisabled();
  });

  it('shows notes and the recorded time for prior outcomes', async () => {
    listMock.mockResolvedValueOnce([
      {
        ...scheduledEntry,
        status: 'HELD',
        notes: 'Dose held after the patient refused food.',
        updatedAt: '2026-09-27T10:10:00.000Z',
      },
    ]);
    renderPanel();

    expect(await screen.findByText('Held')).toBeInTheDocument();
    expect(screen.getByText('Outcome recorded · Today')).toBeInTheDocument();
    expect(screen.getByText('Dose held after the patient refused food.')).toBeInTheDocument();
  });

  it('reports an outcome failure without removing the scheduled dose', async () => {
    listMock
      .mockResolvedValueOnce([scheduledEntry])
      .mockResolvedValueOnce([{ ...scheduledEntry, status: 'GIVEN' }]);
    administerMock.mockRejectedValueOnce(new Error('conflict'));
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Record given' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to record this outcome.');
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Given')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record given' })).not.toBeInTheDocument();
  });
});
