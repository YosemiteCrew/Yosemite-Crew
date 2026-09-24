import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { isAuthRedirectError } from '@/app/services/axios';
import VitalsHistoryPanel from '@/app/features/companionHistory/components/VitalsHistoryPanel';
import { formatDate } from '@/app/features/companionHistory/components/ClinicalListChrome';
import {
  fetchPatientVitalsHistory,
  type VitalsHistoryEntry,
} from '@/app/features/companionHistory/services/patientVitalsService';

let permissionsMock = ['companions:view:any', 'forms:view:any'];

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (permission: string) => permissionsMock.includes(permission) }),
}));

jest.mock('@/app/services/axios', () => ({
  isAuthRedirectError: jest.fn(() => false),
}));

jest.mock('@/app/features/companionHistory/services/patientVitalsService', () => ({
  fetchPatientVitalsHistory: jest.fn(),
}));

const fetchMock = fetchPatientVitalsHistory as jest.Mock;
const isAuthRedirectMock = isAuthRedirectError as jest.Mock;

const visit = (
  id: string,
  measuredAt: string,
  measurements: VitalsHistoryEntry['measurements'],
  recordedByDisplay: string | null = 'Nurse Joy'
): VitalsHistoryEntry => ({
  measuredAt,
  recordedBy: 'user-1',
  recordedByDisplay,
  source: {
    type: 'VITAL_RECORD',
    id,
    appointmentId: 'appt-1',
    encounterId: null,
    status: 'SIGNED',
  },
  measurements,
});

const inpatient = (
  id: string,
  measuredAt: string,
  measurements: VitalsHistoryEntry['measurements']
): VitalsHistoryEntry => ({
  measuredAt,
  recordedBy: null,
  recordedByDisplay: null,
  source: { type: 'INPATIENT_MONITORING', id, admissionId: 'adm-1', encounterId: null },
  measurements,
});

beforeEach(() => {
  jest.clearAllMocks();
  permissionsMock = ['companions:view:any', 'forms:view:any'];
  fetchMock.mockResolvedValue({ entries: [], truncated: false });
});

describe('VitalsHistoryPanel', () => {
  it('lists readings with labels, units and where they came from', async () => {
    fetchMock.mockResolvedValue({
      entries: [
        visit('v-2', '2026-03-01T09:00:00.000Z', [
          { code: 'weightKg', value: 12.4, unit: 'kg' },
          { code: 'crtSec', value: '<2', unit: 's' },
          { code: 'mystery', value: 7, unit: null },
          { code: 'constructor', value: 3, unit: null },
        ]),
        inpatient('m-1', '2026-02-01T09:00:00.000Z', [{ code: 'tempF', value: 101.5, unit: '°F' }]),
      ],
      truncated: false,
    });

    render(<VitalsHistoryPanel companionId="patient-1" />);

    const rows = await screen.findAllByRole('listitem');
    expect(fetchMock).toHaveBeenCalledWith('patient-1');
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0]).getByText(formatDate('2026-03-01T09:00:00.000Z') as string)
    ).toBeInTheDocument();
    expect(within(rows[0]).getByText('Visit vitals · Nurse Joy')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Weight')).toBeInTheDocument();
    expect(within(rows[0]).getByText('12.4 kg')).toBeInTheDocument();
    expect(within(rows[0]).getByText('<2 s')).toBeInTheDocument();
    expect(within(rows[0]).getByText('mystery')).toBeInTheDocument();
    expect(within(rows[0]).getByText('7')).toBeInTheDocument();
    expect(within(rows[0]).getByText('constructor')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Inpatient observation')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Temperature')).toBeInTheDocument();
    expect(within(rows[1]).getByText('101.5 °F')).toBeInTheDocument();
    expect(screen.getByText('2 recorded')).toBeInTheDocument();
    expect(screen.queryByText(/most recent readings/)).not.toBeInTheDocument();
  });

  it('summarises the latest weight and the change since the one before', async () => {
    fetchMock.mockResolvedValue({
      entries: [
        visit('v-3', '2026-03-01T09:00:00.000Z', [{ code: 'weightKg', value: 12.4, unit: 'kg' }]),
        inpatient('m-1', '2026-02-15T09:00:00.000Z', [
          { code: 'heartRateBpm', value: 90, unit: 'beats/min' },
        ]),
        visit('v-2', '2026-02-01T09:00:00.000Z', [{ code: 'weightKg', value: 12.1, unit: 'kg' }]),
      ],
      truncated: false,
    });

    render(<VitalsHistoryPanel companionId="patient-1" />);

    expect(await screen.findByText('Latest weight 12.4 kg')).toBeInTheDocument();
    expect(
      screen.getByText(`+0.3 kg since ${formatDate('2026-02-01T09:00:00.000Z')}`)
    ).toBeInTheDocument();
  });

  it('shows a loss without a plus sign', async () => {
    fetchMock.mockResolvedValue({
      entries: [
        visit('v-2', '2026-03-01T09:00:00.000Z', [{ code: 'weightLbs', value: 26, unit: 'lb' }]),
        visit('v-1', '2026-02-01T09:00:00.000Z', [{ code: 'weightLbs', value: 27.5, unit: 'lb' }]),
      ],
      truncated: false,
    });

    render(<VitalsHistoryPanel companionId="patient-1" />);

    expect(
      await screen.findByText(`-1.5 lb since ${formatDate('2026-02-01T09:00:00.000Z')}`)
    ).toBeInTheDocument();
  });

  it('does not compare weights recorded in different units', async () => {
    fetchMock.mockResolvedValue({
      entries: [
        visit('v-2', '2026-03-01T09:00:00.000Z', [{ code: 'weightKg', value: 12.4, unit: 'kg' }]),
        visit('v-1', '2026-02-01T09:00:00.000Z', [{ code: 'weightLbs', value: 27, unit: 'lb' }]),
      ],
      truncated: false,
    });

    render(<VitalsHistoryPanel companionId="patient-1" />);

    expect(await screen.findByText('Latest weight 12.4 kg')).toBeInTheDocument();
    expect(screen.queryByText(/since/)).not.toBeInTheDocument();
  });

  it('shows the latest weight alone when there is only one, and ignores a weight written as text', async () => {
    fetchMock.mockResolvedValue({
      entries: [
        visit('v-2', '2026-03-01T09:00:00.000Z', [
          { code: 'weightKg', value: 'about 12', unit: 'kg' },
        ]),
        visit('v-1', '2026-02-01T09:00:00.000Z', [{ code: 'weightKg', value: 11, unit: 'kg' }]),
      ],
      truncated: false,
    });

    render(<VitalsHistoryPanel companionId="patient-1" />);

    expect(await screen.findByText('Latest weight 11 kg')).toBeInTheDocument();
    expect(screen.queryByText(/since/)).not.toBeInTheDocument();
  });

  it('has no weight summary when no weight was recorded', async () => {
    fetchMock.mockResolvedValue({
      entries: [
        visit('v-1', 'not a date', [{ code: 'heartRateBpm', value: 90, unit: 'beats/min' }], null),
      ],
      truncated: false,
    });

    render(<VitalsHistoryPanel companionId="patient-1" />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
    expect(screen.getByText('Visit vitals')).toBeInTheDocument();
    expect(screen.queryByText(/Latest weight/)).not.toBeInTheDocument();
  });

  it('says when only the most recent readings are shown', async () => {
    fetchMock.mockResolvedValue({
      entries: [
        visit('v-1', '2026-02-01T09:00:00.000Z', [{ code: 'bcs', value: 5, unit: 'score' }]),
      ],
      truncated: true,
    });

    render(<VitalsHistoryPanel companionId="patient-1" />);

    expect(await screen.findByText('Showing the 1 most recent readings.')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    render(<VitalsHistoryPanel companionId="patient-1" />);
    expect(await screen.findByText('No weight or vitals recorded.')).toBeInTheDocument();
    expect(screen.queryByText(/\d+ recorded/)).not.toBeInTheDocument();
  });

  it('shows an error when the history cannot be loaded', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    render(<VitalsHistoryPanel companionId="patient-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load weight and vitals. Please try again.'
    );
  });

  it('stays quiet when the session is redirecting to sign in', async () => {
    isAuthRedirectMock.mockReturnValue(true);
    fetchMock.mockRejectedValue(new Error('redirect'));
    render(<VitalsHistoryPanel companionId="patient-1" />);
    expect(await screen.findByText('No weight or vitals recorded.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    isAuthRedirectMock.mockReturnValue(false);
  });

  it.each([[['companions:view:any']], [['forms:view:any']]])(
    'renders nothing without both companion and forms access (%p)',
    (perms) => {
      permissionsMock = perms;
      const { container } = render(<VitalsHistoryPanel companionId="patient-1" />);
      expect(container).toBeEmptyDOMElement();
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
});
