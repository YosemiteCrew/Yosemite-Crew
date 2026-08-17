import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { PetPassportDTO, VaccinationDTO } from '@yosemite-crew/types';
import PassportStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep';
import { getPetPassport } from '@/app/features/petPassport/services/petPassport.service';
import {
  issuePassport,
  recordClinicalExam,
  recordImmunization,
  recordParasiteTreatment,
  recordRabiesTitration,
} from '@/app/features/petPassport/services/passportRecords.service';

jest.mock('@/app/features/petPassport/services/petPassport.service', () => ({
  getPetPassport: jest.fn(),
}));

// `isValidClinicalDate` is the real backend-mirroring rule the forms validate
// with, so only the write calls are stubbed.
jest.mock('@/app/features/petPassport/services/passportRecords.service', () => ({
  ...jest.requireActual('@/app/features/petPassport/services/passportRecords.service'),
  recordImmunization: jest.fn(),
  recordParasiteTreatment: jest.fn(),
  recordRabiesTitration: jest.fn(),
  recordClinicalExam: jest.fn(),
  issuePassport: jest.fn(),
}));

expect.extend(toHaveNoViolations);

const mockedGetPetPassport = getPetPassport as jest.Mock;
const mockedRecordImmunization = recordImmunization as jest.Mock;
const mockedRecordParasiteTreatment = recordParasiteTreatment as jest.Mock;
const mockedRecordRabiesTitration = recordRabiesTitration as jest.Mock;
const mockedRecordClinicalExam = recordClinicalExam as jest.Mock;
const mockedIssuePassport = issuePassport as jest.Mock;

const COMPANION_ID = 'pat-1';
const ENCOUNTER_ID = 'enc-9';

const signedRabies: VaccinationDTO = {
  id: 'vac-signed',
  patientId: COMPANION_ID,
  vaccineType: 'RABIES',
  vaccineName: 'Nobivac Rabies',
  dateAdministered: '2026-01-04',
  createdAt: '2026-01-04T09:00:00.000Z',
};

const emptyPassport: PetPassportDTO = {
  identity: { id: COMPANION_ID, name: 'Bella', species: 'dog', breed: 'Beagle', sex: 'Female' },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
};

const renderStep = (props: Partial<React.ComponentProps<typeof PassportStep>> = {}) =>
  render(
    <PassportStep
      companionId={COMPANION_ID}
      companionName="Bella"
      encounterId={ENCOUNTER_ID}
      {...props}
    />
  );

/** Settles the passport fetch so the first paint's loading state is gone. */
const renderSettled = async (props: Partial<React.ComponentProps<typeof PassportStep>> = {}) => {
  const result = renderStep(props);
  await waitFor(() =>
    expect(screen.queryByText('Loading passport records...')).not.toBeInTheDocument()
  );
  return result;
};

/** The captured/signed records list, so a row is not confused with a control. */
const recordsList = () => within(screen.getByRole('list'));

const typeInto = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

beforeEach(() => {
  mockedGetPetPassport.mockResolvedValue(emptyPassport);
  mockedRecordImmunization.mockResolvedValue({
    id: 'vac-draft',
    patientId: COMPANION_ID,
    vaccineType: 'RABIES',
    vaccineName: 'Nobivac Rabies',
    dateAdministered: '2026-02-14',
    createdAt: '2026-02-14T09:00:00.000Z',
  });
});

describe('PassportStep records', () => {
  it('shows the loading state, then lists the passport records as signed', async () => {
    mockedGetPetPassport.mockResolvedValue({ ...emptyPassport, vaccinations: [signedRabies] });
    renderStep();

    expect(screen.getByText('Loading passport records...')).toBeInTheDocument();

    const row = (await screen.findByText('Nobivac Rabies')).closest('li');
    expect(within(row as HTMLElement).getByText('Signed')).toBeInTheDocument();
    expect(mockedGetPetPassport).toHaveBeenCalledWith(COMPANION_ID);
  });

  it('has no axe accessibility violations', async () => {
    const { container } = renderStep();
    await waitFor(() =>
      expect(screen.queryByText('Loading passport records...')).not.toBeInTheDocument()
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('explains that a companion with no records has none yet', async () => {
    await renderSettled();
    expect(screen.getByText('No passport records for this companion yet.')).toBeInTheDocument();
  });

  it('captures a vaccination against the appointment encounter and lists it as a draft', async () => {
    await renderSettled();

    typeInto('Vaccine name', 'Nobivac Rabies');
    typeInto('Date administered', '2026-02-14');
    typeInto('Batch number', 'B-77');
    await click('Save vaccination');

    expect(mockedRecordImmunization).toHaveBeenCalledWith(
      COMPANION_ID,
      ENCOUNTER_ID,
      expect.objectContaining({
        vaccineType: 'RABIES',
        vaccineName: 'Nobivac Rabies',
        dateAdministered: '2026-02-14',
        batchNumber: 'B-77',
      })
    );
    const row = (await screen.findByText('Nobivac Rabies')).closest('li');
    expect(within(row as HTMLElement).getByText('Draft')).toBeInTheDocument();
    // The saved draft clears the form so the next dose starts clean.
    expect(screen.getByLabelText('Vaccine name')).toHaveValue('');
  });

  it('sends the chosen vaccine type and the free-text notes', async () => {
    await renderSettled();

    await click('Non-core');
    typeInto('Vaccine name', 'Bordetella');
    typeInto('Date administered', '2026-02-14');
    typeInto('Notes', 'Intranasal, tolerated well');
    await click('Save vaccination');

    expect(mockedRecordImmunization).toHaveBeenCalledWith(
      COMPANION_ID,
      ENCOUNTER_ID,
      expect.objectContaining({
        vaccineType: 'NON_CORE',
        notes: 'Intranasal, tolerated well',
      })
    );
  });

  it('refuses to post a vaccination without the required fields', async () => {
    await renderSettled();

    await click('Save vaccination');

    expect(screen.getByText('Vaccine name is required.')).toBeInTheDocument();
    expect(screen.getByText('Date administered is required.')).toBeInTheDocument();
    expect(mockedRecordImmunization).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as the clinician corrects the field', async () => {
    await renderSettled();

    await click('Save vaccination');
    expect(screen.getByText('Vaccine name is required.')).toBeInTheDocument();

    typeInto('Vaccine name', 'Nobivac Rabies');
    expect(screen.queryByText('Vaccine name is required.')).not.toBeInTheDocument();
  });

  it("surfaces the server's own rejection message", async () => {
    mockedRecordImmunization.mockRejectedValue({
      response: { data: { message: 'Invalid request body' } },
    });
    await renderSettled();

    typeInto('Vaccine name', 'Nobivac Rabies');
    typeInto('Date administered', '2026-02-14');
    await click('Save vaccination');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid request body');
  });

  it('creates the encounter on demand when the appointment has none', async () => {
    const ensureEncounterId = jest.fn().mockResolvedValue('enc-created');
    await renderSettled({ encounterId: undefined, ensureEncounterId });

    typeInto('Vaccine name', 'Nobivac Rabies');
    typeInto('Date administered', '2026-02-14');
    await click('Save vaccination');

    expect(ensureEncounterId).toHaveBeenCalled();
    expect(mockedRecordImmunization).toHaveBeenCalledWith(
      COMPANION_ID,
      'enc-created',
      expect.anything()
    );
  });

  it('explains why a record cannot be saved without an encounter', async () => {
    await renderSettled({ encounterId: undefined });

    typeInto('Vaccine name', 'Nobivac Rabies');
    typeInto('Date administered', '2026-02-14');
    await click('Save vaccination');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This appointment does not have an encounter yet.'
    );
    expect(mockedRecordImmunization).not.toHaveBeenCalled();
  });

  it('captures a rabies titration and rejects a negative titre first', async () => {
    mockedRecordRabiesTitration.mockResolvedValue({
      id: 'tit-draft',
      patientId: COMPANION_ID,
      approvedLab: 'EU Reference Lab',
      sampleDate: '2026-03-01',
      resultIuMl: 0.7,
      createdAt: '2026-03-02T09:00:00.000Z',
    });
    await renderSettled();

    await click('Rabies titration');
    typeInto('Approved laboratory', 'EU Reference Lab');
    typeInto('Sample date', '2026-03-01');
    typeInto('Result (IU/ml)', '-1');
    await click('Save titration');

    expect(screen.getByText('Result must be 0 or more.')).toBeInTheDocument();
    expect(mockedRecordRabiesTitration).not.toHaveBeenCalled();

    typeInto('Result (IU/ml)', '0.7');
    await click('Save titration');

    expect(mockedRecordRabiesTitration).toHaveBeenCalledWith(COMPANION_ID, ENCOUNTER_ID, {
      approvedLab: 'EU Reference Lab',
      sampleDate: '2026-03-01',
      resultIuMl: 0.7,
      reportUrl: undefined,
    });
    expect(await screen.findByText('0.7 IU/ml')).toBeInTheDocument();
  });

  it('sends a parasite treatment time as a full ISO instant', async () => {
    mockedRecordParasiteTreatment.mockResolvedValue({
      id: 'trt-draft',
      patientId: COMPANION_ID,
      treatmentType: 'ECHINOCOCCUS',
      productName: 'Milbemax',
      treatedAt: '2026-02-14T09:30:00.000Z',
      createdAt: '2026-02-14T09:30:00.000Z',
    });
    await renderSettled();

    await click('Parasite treatment');
    typeInto('Product name', 'Milbemax');
    typeInto('Treated at', '2026-02-14T09:30');
    await click('Save treatment');

    expect(mockedRecordParasiteTreatment).toHaveBeenCalledWith(
      COMPANION_ID,
      ENCOUNTER_ID,
      expect.objectContaining({
        treatmentType: 'ECHINOCOCCUS',
        productName: 'Milbemax',
        treatedAt: new Date('2026-02-14T09:30').toISOString(),
      })
    );
    expect(await screen.findByText('Milbemax')).toBeInTheDocument();
  });

  it('requires the treatment product and keeps the chosen treatment type', async () => {
    mockedRecordParasiteTreatment.mockResolvedValue({
      id: 'trt-tick',
      patientId: COMPANION_ID,
      treatmentType: 'TICK',
      productName: 'Bravecto',
      treatedAt: '2026-02-14T09:30:00.000Z',
      createdAt: '2026-02-14T09:30:00.000Z',
    });
    await renderSettled();

    await click('Parasite treatment');
    await click('Tick');
    await click('Save treatment');

    expect(screen.getByText('Product name is required.')).toBeInTheDocument();
    expect(screen.getByText('Treated at is required.')).toBeInTheDocument();
    expect(mockedRecordParasiteTreatment).not.toHaveBeenCalled();

    typeInto('Product name', 'Bravecto');
    typeInto('Treated at', '2026-02-14T09:30');
    typeInto('Notes', 'Spot-on applied');
    await click('Save treatment');

    expect(mockedRecordParasiteTreatment).toHaveBeenCalledWith(
      COMPANION_ID,
      ENCOUNTER_ID,
      expect.objectContaining({ treatmentType: 'TICK', notes: 'Spot-on applied' })
    );
  });

  it('records a not-fit-for-travel exam decision', async () => {
    mockedRecordClinicalExam.mockResolvedValue({
      id: 'exam-draft',
      patientId: COMPANION_ID,
      examinedAt: '2026-03-05T08:15:00.000Z',
      fitForTravel: false,
      createdAt: '2026-03-05T08:15:00.000Z',
    });
    await renderSettled();

    await click('Clinical exam');
    await click('Not fit for travel');
    typeInto('Examined at', '2026-03-05T08:15');
    typeInto('Weight (kg)', '12.4');
    typeInto('Findings', 'Mild dental tartar');
    await click('Save exam');

    expect(mockedRecordClinicalExam).toHaveBeenCalledWith(
      COMPANION_ID,
      ENCOUNTER_ID,
      expect.objectContaining({
        fitForTravel: false,
        weightKg: 12.4,
        findings: 'Mild dental tartar',
      })
    );
    await waitFor(() => expect(recordsList().getByText('Not fit for travel')).toBeInTheDocument());
    expect(recordsList().getByText('Draft')).toBeInTheDocument();
  });

  it('requires an examination time before posting the exam', async () => {
    await renderSettled();

    await click('Clinical exam');
    await click('Save exam');

    expect(screen.getByText('Examined at is required.')).toBeInTheDocument();
    expect(mockedRecordClinicalExam).not.toHaveBeenCalled();
  });

  it('keeps capture available when the passport cannot be read', async () => {
    mockedGetPetPassport.mockRejectedValue({
      response: { data: { message: 'Passport not found' } },
    });
    await renderSettled();

    expect(screen.getByRole('alert')).toHaveTextContent('Passport not found');
    expect(screen.getByRole('button', { name: 'Save vaccination' })).toBeInTheDocument();
  });

  it('closes capture on a locked visit but still shows the records', async () => {
    mockedGetPetPassport.mockResolvedValue({ ...emptyPassport, vaccinations: [signedRabies] });
    render(
      <PassportStep
        companionId={COMPANION_ID}
        companionName="Bella"
        encounterId={ENCOUNTER_ID}
        readOnly
      />
    );

    expect(await screen.findByText('Nobivac Rabies')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This visit is locked, so no further passport records can be captured against it.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save vaccination' })).not.toBeInTheDocument();
  });
});

describe('PassportStep issuance', () => {
  it('asks first and defaults to not issuing a passport', async () => {
    await renderSettled();

    expect(
      screen.getByText('Are you issuing a pet passport for Bella in this visit?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Passport number')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save vaccination' })).toBeInTheDocument();
  });

  it('reveals the issuance fields only after opting in', async () => {
    await renderSettled();

    await click('Yes');

    expect(screen.getByLabelText('Passport number')).toBeInTheDocument();
    expect(screen.getByLabelText('Issuing authority')).toBeInTheDocument();
  });

  it('refuses to issue without a passport number', async () => {
    await renderSettled();

    await click('Yes');
    await click('Issue passport');

    expect(screen.getByText('Passport number is required.')).toBeInTheDocument();
    expect(mockedIssuePassport).not.toHaveBeenCalled();
  });

  it('issues the passport and then shows it read-only', async () => {
    mockedIssuePassport.mockResolvedValue({
      passportNumber: 'UK-2026-001',
      issuingCountry: 'United Kingdom',
      issueDate: '2026-02-14',
    });
    await renderSettled();

    await click('Yes');
    typeInto('Passport number', 'UK-2026-001');
    typeInto('Issuing country', 'United Kingdom');
    await click('Issue passport');

    expect(mockedIssuePassport).toHaveBeenCalledWith(COMPANION_ID, {
      passportNumber: 'UK-2026-001',
      issuingCountry: 'United Kingdom',
      issuingAuthority: undefined,
      issuingVetName: undefined,
      issuingVetLicense: undefined,
    });
    await waitFor(() => expect(screen.queryByLabelText('Passport number')).not.toBeInTheDocument());
    expect(screen.getByText('Issued')).toBeInTheDocument();
    expect(screen.getByText('UK-2026-001')).toBeInTheDocument();
  });

  it('never offers to issue again for a companion that already holds a passport', async () => {
    mockedGetPetPassport.mockResolvedValue({
      ...emptyPassport,
      passportNumber: 'UK-2025-777',
      issuance: {
        passportNumber: 'UK-2025-777',
        issuingAuthority: 'DEFRA',
        issuingPractice: 'Yosemite Vets',
        issuingVetName: 'Dr Rivera',
        issuingVetLicense: 'RCVS-1234',
        issueDate: '2025-11-02',
      },
    });
    await renderSettled();

    expect(screen.getByText('UK-2025-777')).toBeInTheDocument();
    expect(screen.getByText('DEFRA')).toBeInTheDocument();
    expect(screen.getByText('Dr Rivera')).toBeInTheDocument();
    expect(
      screen.queryByText('Are you issuing a pet passport for Bella in this visit?')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument();
  });

  it('surfaces an issuance failure without hiding the form', async () => {
    mockedIssuePassport.mockRejectedValue(new Error('Passport number already in use'));
    await renderSettled();

    await click('Yes');
    typeInto('Passport number', 'UK-2026-001');
    await click('Issue passport');

    expect(await screen.findByRole('alert')).toHaveTextContent('Passport number already in use');
    expect(screen.getByLabelText('Passport number')).toBeInTheDocument();
  });
});
