import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { isAuthRedirectError } from '@/app/services/axios';
import PocLabListPanel from '@/app/features/companionHistory/components/PocLabListPanel';
import {
  createPocLabResult,
  fetchPocLabResults,
  type PointOfCareLabResult,
} from '@/app/features/companionHistory/services/pocLabService';

const VIEW = 'appointments:view:any';
const EDIT = 'appointments:edit:any';
let permissionsMock = [VIEW];
const mockNotify = jest.fn();

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (permission: string) => permissionsMock.includes(permission) }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: { primaryOrgId: string }) => unknown) =>
    selector({ primaryOrgId: 'org-1' }),
}));

jest.mock('@/app/services/axios', () => ({
  isAuthRedirectError: jest.fn(() => false),
}));

jest.mock('@/app/features/companionHistory/services/pocLabService', () => ({
  fetchPocLabResults: jest.fn(),
  createPocLabResult: jest.fn(),
}));

const fetchMock = fetchPocLabResults as jest.Mock;
const createMock = createPocLabResult as jest.Mock;
const isAuthRedirectMock = isAuthRedirectError as jest.Mock;
const EMPTY = 'No in-house lab results recorded for this patient yet.';

type Settle = {
  resolve: (records: PointOfCareLabResult[]) => void;
  reject: (reason: unknown) => void;
};

const labResult = (
  overrides: Partial<PointOfCareLabResult> & { id: string }
): PointOfCareLabResult => ({
  organisationId: 'org-1',
  patientId: 'patient-1',
  encounterId: null,
  conductedAt: '2026-06-30T10:00:00.000Z',
  conductedBy: 'staff-1',
  testType: 'CBC',
  analyzerName: 'ProCyte One',
  sampleType: 'Whole blood',
  results: [
    {
      name: 'Haematocrit',
      value: 28,
      unit: '%',
      referenceRangeLow: 37,
      referenceRangeHigh: 55,
      flag: 'L',
    },
  ],
  overallInterpretation: 'Mild non-regenerative anaemia',
  abnormalFlags: ['Haematocrit'],
  criticalFlags: [],
  followUpRecommended: true,
  notes: 'Repeat in one week',
  createdAt: '2026-06-30T10:00:00.000Z',
  updatedAt: '2026-06-30T10:00:00.000Z',
  ...overrides,
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  permissionsMock = [VIEW];
  isAuthRedirectMock.mockReturnValue(false);
  fetchMock.mockResolvedValue([]);
});

/** Opens the form and fills the smallest valid result: one flagged parameter. */
const recordMinimalResult = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Add lab result' }));
  await userEvent.click(screen.getByRole('button', { name: 'Test type' }));
  await userEvent.click(
    within(screen.getByRole('listbox')).getByRole('option', { name: 'Complete blood count' })
  );
  await userEvent.type(screen.getByLabelText('Parameter 1 name'), 'PLT');
  await userEvent.type(screen.getByLabelText('Parameter 1 value'), '38');
  await userEvent.click(screen.getByRole('button', { name: /Parameter 1 flag/ }));
  await userEvent.click(
    within(screen.getByRole('listbox')).getByRole('option', { name: 'Critical low' })
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save lab result' }));
};

describe('PocLabListPanel', () => {
  it('loads the patient list and expands a result detail', async () => {
    // The meta line is local time; pin its text so the snapshot holds in every zone.
    jest.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('30 Jun 2026, 10:00');
    fetchMock.mockResolvedValue([labResult({ id: 'lab-1' })]);
    const { container } = render(<PocLabListPanel companionId="patient-1" />);

    expect(await screen.findByText('Complete blood count')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith({ patientId: 'patient-1' });
    expect(screen.queryByText('Mild non-regenerative anaemia')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Complete blood count/ }));

    expect(screen.getByText('Haematocrit')).toBeInTheDocument();
    expect(screen.getByText('Reference 37–55')).toBeInTheDocument();
    expect(screen.getByText('28 %')).toBeInTheDocument();
    expect(screen.getByText('Mild non-regenerative anaemia')).toBeInTheDocument();
    expect(screen.getByText('Repeat in one week')).toBeInTheDocument();
    expect(container).toMatchSnapshot();

    await userEvent.click(screen.getByRole('button', { name: /Complete blood count/ }));
    expect(screen.queryByText('Haematocrit')).not.toBeInTheDocument();
  });

  it('shows critical and abnormal summaries with bounded reference ranges', async () => {
    fetchMock.mockResolvedValue([
      labResult({ id: 'critical', criticalFlags: ['Potassium'], followUpRecommended: false }),
      labResult({
        id: 'abnormal',
        testType: 'BLOOD_CHEMISTRY',
        results: [
          { name: 'Creatinine', value: 210, referenceRangeHigh: 159, flag: 'HH' },
          { name: 'Albumin', value: 18, referenceRangeLow: 22 },
          { name: 'Sample quality', value: 'Haemolysed' },
        ],
        abnormalFlags: ['Creatinine'],
        criticalFlags: [],
        overallInterpretation: null,
        notes: null,
      }),
    ]);
    render(<PocLabListPanel companionId="patient-1" />);

    expect(await screen.findByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Abnormal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Blood chemistry/ }));
    expect(screen.getByText('Reference Up to 159')).toBeInTheDocument();
    expect(screen.getByText('Reference From 22')).toBeInTheDocument();
    expect(screen.getByText('Haemolysed')).toBeInTheDocument();
  });

  it('shows empty and error states', async () => {
    const { rerender } = render(<PocLabListPanel companionId="patient-1" />);
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();

    fetchMock.mockRejectedValueOnce(new Error('failed'));
    rerender(<PocLabListPanel companionId="patient-2" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load in-house lab results'
    );
  });

  it('does not show a load error for an authentication redirect', async () => {
    fetchMock.mockRejectedValue(new Error('redirecting'));
    isAuthRedirectMock.mockReturnValue(true);
    render(<PocLabListPanel companionId="patient-1" />);

    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reloads when the companion changes', async () => {
    fetchMock
      .mockResolvedValueOnce([labResult({ id: 'lab-1' })])
      .mockResolvedValueOnce([
        labResult({ id: 'lab-2', patientId: 'patient-2', testType: 'URINALYSIS' }),
      ]);
    const { rerender } = render(<PocLabListPanel companionId="patient-1" />);
    await screen.findByText('Complete blood count');

    rerender(<PocLabListPanel companionId="patient-2" />);

    expect(await screen.findByText('Urinalysis')).toBeInTheDocument();
    expect(screen.queryByText('Complete blood count')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith({ patientId: 'patient-2' });
  });

  it.each([
    ['answers', (settle: Settle) => settle.resolve([labResult({ id: 'lab-1' })])],
    ['fails', (settle: Settle) => settle.reject(new Error('late'))],
  ])('ignores a list request that %s after the companion changes', async (_label, finish) => {
    const settle = {} as Settle;
    fetchMock
      .mockReturnValueOnce(
        new Promise((resolve, reject) => Object.assign(settle, { resolve, reject }))
      )
      .mockResolvedValueOnce([labResult({ id: 'lab-2', testType: 'URINALYSIS' })]);
    const { rerender } = render(<PocLabListPanel companionId="patient-1" />);
    rerender(<PocLabListPanel companionId="patient-2" />);
    expect(await screen.findByText('Urinalysis')).toBeInTheDocument();

    await act(async () => finish(settle));

    expect(screen.getByText('Urinalysis')).toBeInTheDocument();
    expect(screen.queryByText('Complete blood count')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders nothing without view permission or a companion id', async () => {
    permissionsMock = [];
    const { container, rerender } = render(<PocLabListPanel companionId="patient-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();

    permissionsMock = [VIEW];
    rerender(<PocLabListPanel companionId="" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the count in a neutral "recorded" pill and no add control for a view-only member', async () => {
    fetchMock.mockResolvedValue([labResult({ id: 'lab-1' }), labResult({ id: 'lab-2' })]);
    render(<PocLabListPanel companionId="patient-1" />);

    expect(await screen.findByText('2 recorded')).toHaveAttribute(
      'style',
      expect.stringContaining('pill-neutral-bg')
    );
    expect(screen.queryByRole('button', { name: 'Add lab result' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('gives a row without flags or follow-up no pill line, keeping the chevron beside the title', async () => {
    fetchMock.mockResolvedValue([
      labResult({ id: 'plain', abnormalFlags: [], criticalFlags: [], followUpRecommended: null }),
    ]);
    render(<PocLabListPanel companionId="patient-1" />);

    const row = await screen.findByRole('button', { name: /Complete blood count/ });
    expect(within(row).queryByText(/Critical|Abnormal|Follow-up/)).not.toBeInTheDocument();
    expect(row).not.toHaveClass('md:grid-cols-[minmax(0,1fr)_auto_auto]');
    expect(row.querySelector('svg')).not.toHaveClass('md:col-start-3');
  });

  it('records a result, announces it, and opens it in date order', async () => {
    permissionsMock = [VIEW, EDIT];
    fetchMock.mockResolvedValue([
      labResult({ id: 'newer', testType: 'URINALYSIS', conductedAt: '2026-09-20T10:00:00.000Z' }),
      labResult({ id: 'older', testType: 'CYTOLOGY', conductedAt: '2026-05-01T10:00:00.000Z' }),
    ]);
    createMock.mockResolvedValue(
      labResult({
        id: 'created',
        testType: 'CBC',
        conductedAt: '2026-07-01T10:00:00.000Z',
        results: [{ name: 'PLT', value: 38, flag: 'LL' }],
        abnormalFlags: [],
        criticalFlags: ['PLT'],
        overallInterpretation: null,
        notes: null,
      })
    );
    render(<PocLabListPanel companionId="patient-1" />);
    await screen.findByText('Urinalysis');

    await recordMinimalResult();

    expect(createMock).toHaveBeenCalledWith({
      patientId: 'patient-1',
      testType: 'CBC',
      conductedAt: expect.any(String),
      results: [{ name: 'PLT', value: 38, flag: 'LL' }],
      criticalFlags: ['PLT'],
    });
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('success', {
        title: 'Lab result recorded',
        text: 'Complete blood count was added to in-house lab results.',
      })
    );
    expect(screen.queryByRole('form', { name: 'Record a lab result' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add lab result' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByText('3 recorded')).toBeInTheDocument();

    const rows = screen.getAllByRole('button', { expanded: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Complete blood count');
    expect(screen.getByRole('list', { name: 'Complete blood count parameters' })).toBeVisible();
    const order = screen
      .getAllByRole('button', { name: /Urinalysis|Cytology|Complete blood count/ })
      .map((button) => button.textContent ?? '');
    expect(order[0]).toMatch(/^Urinalysis/);
    expect(order[1]).toMatch(/^Complete blood count/);
    expect(order[2]).toMatch(/^Cytology/);
  });

  it('reloads a list that failed to load once a result is saved, and opens the new one', async () => {
    permissionsMock = [VIEW, EDIT];
    const older = labResult({
      id: 'older',
      testType: 'CYTOLOGY',
      conductedAt: '2026-05-01T10:00:00.000Z',
    });
    const created = labResult({
      id: 'created',
      conductedAt: '2026-07-01T10:00:00.000Z',
      results: [{ name: 'PLT', value: 38, flag: 'LL' }],
    });
    fetchMock.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce([created, older]);
    createMock.mockResolvedValue(created);
    render(<PocLabListPanel companionId="patient-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load in-house lab results'
    );

    await recordMinimalResult();

    expect(await screen.findByText('2 recorded')).toBeInTheDocument();
    expect(screen.queryByText(/Could not load in-house lab results/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete blood count/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: /Cytology/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(mockNotify).toHaveBeenCalledWith('success', {
      title: 'Lab result recorded',
      text: 'Complete blood count was added to in-house lab results.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith({ patientId: 'patient-1' });
  });

  it('shows the load error again, once, when that reload fails too', async () => {
    permissionsMock = [VIEW, EDIT];
    fetchMock.mockRejectedValue(new Error('failed'));
    createMock.mockResolvedValue(labResult({ id: 'created' }));
    render(<PocLabListPanel companionId="patient-1" />);
    await screen.findByRole('alert');

    await recordMinimalResult();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load in-house lab results'
    );
    expect(screen.queryByText(/recorded$/)).not.toBeInTheDocument();
    // The reload is not retried in a loop.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the form open with its values and notifies when the save fails', async () => {
    permissionsMock = [VIEW, EDIT];
    createMock.mockRejectedValue(new Error('500'));
    render(<PocLabListPanel companionId="patient-1" />);
    await screen.findByText(EMPTY);

    await recordMinimalResult();

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Could not record lab result',
        text: 'Please try again.',
      })
    );
    expect(screen.getByRole('form', { name: 'Record a lab result' })).toBeInTheDocument();
    expect(screen.getByLabelText('Parameter 1 value')).toHaveValue('38');
    expect(screen.getByRole('button', { name: 'Save lab result' })).toBeEnabled();
  });

  it('stays silent when the save fails on an authentication redirect', async () => {
    permissionsMock = [VIEW, EDIT];
    createMock.mockRejectedValue(new Error('redirecting'));
    render(<PocLabListPanel companionId="patient-1" />);
    await screen.findByText(EMPTY);
    isAuthRedirectMock.mockReturnValue(true);

    await recordMinimalResult();

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('does not apply a save that finishes after the companion changes', async () => {
    permissionsMock = [VIEW, EDIT];
    let finishCreate!: (value: PointOfCareLabResult) => void;
    createMock.mockReturnValue(new Promise((resolve) => (finishCreate = resolve)));
    const { rerender } = render(<PocLabListPanel companionId="patient-1" />);
    await screen.findByText(EMPTY);
    await recordMinimalResult();
    expect(screen.getByRole('button', { name: 'Save lab result' })).toBeDisabled();

    rerender(<PocLabListPanel companionId="patient-2" />);
    // The next patient never inherits the open form or its entries.
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    finishCreate(labResult({ id: 'late' }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith({ patientId: 'patient-2' }));
    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByText('Complete blood count')).not.toBeInTheDocument();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('does not report a failure that finishes after the companion changes', async () => {
    permissionsMock = [VIEW, EDIT];
    let failCreate!: (reason: unknown) => void;
    createMock.mockReturnValue(new Promise((_resolve, reject) => (failCreate = reject)));
    const { rerender } = render(<PocLabListPanel companionId="patient-1" />);
    await screen.findByText(EMPTY);
    await recordMinimalResult();

    rerender(<PocLabListPanel companionId="patient-2" />);
    failCreate(new Error('late'));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith({ patientId: 'patient-2' }));
    await screen.findByText(EMPTY);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('never posts without a companion id', async () => {
    permissionsMock = [VIEW, EDIT];
    render(<PocLabListPanel companionId="" />);

    await recordMinimalResult();

    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByRole('form', { name: 'Record a lab result' })).toBeInTheDocument();
  });
});
