import { render, screen } from '@testing-library/react';
import WalletPassPreview from '@/app/features/petPassport/components/WalletPassPreview';
import type { PetPassportDTO } from '@yosemite-crew/types';

const future = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

const poppy: PetPassportDTO = {
  passportNumber: 'DE-AC-00092',
  identity: {
    id: 'pat-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    sex: 'F, spayed',
    dateOfBirth: '2022-05-02',
    colour: 'Tricolour',
  },
  microchip: { number: '276098102345678', location: 'left neck', implantedAt: '2022-06-14' },
  rabies: {
    id: 'r',
    patientId: 'pat-1',
    vaccineType: 'RABIES',
    vaccineName: 'Versiguard Rabies',
    dateAdministered: '2026-06-12',
    validUntil: '2027-06-12',
  },
  vaccinations: [
    {
      id: 'v-past',
      patientId: 'pat-1',
      vaccineType: 'CORE',
      vaccineName: 'Old Jab',
      dateAdministered: '2024-01-01',
      nextDueDate: past,
    },
    {
      id: 'v',
      patientId: 'pat-1',
      vaccineType: 'CORE',
      vaccineName: 'Nobivac DHPPi',
      dateAdministered: '2026-03-03',
      nextDueDate: future,
    },
  ],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
  issuance: {
    passportNumber: 'DE-AC-00092',
    issuingPractice: 'Alpenblick Tierklinik',
    issuingVetName: 'Dr. Emma Weber',
    issuingCountry: 'Germany',
    issueDate: '2026-06-12',
  },
};

const minimal: PetPassportDTO = {
  identity: { id: 'pat-2', name: 'Rex', species: 'cat', breed: 'DSH', sex: 'M' },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
};

describe('WalletPassPreview', () => {
  it('renders the Apple pass with the warm-bone field lines', () => {
    render(<WalletPassPreview passport={poppy} variant="apple" />);
    expect(screen.getByText('Pet Passport')).toBeInTheDocument();
    expect(screen.getByText('Poppy')).toBeInTheDocument();
    expect(screen.getByText('Pass details')).toBeInTheDocument();
    expect(screen.getByText(/left neck · implanted/)).toBeInTheDocument();
    expect(screen.getByText(/Versiguard Rabies · given/)).toBeInTheDocument();
    // Soonest FUTURE next-due wins (the past one is ignored).
    expect(screen.getByText(/Surfaces on the Lock Screen/)).toBeInTheDocument();
    expect(
      screen.getByText(/Dr. Emma Weber · Alpenblick Tierklinik · Germany/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Not a legal substitute/)).toBeInTheDocument();
  });

  it('renders the Google pass with the details list', () => {
    render(<WalletPassPreview passport={poppy} variant="google" />);
    expect(screen.getByText('Yosemite Crew')).toBeInTheDocument();
    expect(screen.getByText('Digital Pet Passport')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Passport No.')).toBeInTheDocument();
    expect(screen.getByText('Date of birth')).toBeInTheDocument();
    expect(screen.getByText('Colour')).toBeInTheDocument();
  });

  it('omits absent field lines and the lock-screen note when data is sparse', () => {
    render(<WalletPassPreview passport={minimal} variant="apple" />);
    expect(screen.getByText('Rex')).toBeInTheDocument();
    expect(screen.queryByText(/Surfaces on the Lock Screen/)).not.toBeInTheDocument();
    expect(screen.queryByText('Microchip')).not.toBeInTheDocument();
    // Notice always renders.
    expect(screen.getByText(/Not a legal substitute/)).toBeInTheDocument();
  });

  it('omits absent Google detail fields when data is sparse', () => {
    render(<WalletPassPreview passport={minimal} variant="google" />);
    expect(screen.getByText('Rex')).toBeInTheDocument();
    expect(screen.queryByText('Microchip')).not.toBeInTheDocument();
    expect(screen.queryByText('Rabies vaccination')).not.toBeInTheDocument();
  });
});
