import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DermatologyAssessmentForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/DermatologyAssessmentForm';
import {
  createDermatologyAssessment,
  listDermatologyAssessments,
} from '@/app/features/appointments/services/workspaceClinicalService';

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  createDermatologyAssessment: jest.fn(),
  listDermatologyAssessments: jest.fn(),
}));

const createAssessmentMock = createDermatologyAssessment as jest.MockedFunction<
  typeof createDermatologyAssessment
>;
const listAssessmentsMock = listDermatologyAssessments as jest.MockedFunction<
  typeof listDermatologyAssessments
>;

const previousAssessment = {
  id: 'derm-old',
  patientId: 'patient-1',
  assessedAt: '2026-09-20T10:00:00.000Z',
  affectedRegions: ['Paws', 'Ears'],
  primaryLesions: ['papules'],
  secondaryLesions: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  listAssessmentsMock.mockResolvedValue([]);
});

describe('DermatologyAssessmentForm', () => {
  it('loads and compares previous findings, then saves selected regions and lesions', async () => {
    listAssessmentsMock.mockResolvedValueOnce([previousAssessment]);
    createAssessmentMock.mockResolvedValueOnce({
      ...previousAssessment,
      id: 'derm-new',
      encounterId: 'encounter-1',
      assessedAt: '2026-09-27T10:00:00.000Z',
      affectedRegions: ['Paws'],
    });

    render(
      <DermatologyAssessmentForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="encounter-1"
        assessedBy="vet-1"
      />
    );

    expect(await screen.findByText('Compare with previous visit')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paws' }));
    fireEvent.change(screen.getByLabelText('Primary lesions'), {
      target: { value: ' papules, pustules, , ' },
    });
    fireEvent.change(screen.getByLabelText('Secondary lesions'), {
      target: { value: 'crusts' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save findings' }));

    await waitFor(() =>
      expect(createAssessmentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          patientId: 'patient-1',
          encounterId: 'encounter-1',
          affectedRegions: ['Paws'],
          primaryLesions: ['papules', 'pustules'],
          secondaryLesions: ['crusts'],
        })
      )
    );
    expect(await screen.findByText('Findings saved.')).toBeInTheDocument();
    expect(screen.getByText('Paws, Ears')).toBeInTheDocument();
    const comparison = screen.getByRole('region', { name: 'Compare with previous visit' });
    expect(comparison).toHaveTextContent('Primary lesions: papules');
    expect(comparison).toHaveTextContent('Secondary lesions: Not recorded');
    expect(
      screen.getByText('1 region selected today was also recorded previously.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save findings' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ears' }));
    expect(
      screen.getByText('2 regions selected today were also recorded previously.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save findings' })).toBeEnabled();
    expect(createAssessmentMock).toHaveBeenCalledTimes(1);
  });

  it('describes the dog and cat region checklist by default', async () => {
    render(
      <DermatologyAssessmentForm
        organisationId="org-1"
        patientId="patient-1"
        assessedBy="vet-1"
        species="Cat"
      />
    );
    const regions = await screen.findByRole('group', { name: 'Affected body regions' });
    expect(regions).toHaveAccessibleDescription('Regions for dogs and cats.');
    expect(screen.getByRole('checkbox', { name: 'Paws' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Pasterns and hooves' })).not.toBeInTheDocument();
  });

  it('offers equine regions for horses', async () => {
    render(
      <DermatologyAssessmentForm
        organisationId="org-1"
        patientId="patient-1"
        assessedBy="vet-1"
        species="horse"
      />
    );
    const regions = await screen.findByRole('group', { name: 'Affected body regions' });
    expect(regions).toHaveAccessibleDescription('Regions for horses.');
    expect(screen.getByRole('checkbox', { name: 'Pasterns and hooves' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Neck and mane' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Paws' })).not.toBeInTheDocument();
  });

  it('requires patient and clinician context before recording', () => {
    render(<DermatologyAssessmentForm organisationId="org-1" />);

    expect(screen.getByText(/once the patient and clinician are loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save findings' })).toBeDisabled();
    expect(listAssessmentsMock).not.toHaveBeenCalled();
  });

  it('retries when previous findings fail to load', async () => {
    listAssessmentsMock.mockRejectedValueOnce(new Error('request failed'));
    render(
      <DermatologyAssessmentForm organisationId="org-1" patientId="patient-1" assessedBy="vet-1" />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load previous findings. Please try again.'
    );
    expect(screen.queryByText('Compare with previous visit')).not.toBeInTheDocument();
    listAssessmentsMock.mockResolvedValueOnce([previousAssessment]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading previous findings' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Loading previous findings…')).toBeInTheDocument();
    expect(await screen.findByText('Compare with previous visit')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listAssessmentsMock).toHaveBeenCalledTimes(2);
  });

  it('shows an error and keeps the draft when saving fails', async () => {
    createAssessmentMock.mockRejectedValueOnce(new Error('request failed'));
    render(
      <DermatologyAssessmentForm organisationId="org-1" patientId="patient-1" assessedBy="vet-1" />
    );
    const paws = await screen.findByRole('checkbox', { name: 'Paws' });
    await waitFor(() => expect(paws).toBeEnabled());
    fireEvent.click(paws);
    fireEvent.change(screen.getByLabelText('Primary lesions'), {
      target: { value: 'papules' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save findings' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to save findings. Please try again.'
    );
    expect(screen.getByLabelText('Primary lesions')).toHaveValue('papules');
    expect(screen.getByRole('checkbox', { name: 'Paws' })).toBeChecked();
  });

  it('requires an affected region before saving and allows deselection', async () => {
    render(
      <DermatologyAssessmentForm organisationId="org-1" patientId="patient-1" assessedBy="vet-1" />
    );
    const save = await screen.findByRole('button', { name: 'Save findings' });
    expect(await screen.findByText(/select at least one affected region/i)).toBeInTheDocument();
    const paws = screen.getByRole('checkbox', { name: 'Paws' });
    fireEvent.click(paws);
    expect(save).toBeEnabled();
    fireEvent.click(paws);
    expect(save).toBeDisabled();
  });
});
