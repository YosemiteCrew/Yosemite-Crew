import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import InpatientMonitoringPanel from './InpatientMonitoringPanel';
import {
  listHospitalizationObservations,
  recordHospitalizationObservation,
  type HospitalizationObservation,
} from '@/app/features/appointments/services/hospitalizationMonitoringService';

jest.mock('@/app/features/appointments/services/hospitalizationMonitoringService', () => ({
  listHospitalizationObservations: jest.fn(),
  recordHospitalizationObservation: jest.fn(),
}));

const record: HospitalizationObservation = {
  id: 'obs-1',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  observedAt: '2026-09-27T10:00:00.000Z',
  temperature: 38.2,
  temperatureUnit: 'C',
  heartRate: 90,
  respiratoryRate: 20,
  painScore: 2,
  inputMl: 12,
  outputMl: 8,
  notes: 'Resting comfortably',
  createdAt: '2026-09-27T10:01:00.000Z',
};

const props = {
  organisationId: 'org-1',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  readOnly: false,
};

describe('InpatientMonitoringPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(listHospitalizationObservations).mockResolvedValue([record]);
  });

  it('loads timestamped observations and shows recorded fluid balance', async () => {
    render(<InpatientMonitoringPanel {...props} />);

    expect(await screen.findByText('38.2 °C')).toBeInTheDocument();
    expect(screen.getByText('27 Sept 2026, 10:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('90 bpm')).toBeInTheDocument();
    expect(screen.getByText('12 mL')).toBeInTheDocument();
    expect(screen.getByText('+4 mL')).toBeInTheDocument();
    expect(screen.getByText('Resting comfortably')).toBeInTheDocument();
    expect(listHospitalizationObservations).toHaveBeenCalledWith(
      'org-1',
      'patient-1',
      'encounter-1'
    );
  });

  it('keeps missing intake or output as unrecorded instead of calculating a balance', async () => {
    jest
      .mocked(listHospitalizationObservations)
      .mockResolvedValue([{ ...record, inputMl: null, outputMl: 0 }]);
    render(<InpatientMonitoringPanel {...props} />);

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/Net recorded/)).not.toBeInTheDocument();
  });

  it('renders zero fluid balance without a temperature unit', async () => {
    jest
      .mocked(listHospitalizationObservations)
      .mockResolvedValue([{ ...record, temperatureUnit: null, inputMl: 8, outputMl: 8 }]);
    render(<InpatientMonitoringPanel {...props} />);

    expect(await screen.findByText('38.2')).toBeInTheDocument();
    expect(screen.getByText('0 mL')).toBeInTheDocument();
  });

  it('shows the newest observation first even when the service returns oldest first', async () => {
    jest.mocked(listHospitalizationObservations).mockResolvedValue([
      { ...record, id: 'obs-old', observedAt: '2026-09-27T08:00:00.000Z', notes: 'Earlier entry' },
      { ...record, id: 'obs-new', notes: 'Latest entry' },
    ]);
    render(<InpatientMonitoringPanel {...props} />);

    const entries = await screen.findByText('Latest entry');
    expect(entries.compareDocumentPosition(screen.getByText('Earlier entry'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('records observations and inserts the saved entry into the timeline', async () => {
    jest.mocked(recordHospitalizationObservation).mockResolvedValue({
      ...record,
      id: 'obs-2',
      inputMl: 15,
      outputMl: 5,
    });
    render(<InpatientMonitoringPanel {...props} />);
    await screen.findByText('38.2 °C');
    fireEvent.click(screen.getByRole('button', { name: 'Record observation' }));

    const form = screen.getByRole('button', { name: 'Save observation' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.change(within(form as HTMLFormElement).getByLabelText('Fluid intake (mL)'), {
      target: { value: '15' },
    });
    fireEvent.change(within(form as HTMLFormElement).getByLabelText('Fluid output (mL)'), {
      target: { value: '5' },
    });
    fireEvent.change(within(form as HTMLFormElement).getByLabelText('Notes'), {
      target: { value: 'Intake recorded' },
    });
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() =>
      expect(recordHospitalizationObservation).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          patientId: 'patient-1',
          encounterId: 'encounter-1',
          inputMl: 15,
          outputMl: 5,
          notes: 'Intake recorded',
        })
      )
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save observation' })).not.toBeInTheDocument()
    );
    expect(await screen.findByText('+10 mL')).toBeInTheDocument();
  });

  it('omits measurements and whitespace-only notes that were not entered', async () => {
    jest.mocked(recordHospitalizationObservation).mockResolvedValue({
      ...record,
      id: 'obs-3',
      temperature: null,
      temperatureUnit: null,
      heartRate: null,
      respiratoryRate: null,
      painScore: null,
      inputMl: null,
      outputMl: null,
      notes: null,
    });
    render(<InpatientMonitoringPanel {...props} />);
    await screen.findByText('38.2 °C');
    fireEvent.click(screen.getByRole('button', { name: 'Record observation' }));
    const form = screen.getByRole('button', { name: 'Save observation' }).closest('form');
    fireEvent.change(within(form as HTMLFormElement).getByLabelText('Notes'), {
      target: { value: '   ' },
    });
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(recordHospitalizationObservation).toHaveBeenCalled());
    const [payload] = jest.mocked(recordHospitalizationObservation).mock.calls[0];
    expect(payload).not.toHaveProperty('temperature');
    expect(payload).not.toHaveProperty('temperatureUnit');
    expect(payload).not.toHaveProperty('heartRate');
    expect(payload).not.toHaveProperty('respiratoryRate');
    expect(payload).not.toHaveProperty('painScore');
    expect(payload).not.toHaveProperty('inputMl');
    expect(payload).not.toHaveProperty('outputMl');
    expect(payload).not.toHaveProperty('notes');
  });

  it('omits file-valued notes entries', async () => {
    jest.mocked(recordHospitalizationObservation).mockResolvedValue({ ...record, id: 'obs-4' });
    render(<InpatientMonitoringPanel {...props} />);
    await screen.findByText('38.2 °C');
    fireEvent.click(screen.getByRole('button', { name: 'Record observation' }));

    const form = screen.getByRole('button', { name: 'Save observation' }).closest('form');
    expect(form).not.toBeNull();
    within(form as HTMLFormElement)
      .getByLabelText('Notes')
      .removeAttribute('name');
    const fileInput = document.createElement('input');
    fileInput.name = 'notes';
    fileInput.type = 'file';
    form?.append(fileInput);
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(recordHospitalizationObservation).toHaveBeenCalled());
    const [payload] = jest.mocked(recordHospitalizationObservation).mock.calls[0];
    expect(payload).not.toHaveProperty('notes');
  });

  it('shows retry after load failure', async () => {
    jest.mocked(listHospitalizationObservations).mockRejectedValue(new Error('offline'));
    render(<InpatientMonitoringPanel {...props} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load observations');
    jest.mocked(listHospitalizationObservations).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(listHospitalizationObservations).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText('No monitoring observations recorded for this stay.')
    ).toBeInTheDocument();
  });

  it('shows a save failure and does not hide the entered form', async () => {
    jest.mocked(recordHospitalizationObservation).mockRejectedValue(new Error('offline'));
    render(<InpatientMonitoringPanel {...props} />);
    await screen.findByText('38.2 °C');
    fireEvent.click(screen.getByRole('button', { name: 'Record observation' }));
    const form = screen.getByRole('button', { name: 'Save observation' }).closest('form');
    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save this observation');
    expect(screen.getByRole('button', { name: 'Save observation' })).toBeInTheDocument();
  });

  it('does not offer writes for a read-only encounter or before patient context loads', async () => {
    const { rerender } = render(<InpatientMonitoringPanel {...props} readOnly />);
    await screen.findByText('38.2 °C');
    expect(screen.queryByRole('button', { name: 'Record observation' })).not.toBeInTheDocument();

    rerender(<InpatientMonitoringPanel organisationId="org-1" readOnly={false} />);
    expect(
      screen.getByText(
        'Monitoring is available when the patient and inpatient encounter are loaded.'
      )
    ).toBeInTheDocument();
    expect(listHospitalizationObservations).toHaveBeenCalledTimes(1);
  });
});
