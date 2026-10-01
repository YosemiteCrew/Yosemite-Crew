import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DentalExaminationForm from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/DentalExaminationForm';
import {
  createDentalExamination,
  listDentalExaminations,
  updateDentalExamination,
} from '@/app/features/appointments/services/workspaceClinicalService';

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  createDentalExamination: jest.fn(),
  listDentalExaminations: jest.fn(),
  updateDentalExamination: jest.fn(),
}));

let mockPermissions: string[] = [];
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (perm: string) => mockPermissions.includes(perm) }),
}));

const createExamMock = createDentalExamination as jest.MockedFunction<
  typeof createDentalExamination
>;
const listExamsMock = listDentalExaminations as jest.MockedFunction<typeof listDentalExaminations>;
const updateExamMock = updateDentalExamination as jest.MockedFunction<
  typeof updateDentalExamination
>;

const previousExam = {
  id: 'exam-old',
  organisationId: 'org-1',
  patientId: 'patient-1',
  encounterId: 'enc-old',
  examinedAt: '2026-09-20T10:00:00.000Z',
  overallGrade: 'GRADE_1' as const,
  findings: [{ tooth: '104', condition: 'FRACTURE' as const, notes: 'Chipped crown' }],
  procedures: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions = ['appointments:view:any', 'appointments:edit:any'];
  listExamsMock.mockResolvedValue([]);
});

describe('DentalExaminationForm', () => {
  it('loads earlier findings and saves per-tooth details for a new encounter', async () => {
    listExamsMock.mockResolvedValueOnce([previousExam]);
    createExamMock.mockResolvedValueOnce({
      ...previousExam,
      id: 'exam-new',
      encounterId: 'enc-1',
      examinedAt: '2026-09-27T10:00:00.000Z',
      overallGrade: 'GRADE_2',
      findings: [{ tooth: '104', condition: 'FRACTURE', periodontalDepth: 2.5 }],
    });

    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="dog"
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Previous examination' })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Tooth 104, right maxillary canine, not charted' })
    );
    expect(screen.getByText(/Previous visit: Fracture · Sep 20, 2026/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Overall periodontal grade/), {
      target: { value: 'GRADE_2' },
    });
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'FRACTURE' } });
    fireEvent.change(screen.getByLabelText(/Periodontal depth/), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save examination' }));

    await waitFor(() =>
      expect(createExamMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          patientId: 'patient-1',
          encounterId: 'enc-1',
          overallGrade: 'GRADE_2',
          findings: [{ tooth: '104', condition: 'FRACTURE', periodontalDepth: 2.5 }],
        })
      )
    );
    expect(await screen.findByText('Dental examination saved.')).toBeInTheDocument();
  });

  it('rehydrates and updates the existing examination for the current encounter', async () => {
    const currentExam = {
      ...previousExam,
      encounterId: 'enc-1',
      calculusScore: 2,
      notes: 'Old note',
    };
    listExamsMock.mockResolvedValueOnce([currentExam]);
    updateExamMock.mockResolvedValueOnce({ ...currentExam, overallGrade: 'GRADE_2' });

    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="dog"
      />
    );

    const save = await screen.findByRole('button', { name: 'Update examination' });
    expect(
      screen.getByRole('button', { name: 'Tooth 104, right maxillary canine, fracture recorded' })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Overall periodontal grade/), {
      target: { value: 'GRADE_2' },
    });
    fireEvent.change(
      within(screen.getByRole('region', { name: 'Examination scores' })).getByLabelText(
        'Calculus score'
      ),
      { target: { value: '' } }
    );
    fireEvent.change(screen.getByLabelText('Examination notes'), { target: { value: '' } });
    fireEvent.click(save);

    await waitFor(() =>
      expect(updateExamMock).toHaveBeenCalledWith(
        'org-1',
        'exam-old',
        expect.objectContaining({
          overallGrade: 'GRADE_2',
          findings: currentExam.findings,
          calculusScore: null,
          notes: null,
        })
      )
    );
    expect(createExamMock).not.toHaveBeenCalled();
  });

  it('uses a typed Modified Triadan number for species without a built-in chart', async () => {
    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="horse"
      />
    );

    const input = await screen.findByRole('textbox', { name: 'Tooth number' });
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: '209' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Tooth 209' })).toBeInTheDocument();
    expect(screen.getByText('Left maxillary first molar')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'FRACTURE' } });

    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/quadrant from 1 to 8/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tooth 209' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '104' } });
    expect(input).toHaveAttribute('aria-invalid', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByRole('heading', { name: 'Tooth 104' })).toBeInTheDocument();

    const charted = screen.getByRole('list', { name: 'Charted teeth' });
    fireEvent.click(
      within(charted).getByRole('button', {
        name: 'Tooth 209, left maxillary first molar, fracture recorded',
      })
    );
    expect(screen.getByRole('heading', { name: 'Tooth 209' })).toBeInTheDocument();
    expect(screen.getByLabelText('Condition')).toHaveValue('FRACTURE');
  });

  it('records supplemental scores and notes, and supports a feline deciduous chart', async () => {
    listExamsMock.mockResolvedValueOnce([
      { ...previousExam, examinedAt: new Date('2026-09-20T10:00:00.000Z'), findings: [] },
    ]);
    createExamMock.mockResolvedValueOnce({
      ...previousExam,
      id: 'exam-new',
      encounterId: 'enc-1',
      overallGrade: 'GRADE_2',
      findings: [{ tooth: '501', mobilityGrade: 'GRADE_2', calculus: 1, periodontalDepth: 1 }],
      calculusScore: 2,
      plaqueScore: 1,
      gingivalScore: 3,
      procedures: ['Cleaning', 'Extraction'],
      notes: 'Follow-up in six months',
    });

    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="Felis catus"
      />
    );

    expect(await screen.findByText(/Feline · Modified Triadan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tooth 105,/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deciduous' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Tooth 501, right maxillary deciduous first incisor, not charted',
      })
    );
    fireEvent.change(screen.getByLabelText('Mobility grade'), { target: { value: 'GRADE_2' } });
    const toothEditor = screen.getByRole('region', { name: 'Tooth 501' });
    fireEvent.change(within(toothEditor).getByLabelText('Calculus score'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/Periodontal depth/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Mobility grade'), { target: { value: '' } });
    fireEvent.change(within(toothEditor).getByLabelText('Calculus score'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText(/Periodontal depth/), { target: { value: '' } });
    expect(
      screen.getByRole('button', {
        name: 'Tooth 501, right maxillary deciduous first incisor, not charted',
      })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mobility grade'), { target: { value: 'GRADE_2' } });
    fireEvent.change(within(toothEditor).getByLabelText('Calculus score'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText(/Periodontal depth/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Overall periodontal grade/), {
      target: { value: 'GRADE_2' },
    });
    fireEvent.change(
      within(screen.getByRole('region', { name: 'Examination scores' })).getByLabelText(
        'Calculus score'
      ),
      { target: { value: '2' } }
    );
    fireEvent.change(
      within(screen.getByRole('region', { name: 'Examination scores' })).getByLabelText(
        'Plaque score'
      ),
      { target: { value: '1' } }
    );
    fireEvent.change(
      within(screen.getByRole('region', { name: 'Examination scores' })).getByLabelText(
        'Gingival score'
      ),
      { target: { value: '3' } }
    );
    fireEvent.change(screen.getByLabelText('Procedures performed'), {
      target: { value: 'Cleaning, Extraction' },
    });
    fireEvent.change(screen.getByLabelText('Examination notes'), {
      target: { value: 'Follow-up in six months' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save examination' }));

    await waitFor(() =>
      expect(createExamMock).toHaveBeenCalledWith(
        expect.objectContaining({
          findings: [{ tooth: '501', mobilityGrade: 'GRADE_2', calculus: 1, periodontalDepth: 1 }],
          calculusScore: 2,
          plaqueScore: 1,
          gingivalScore: 3,
          procedures: ['Cleaning', 'Extraction'],
          notes: 'Follow-up in six months',
        })
      )
    );
  });

  it('retries when the previous dental record cannot be loaded', async () => {
    listExamsMock.mockRejectedValueOnce(new Error('request failed'));
    render(<DentalExaminationForm organisationId="org-1" patientId="patient-1" species="dog" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load previous dental findings. Please try again.'
    );
    listExamsMock.mockResolvedValueOnce([previousExam]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading previous findings' }));
    expect(
      await screen.findByRole('heading', { name: 'Previous examination' })
    ).toBeInTheDocument();
    expect(listExamsMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the selected tooth draft when saving fails', async () => {
    createExamMock.mockRejectedValueOnce(new Error('request failed'));
    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="dog"
      />
    );

    const grade = await screen.findByLabelText(/Overall periodontal grade/);
    fireEvent.change(grade, { target: { value: 'GRADE_1' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Tooth 204, left maxillary canine, not charted' })
    );
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'GINGIVITIS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save examination' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to save dental findings. Please try again.'
    );
    expect(screen.getByLabelText('Condition')).toHaveValue('GINGIVITIS');
    expect(
      screen.getByRole('button', { name: 'Tooth 204, left maxillary canine, gingivitis recorded' })
    ).toBeInTheDocument();
  });

  it('does not request or save records before a patient is loaded', () => {
    render(<DentalExaminationForm organisationId="org-1" species="dog" />);

    expect(screen.getByText(/once the patient is loaded/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save examination' })).not.toBeInTheDocument();
    expect(listExamsMock).not.toHaveBeenCalled();
  });

  it('shows nothing and loads nothing without permission to view appointments', () => {
    mockPermissions = [];
    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="dog"
      />
    );

    expect(screen.getByText(/do not have permission to view dental/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tooth / })).not.toBeInTheDocument();
    expect(listExamsMock).not.toHaveBeenCalled();
  });

  it('lets a clinician without edit permission review findings but not change them', async () => {
    mockPermissions = ['appointments:view:any'];
    listExamsMock.mockResolvedValueOnce([{ ...previousExam, encounterId: 'enc-1' }]);
    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="dog"
      />
    );

    const tooth = await screen.findByRole('button', {
      name: 'Tooth 104, right maxillary canine, fracture recorded',
    });
    await waitFor(() => expect(tooth).toBeEnabled());
    fireEvent.click(tooth);
    expect(screen.getByLabelText('Condition')).toHaveValue('FRACTURE');
    expect(screen.getByLabelText('Condition')).toBeDisabled();
    expect(screen.getByLabelText(/Overall periodontal grade/)).toBeDisabled();
    expect(screen.getByText(/permission to edit appointments/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /examination$/ })).not.toBeInTheDocument();
  });

  it('keeps the form read-only until the visit is open', async () => {
    render(<DentalExaminationForm organisationId="org-1" patientId="patient-1" species="dog" />);

    expect(await screen.findByText(/once the visit is open/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Tooth 104, right maxillary canine, not charted' })
      ).toBeEnabled()
    );
    expect(screen.getByLabelText(/Overall periodontal grade/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save examination' })).toBeDisabled();
  });

  it('blocks saving while earlier findings failed to load, so no second examination is created', async () => {
    listExamsMock.mockRejectedValueOnce(new Error('request failed'));
    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="dog"
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load');
    expect(screen.getByLabelText(/Overall periodontal grade/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save examination' })).toBeDisabled();
  });

  it('compares against the examination before this visit, not a later one', async () => {
    listExamsMock.mockResolvedValueOnce([
      {
        ...previousExam,
        id: 'exam-later',
        encounterId: 'enc-later',
        examinedAt: '2026-10-01T10:00:00.000Z',
        findings: [{ tooth: '104', condition: 'EXTRACTED' as const }],
      },
      {
        ...previousExam,
        id: 'exam-current',
        encounterId: 'enc-1',
        examinedAt: '2026-09-25T10:00:00.000Z',
        findings: [],
      },
      previousExam,
    ]);
    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="dog"
      />
    );

    const summary = await screen.findByRole('region', { name: 'Previous examination' });
    expect(summary).toHaveTextContent('Sep 20, 2026');
    expect(summary).toHaveTextContent('104: Fracture');
    expect(summary).toHaveTextContent('1 tooth charted');
    expect(screen.getByRole('button', { name: 'Update examination' })).toBeInTheDocument();
  });

  it('drops a negative periodontal depth instead of sending it', async () => {
    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="dog"
      />
    );

    const tooth = await screen.findByRole('button', {
      name: 'Tooth 104, right maxillary canine, not charted',
    });
    await waitFor(() => expect(tooth).toBeEnabled());
    fireEvent.click(tooth);
    fireEvent.change(screen.getByLabelText(/Periodontal depth/), { target: { value: '-2' } });
    expect(
      screen.getByRole('button', { name: 'Tooth 104, right maxillary canine, not charted' })
    ).toBeInTheDocument();
  });
});
