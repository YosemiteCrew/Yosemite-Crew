import { render, screen } from '@testing-library/react';
import PublicPassportView from '@/app/(routes)/(share)/passport/[id]/PublicPassportView';
import type { PetPassportDTO, VaccinationDTO } from '@yosemite-crew/types';

const rabiesShot: VaccinationDTO = {
  id: 'vac-rabies',
  patientId: 'pat-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  vaccineType: 'RABIES',
  vaccineName: 'Versiguard Rabies',
  dateAdministered: '2026-06-12',
  validUntil: '2027-06-12',
  administeringVetName: 'Dr. Emma Weber',
  batchNumber: 'VR26-081',
};

const fullPassport: PetPassportDTO = {
  passportNumber: 'DE-AC-00092',
  identity: {
    id: 'pat-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    sex: 'F, spayed',
    dateOfBirth: '2022-05-02',
    colour: 'Tricolour',
    distinguishingMarks: 'White blaze, tan saddle',
  },
  microchip: {
    number: '276098102345678',
    location: 'left neck',
    implantedAt: '2022-06-14',
  },
  rabies: rabiesShot,
  vaccinations: [
    {
      id: 'vac-dhppi',
      patientId: 'pat-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      vaccineType: 'CORE',
      vaccineName: 'Nobivac DHPPi',
      dateAdministered: '2026-03-03',
      nextDueDate: '2027-03-03',
    },
  ],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [
    {
      id: 'exam-1',
      patientId: 'pat-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      examinedAt: '2026-07-02',
      fitForTravel: true,
    },
  ],
  issuance: {
    passportNumber: 'DE-AC-00092',
    issuingPractice: 'Alpenblick Tierklinik',
    issuingVetName: 'Dr. Emma Weber',
    issuingCountry: 'Germany',
    issueDate: '2026-06-12',
  },
};

const minimalPassport: PetPassportDTO = {
  identity: { id: 'pat-2', name: 'Rex', species: 'cat', breed: 'DSH', sex: 'M' },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
};

describe('PublicPassportView', () => {
  // Rabies validity and travel fitness are both evaluated against "now", so the
  // clock is pinned to keep the fixtures' expiry dates meaningful.
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T09:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the full warm-bone passport with every section', () => {
    render(<PublicPassportView passport={fullPassport} />);

    expect(screen.getByText('Poppy')).toBeInTheDocument();
    expect(screen.getByText(/Dog · Beagle · F, spayed · born/)).toBeInTheDocument();
    expect(screen.getByText('Verified record')).toBeInTheDocument();
    expect(screen.getByText(/Rabies valid to/)).toBeInTheDocument();
    expect(screen.getByText(/Fit to travel/)).toBeInTheDocument();
    expect(screen.getByText('DE-AC-00092')).toBeInTheDocument();
    expect(screen.getByText('276098102345678')).toBeInTheDocument();
    expect(screen.getByText(/left neck · implanted/)).toBeInTheDocument();
    expect(screen.getByText('White blaze, tan saddle')).toBeInTheDocument();
    expect(screen.getByText('Versiguard Rabies')).toBeInTheDocument();
    expect(screen.getByText('VALID')).toBeInTheDocument();
    expect(screen.getByText('Nobivac DHPPi')).toBeInTheDocument();
    expect(screen.getByText(/next due/)).toBeInTheDocument();
    expect(screen.getByText('Alpenblick Tierklinik')).toBeInTheDocument();
    expect(screen.getByText(/Issued by Dr. Emma Weber · Germany/)).toBeInTheDocument();
    expect(screen.getByText(/Not a legal substitute/)).toBeInTheDocument();
    expect(screen.getByText('Runs on Yosemite Crew, open source')).toBeInTheDocument();
  });

  it('falls back gracefully when issuance and microchip detail are sparse', () => {
    const partial: PetPassportDTO = {
      passportNumber: 'X-1',
      identity: { id: 'pat-3', name: 'Milo', species: 'horse', breed: 'Arabian', sex: 'M' },
      microchip: { number: '111222333' },
      rabies: {
        id: 'r3',
        patientId: 'pat-3',
        createdAt: '2026-01-01T00:00:00.000Z',
        vaccineType: 'RABIES',
        vaccineName: 'RabVac',
        dateAdministered: '2026-01-01',
      },
      vaccinations: [
        {
          id: 'v3',
          patientId: 'pat-3',
          createdAt: '2026-01-01T00:00:00.000Z',
          vaccineType: 'CORE',
          vaccineName: 'FluVac',
          dateAdministered: '2026-02-01',
        },
      ],
      parasiteTreatments: [],
      rabiesTitrations: [],
      clinicalExams: [],
      issuance: { passportNumber: 'X-1', issueDate: '2026-01-05' },
    };
    render(<PublicPassportView passport={partial} />);

    expect(screen.getByText('Milo')).toBeInTheDocument();
    // No rabies validity + no fit exam -> the status-chip row is not rendered.
    expect(screen.queryByText(/Rabies valid to/)).not.toBeInTheDocument();
    // A rabies shot with no recorded expiry is never advertised as valid.
    expect(screen.queryByText('VALID')).not.toBeInTheDocument();
    expect(screen.getByText('NO EXPIRY')).toBeInTheDocument();
    // Issuance with no practice/vet falls back to the brand name, so "Yosemite
    // Crew" appears twice: the header brand + the practice card fallback.
    expect(screen.getAllByText('Yosemite Crew')).toHaveLength(2);
    // Microchip present but no location/implant -> no sub-line.
    expect(screen.getByText('111222333')).toBeInTheDocument();
    expect(screen.queryByText(/implanted/)).not.toBeInTheDocument();
  });

  it('omits the status chips, vaccination and practice cards when data is absent', () => {
    render(<PublicPassportView passport={minimalPassport} />);

    expect(screen.getByText('Rex')).toBeInTheDocument();
    expect(screen.getByText(/Cat · DSH · M/)).toBeInTheDocument();
    expect(screen.queryByText(/Rabies valid to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fit to travel/)).not.toBeInTheDocument();
    expect(screen.queryByText('Vaccinations')).not.toBeInTheDocument();
    expect(screen.queryByText('Distinguishing marks')).not.toBeInTheDocument();
    // Identity card still renders its heading even with only a name.
    expect(screen.getByText('Identity')).toBeInTheDocument();
  });

  it('marks an expired rabies vaccination as expired rather than valid', () => {
    render(
      <PublicPassportView
        passport={{
          ...fullPassport,
          rabies: { ...rabiesShot, validUntil: '2026-02-01' },
        }}
      />
    );

    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    expect(screen.queryByText('VALID')).not.toBeInTheDocument();
    expect(screen.getByText(/Rabies expired/)).toBeInTheDocument();
    expect(screen.queryByText(/Rabies valid to/)).not.toBeInTheDocument();
  });

  it('treats an unparseable rabies expiry as unknown instead of valid', () => {
    render(
      <PublicPassportView
        passport={{
          ...fullPassport,
          rabies: { ...rabiesShot, validUntil: 'not-a-date' },
        }}
      />
    );

    expect(screen.getByText('NO EXPIRY')).toBeInTheDocument();
    expect(screen.queryByText('VALID')).not.toBeInTheDocument();
    expect(screen.queryByText(/Rabies valid to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rabies expired/)).not.toBeInTheDocument();
  });

  it('suppresses the travel chip when the latest examination is not fit to travel', () => {
    render(
      <PublicPassportView
        passport={{
          ...fullPassport,
          clinicalExams: [
            {
              id: 'exam-old',
              patientId: 'pat-1',
              createdAt: '2024-01-05T00:00:00.000Z',
              examinedAt: '2024-01-05',
              fitForTravel: true,
            },
            {
              id: 'exam-new',
              patientId: 'pat-1',
              createdAt: '2026-07-20T00:00:00.000Z',
              examinedAt: '2026-07-20',
              fitForTravel: false,
            },
          ],
        }}
      />
    );

    expect(screen.queryByText(/Fit to travel/)).not.toBeInTheDocument();
    // The rabies chip still renders, so the chip row itself is present.
    expect(screen.getByText(/Rabies valid to/)).toBeInTheDocument();
  });

  it('dates the travel chip from the latest examination, not the first fit one', () => {
    render(
      <PublicPassportView
        passport={{
          ...fullPassport,
          clinicalExams: [
            {
              id: 'exam-old',
              patientId: 'pat-1',
              createdAt: '2024-01-05T00:00:00.000Z',
              examinedAt: '2024-01-05',
              fitForTravel: true,
            },
            {
              id: 'exam-new',
              patientId: 'pat-1',
              createdAt: '2026-07-20T00:00:00.000Z',
              examinedAt: '2026-07-20',
              fitForTravel: true,
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/Fit to travel · .*2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Fit to travel · .*2024/)).not.toBeInTheDocument();
  });

  it('ignores examinations whose date cannot be read', () => {
    render(
      <PublicPassportView
        passport={{
          ...fullPassport,
          clinicalExams: [
            {
              id: 'exam-undated',
              patientId: 'pat-1',
              createdAt: '2026-07-20T00:00:00.000Z',
              examinedAt: 'not-a-date',
              fitForTravel: true,
            },
          ],
        }}
      />
    );

    expect(screen.queryByText(/Fit to travel/)).not.toBeInTheDocument();
  });
});
