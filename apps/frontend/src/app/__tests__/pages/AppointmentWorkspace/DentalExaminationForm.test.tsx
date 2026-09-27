import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DentalExaminationForm, {
  getDentalQuadrants,
} from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/records/DentalExaminationForm';
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
  listExamsMock.mockResolvedValue([]);
});

describe('getDentalQuadrants', () => {
  it('uses the canine and feline permanent-tooth numbering without inventing absent teeth', () => {
    const dog = getDentalQuadrants('Dog', 'PERMANENT');
    const cat = getDentalQuadrants('Felis catus', 'PERMANENT');

    expect(dog.flatMap((quadrant) => quadrant.teeth)).toHaveLength(42);
    expect(cat.flatMap((quadrant) => quadrant.teeth)).toHaveLength(30);
    expect(cat.flatMap((quadrant) => quadrant.teeth)).not.toContain('105');
    expect(cat.flatMap((quadrant) => quadrant.teeth)).not.toContain('406');
  });

  it('uses the species-specific deciduous numbers and leaves other species uncharted', () => {
    expect(
      getDentalQuadrants('cat', 'DECIDUOUS').flatMap((quadrant) => quadrant.teeth)
    ).toHaveLength(26);
    expect(getDentalQuadrants('horse', 'PERMANENT')).toEqual([]);
  });

  it('trims species names and uses the canine deciduous chart', () => {
    expect(
      getDentalQuadrants('  Canis lupus familiaris  ', 'DECIDUOUS').flatMap((q) => q.teeth)
    ).toHaveLength(28);
    expect(getDentalQuadrants('Canine', 'PERMANENT').flatMap((q) => q.teeth)).toHaveLength(42);
    expect(getDentalQuadrants(undefined, 'PERMANENT')).toEqual([]);
  });
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
    fireEvent.click(screen.getByRole('button', { name: 'Tooth 104, not charted' }));
    expect(screen.getByText(/Previous visit: FRACTURE/)).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Tooth 104, finding recorded' })).toBeInTheDocument();
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

  it('uses a manual tooth identifier for species without a built-in chart', async () => {
    render(
      <DentalExaminationForm
        organisationId="org-1"
        patientId="patient-1"
        encounterId="enc-1"
        species="horse"
      />
    );

    await screen.findByRole('textbox', { name: 'Tooth identifier' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Tooth identifier' }), {
      target: { value: '209' },
    });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Tooth identifier' }), {
      key: 'Enter',
    });
    expect(screen.getByRole('heading', { name: 'Tooth 209' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Tooth identifier' }), {
      target: { value: '104' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByRole('heading', { name: 'Tooth 104' })).toBeInTheDocument();
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
    expect(
      screen.queryByRole('button', { name: 'Tooth 105, not charted' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deciduous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tooth 501, not charted' }));
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
    expect(screen.getByRole('button', { name: 'Tooth 501, not charted' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Tooth 204, not charted' }));
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'GINGIVITIS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save examination' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to save dental findings. Please try again.'
    );
    expect(screen.getByLabelText('Condition')).toHaveValue('GINGIVITIS');
    expect(screen.getByRole('button', { name: 'Tooth 204, finding recorded' })).toBeInTheDocument();
  });

  it('does not request or save records before a patient is loaded', () => {
    render(<DentalExaminationForm organisationId="org-1" species="dog" />);

    expect(screen.getByText(/once the patient is loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save examination' })).toBeDisabled();
    expect(listExamsMock).not.toHaveBeenCalled();
  });
});
