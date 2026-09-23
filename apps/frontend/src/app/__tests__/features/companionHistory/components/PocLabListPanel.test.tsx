import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { isAuthRedirectError } from '@/app/services/axios';
import PocLabListPanel from '@/app/features/companionHistory/components/PocLabListPanel';
import {
  fetchPocLabResults,
  type PointOfCareLabResult,
} from '@/app/features/companionHistory/services/pocLabService';

let permissionsMock = ['appointments:view:any'];

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (permission: string) => permissionsMock.includes(permission) }),
}));

jest.mock('@/app/services/axios', () => ({
  isAuthRedirectError: jest.fn(() => false),
}));

jest.mock('@/app/features/companionHistory/services/pocLabService', () => ({
  fetchPocLabResults: jest.fn(),
}));

const fetchMock = fetchPocLabResults as jest.Mock;
const isAuthRedirectMock = isAuthRedirectError as jest.Mock;

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

beforeEach(() => {
  jest.clearAllMocks();
  permissionsMock = ['appointments:view:any'];
  fetchMock.mockResolvedValue([]);
});

describe('PocLabListPanel', () => {
  it('loads the patient list and expands a result detail', async () => {
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
    expect(await screen.findByText('No in-house lab results recorded.')).toBeInTheDocument();

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

    expect(await screen.findByText('No in-house lab results recorded.')).toBeInTheDocument();
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

  it('renders nothing without view permission or a companion id', async () => {
    permissionsMock = [];
    const { container, rerender } = render(<PocLabListPanel companionId="patient-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();

    permissionsMock = ['appointments:view:any'];
    rerender(<PocLabListPanel companionId="" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
