import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import InpatientMonitoringPanel from './InpatientMonitoringPanel';
import InpatientObservationForm from './InpatientObservationForm';
import { setPreferredTimeZone } from '@/app/lib/timezone';
import {
  listHospitalizationObservations,
  recordHospitalizationObservation,
  type HospitalizationObservation,
} from '@/app/features/appointments/services/hospitalizationMonitoringService';
import {
  useHospitalizationObservationFeed,
  useInpatientObservationEntry,
} from './useInpatientMonitoringPanel';

jest.mock('@/app/features/appointments/services/hospitalizationMonitoringService', () => ({
  listHospitalizationObservations: jest.fn(),
  recordHospitalizationObservation: jest.fn(),
}));

let mockPermissions: string[] = [];
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (perm: string) => mockPermissions.includes(perm) }),
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

const openForm = async () => {
  await screen.findByText('38.2 °C');
  fireEvent.click(screen.getByRole('button', { name: 'Record observation' }));
  const form = screen.getByRole('button', { name: 'Save observation' }).closest('form');
  expect(form).not.toBeNull();
  return form as HTMLFormElement;
};

const fill = (form: HTMLFormElement, label: string, value: string) =>
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });

const fluidRows = () =>
  within(screen.getByRole('table', { name: /Fluid balance/ }))
    .getAllByRole('row')
    .map((row) => row.textContent);

describe('InpatientMonitoringPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = ['appointments:view:any', 'appointments:edit:any'];
    // A clinic zone far from UTC and from any CI or laptop zone (UTC+9, no daylight saving), so
    // browser-local or UTC handling cannot pass by coincidence.
    expect(setPreferredTimeZone('Asia/Tokyo')).toBe(true);
    jest.mocked(listHospitalizationObservations).mockResolvedValue([record]);
  });

  it('loads observations and shows their time in the clinic time zone', async () => {
    render(<InpatientMonitoringPanel {...props} />);

    expect(await screen.findByText('38.2 °C')).toBeInTheDocument();
    const observedAt = screen.getByText('Sep 27, 2026, 07:00 PM');
    expect(observedAt.tagName).toBe('TIME');
    expect(observedAt.closest('h3')).not.toBeInTheDocument();
    const entry = screen.getByRole('listitem');
    expect(within(entry).getByText('90 bpm')).toBeInTheDocument();
    expect(within(entry).getByText('12 mL')).toBeInTheDocument();
    expect(within(entry).getByText('+4 mL')).toBeInTheDocument();
    expect(within(entry).getByText('Resting comfortably')).toBeInTheDocument();
    expect(listHospitalizationObservations).toHaveBeenCalledWith(
      'org-1',
      'patient-1',
      'encounter-1'
    );
  });

  it('keeps a missing intake or output as unrecorded instead of calculating a net', async () => {
    jest
      .mocked(listHospitalizationObservations)
      .mockResolvedValue([{ ...record, heartRate: null, inputMl: null, outputMl: 0 }]);
    render(<InpatientMonitoringPanel {...props} />);

    const entry = await screen.findByRole('listitem');
    expect(within(entry).getByText('Heart rate').nextElementSibling).toHaveTextContent(/^—$/);
    expect(within(entry).getByText('Intake').nextElementSibling).toHaveTextContent(/^—$/);
    expect(within(entry).getByText('Output').nextElementSibling).toHaveTextContent(/^0 mL$/);
    expect(within(entry).queryByText('Net')).not.toBeInTheDocument();
  });

  it('renders a zero net without a sign and a temperature without a unit', async () => {
    jest
      .mocked(listHospitalizationObservations)
      .mockResolvedValue([{ ...record, temperatureUnit: null, inputMl: 8, outputMl: 8 }]);
    render(<InpatientMonitoringPanel {...props} />);

    const entry = await screen.findByRole('listitem');
    expect(within(entry).getByText('38.2')).toBeInTheDocument();
    expect(within(entry).getByText('Net').nextElementSibling).toHaveTextContent(/^0 mL$/);
  });

  it('shows the newest observation first even when the service returns oldest first', async () => {
    jest.mocked(listHospitalizationObservations).mockResolvedValue([
      { ...record, id: 'obs-old', observedAt: '2026-09-27T08:00:00.000Z', notes: 'Earlier entry' },
      { ...record, id: 'obs-new', notes: 'Latest entry' },
    ]);
    render(<InpatientMonitoringPanel {...props} />);

    const latest = await screen.findByText('Latest entry');
    expect(latest.compareDocumentPosition(screen.getByText('Earlier entry'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('totals recorded fluid per clinic day and for the whole stay without float drift', async () => {
    jest.mocked(listHospitalizationObservations).mockResolvedValue([
      { ...record, id: 'a', observedAt: '2026-09-27T10:00:00.000Z', inputMl: 0.1, outputMl: null },
      { ...record, id: 'b', observedAt: '2026-09-27T11:00:00.000Z', inputMl: 0.2, outputMl: 0.3 },
      {
        ...record,
        id: 'c',
        observedAt: '2026-09-26T10:00:00.000Z',
        inputMl: 1250,
        outputMl: 400.5,
      },
      { ...record, id: 'd', observedAt: '2026-09-25T10:00:00.000Z', inputMl: null, outputMl: null },
    ]);
    render(<InpatientMonitoringPanel {...props} />);
    await screen.findAllByRole('listitem');

    expect(fluidRows()).toEqual([
      'DayIntakeOutputNet',
      'Sep 27, 20260.3 mL0.3 mL0 mL',
      'Sep 26, 20261,250 mL400.5 mL+849.5 mL',
      'Whole stay1,250.3 mL400.8 mL+849.5 mL',
    ]);
  });

  it('groups by the clinic day, not the UTC day, and skips the stay row for a single day', async () => {
    jest.mocked(listHospitalizationObservations).mockResolvedValue([
      // 20:00 UTC on the 26th is already 05:00 on the 27th in the clinic zone.
      { ...record, id: 'a', observedAt: '2026-09-26T20:00:00.000Z', inputMl: 100, outputMl: 150 },
      { ...record, id: 'b', observedAt: '2026-09-27T10:00:00.000Z', inputMl: 20, outputMl: 0 },
    ]);
    render(<InpatientMonitoringPanel {...props} />);
    await screen.findAllByRole('listitem');

    expect(fluidRows()).toEqual(['DayIntakeOutputNet', 'Sep 27, 2026120 mL150 mL-30 mL']);
  });

  it('shows no fluid balance when no observation recorded intake or output', async () => {
    jest
      .mocked(listHospitalizationObservations)
      .mockResolvedValue([{ ...record, inputMl: null, outputMl: null }]);
    render(<InpatientMonitoringPanel {...props} />);
    await screen.findByRole('listitem');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('records an observation typed in clinic time and inserts it into the timeline', async () => {
    jest.mocked(recordHospitalizationObservation).mockResolvedValue({
      ...record,
      id: 'obs-2',
      inputMl: 15,
      outputMl: 5,
    });
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Observed at', '2026-09-27T12:00');
    fill(form, 'Temperature (°C)', '38.4');
    fill(form, 'Fluid intake (mL)', '15');
    fill(form, 'Fluid output (mL)', '5');
    fill(form, 'Notes', '  Intake recorded  ');
    fireEvent.submit(form);

    await waitFor(() => expect(recordHospitalizationObservation).toHaveBeenCalledTimes(1));
    expect(jest.mocked(recordHospitalizationObservation).mock.calls[0][0]).toEqual({
      organisationId: 'org-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      observedAt: '2026-09-27T03:00:00.000Z',
      temperature: 38.4,
      temperatureUnit: 'C',
      inputMl: 15,
      outputMl: 5,
      notes: 'Intake recorded',
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save observation' })).not.toBeInTheDocument()
    );
    expect(await screen.findByText('+10 mL')).toBeInTheDocument();
  });

  it('prefills the observation time with the current clinic time', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-29T08:30:00.000Z'), advanceTimers: true });
    try {
      render(<InpatientMonitoringPanel {...props} />);
      const form = await openForm();
      expect(within(form).getByLabelText('Observed at')).toHaveValue('2026-09-29T17:30');
    } finally {
      jest.useRealTimers();
    }
  });

  it('refuses an observation time in the future', async () => {
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Observed at', '2099-01-01T00:00');
    fill(form, 'Heart rate (bpm)', '90');
    fireEvent.submit(form);

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'The observation time cannot be in the future.'
    );
    expect(recordHospitalizationObservation).not.toHaveBeenCalled();
  });

  it('does not submit without an observation time', async () => {
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Observed at', '');
    fill(form, 'Heart rate (bpm)', '90');
    fireEvent.submit(form);

    await waitFor(() => expect(within(form).queryByRole('alert')).not.toBeInTheDocument());
    expect(recordHospitalizationObservation).not.toHaveBeenCalled();
  });

  it('refuses an empty observation, and cancelling clears that message', async () => {
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Notes', '   ');
    fireEvent.submit(form);

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Enter at least one measurement or a note.'
    );
    expect(recordHospitalizationObservation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record observation' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends only the measurements that were entered', async () => {
    jest.mocked(recordHospitalizationObservation).mockResolvedValue({ ...record, id: 'obs-3' });
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Heart rate (bpm)', '88');
    fireEvent.submit(form);

    await waitFor(() => expect(recordHospitalizationObservation).toHaveBeenCalled());
    const [payload] = jest.mocked(recordHospitalizationObservation).mock.calls[0];
    expect(payload).toEqual(expect.objectContaining({ heartRate: 88 }));
    for (const key of [
      'temperature',
      'temperatureUnit',
      'respiratoryRate',
      'painScore',
      'inputMl',
      'outputMl',
      'notes',
    ]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it('omits file-valued notes entries', async () => {
    jest.mocked(recordHospitalizationObservation).mockResolvedValue({ ...record, id: 'obs-4' });
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Heart rate (bpm)', '88');
    within(form).getByLabelText('Notes').removeAttribute('name');
    const fileInput = document.createElement('input');
    fileInput.name = 'notes';
    fileInput.type = 'file';
    form.append(fileInput);
    fireEvent.submit(form);

    await waitFor(() => expect(recordHospitalizationObservation).toHaveBeenCalled());
    const [payload] = jest.mocked(recordHospitalizationObservation).mock.calls[0];
    expect(payload).not.toHaveProperty('notes');
  });

  it('blocks out-of-range values before they reach the service', async () => {
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    // A Fahrenheit reading typed into the Celsius field.
    fill(form, 'Temperature (°C)', '101.5');
    fill(form, 'Pain score (0–10)', '11');
    fill(form, 'Fluid output (mL)', '-5');

    expect(within(form).getByLabelText('Temperature (°C)')).toBeInvalid();
    expect(within(form).getByLabelText('Pain score (0–10)')).toBeInvalid();
    expect(within(form).getByLabelText('Fluid output (mL)')).toBeInvalid();
    fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));

    expect(recordHospitalizationObservation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save observation' })).toBeInTheDocument();
  });

  it('accepts in-range values at the bounds', async () => {
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Temperature (°C)', '41.5');
    fill(form, 'Pain score (0–10)', '10');
    fill(form, 'Fluid output (mL)', '0');

    expect(within(form).getByLabelText('Temperature (°C)')).toBeValid();
    expect(within(form).getByLabelText('Pain score (0–10)')).toBeValid();
    expect(within(form).getByLabelText('Fluid output (mL)')).toBeValid();
  });

  it('shows retry after load failure', async () => {
    jest.mocked(listHospitalizationObservations).mockRejectedValue(new Error('offline'));
    render(<InpatientMonitoringPanel {...props} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load observations');
    expect(
      screen.queryByText('No monitoring observations recorded for this stay.')
    ).not.toBeInTheDocument();
    jest.mocked(listHospitalizationObservations).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(listHospitalizationObservations).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText('No monitoring observations recorded for this stay.')
    ).toBeInTheDocument();
  });

  it('shows a save failure and keeps the entered form', async () => {
    jest.mocked(recordHospitalizationObservation).mockRejectedValue(new Error('offline'));
    render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Heart rate (bpm)', '88');
    fireEvent.submit(form);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save this observation');
    expect(within(form).getByLabelText('Heart rate (bpm)')).toHaveValue(88);
  });

  it('does not offer writes for a read-only encounter', async () => {
    render(<InpatientMonitoringPanel {...props} readOnly />);
    await screen.findByText('38.2 °C');
    expect(screen.queryByRole('button', { name: 'Record observation' })).not.toBeInTheDocument();
  });

  it('shows observations but no recording to staff without edit permission', async () => {
    mockPermissions = ['appointments:view:any'];
    render(<InpatientMonitoringPanel {...props} />);
    await screen.findByText('38.2 °C');
    expect(screen.queryByRole('button', { name: 'Record observation' })).not.toBeInTheDocument();
  });

  it('renders nothing and loads nothing without view permission', () => {
    mockPermissions = ['appointments:edit:any'];
    const { container } = render(<InpatientMonitoringPanel {...props} />);
    expect(container).toBeEmptyDOMElement();
    expect(listHospitalizationObservations).not.toHaveBeenCalled();
  });

  it('waits for patient context before loading', () => {
    render(<InpatientMonitoringPanel organisationId="org-1" readOnly={false} />);
    expect(
      screen.getByText(
        'Monitoring is available when the patient and inpatient encounter are loaded.'
      )
    ).toBeInTheDocument();
    expect(listHospitalizationObservations).not.toHaveBeenCalled();
  });

  it('drops the previous patient observations and open form when the patient changes', async () => {
    const { rerender } = render(<InpatientMonitoringPanel {...props} />);
    const form = await openForm();
    fill(form, 'Heart rate (bpm)', '88');

    jest.mocked(listHospitalizationObservations).mockReturnValue(new Promise(() => {}));
    rerender(
      <InpatientMonitoringPanel {...props} patientId="patient-2" encounterId="encounter-2" />
    );

    expect(screen.queryByText('38.2 °C')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save observation' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading observations');
    expect(listHospitalizationObservations).toHaveBeenLastCalledWith(
      'org-1',
      'patient-2',
      'encounter-2'
    );
  });
});

describe('InpatientObservationForm', () => {
  it('renders its initial time and forwards form actions', () => {
    const onSubmit = jest.fn(async () => undefined);
    const onCancel = jest.fn();

    render(
      <InpatientObservationForm
        defaultObservedAt="2026-09-29T17:30"
        isSaving={false}
        error={null}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    expect(screen.getByLabelText('Observed at')).toHaveValue('2026-09-29T17:30');
    const form = screen.getByRole('button', { name: 'Save observation' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('inpatient monitoring hooks', () => {
  const context = {
    organisationId: 'org-1',
    patientId: 'patient-1',
    encounterId: 'encounter-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    expect(setPreferredTimeZone('Asia/Tokyo')).toBe(true);
  });

  it('loads records newest first and adds a saved observation in order', async () => {
    jest.mocked(listHospitalizationObservations).mockResolvedValue([
      { ...record, id: 'older', observedAt: '2026-09-27T08:00:00.000Z' },
      { ...record, id: 'newer', observedAt: '2026-09-27T10:00:00.000Z' },
    ]);
    const { result } = renderHook(() => useHospitalizationObservationFeed(context));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.records.map(({ id }) => id)).toEqual(['newer', 'older']);

    act(() =>
      result.current.addObservation({
        ...record,
        id: 'saved',
        observedAt: '2026-09-27T12:00:00.000Z',
      })
    );
    expect(result.current.records.map(({ id }) => id)).toEqual(['saved', 'newer', 'older']);
  });

  it('saves an observation in clinic time and closes the entry form', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-29T08:30:00.000Z'), advanceTimers: true });
    jest.mocked(recordHospitalizationObservation).mockResolvedValue({ ...record, id: 'saved' });
    const onSaved = jest.fn();
    const { result } = renderHook(() => useInpatientObservationEntry({ ...context, onSaved }));

    try {
      act(() => result.current.openForm());
      expect(result.current.formObservedAt).toBe('2026-09-29T17:30');
      const form = document.createElement('form');
      const observedAt = document.createElement('input');
      observedAt.name = 'observedAt';
      observedAt.value = '2026-09-29T17:30';
      const heartRate = document.createElement('input');
      heartRate.name = 'heartRate';
      heartRate.value = '88';
      form.append(observedAt, heartRate);

      await act(async () =>
        result.current.saveObservation({
          preventDefault: jest.fn(),
          currentTarget: form,
        } as unknown as React.FormEvent<HTMLFormElement>)
      );

      expect(recordHospitalizationObservation).toHaveBeenCalledWith({
        ...context,
        observedAt: '2026-09-29T08:30:00.000Z',
        heartRate: 88,
      });
      expect(onSaved).toHaveBeenCalledWith({ ...record, id: 'saved' });
      expect(result.current.formObservedAt).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
