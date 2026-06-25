import { render, screen } from '@testing-library/react';
import PetPassportView from '@/app/ui/cards/PetPassport/PetPassportView';
import type { PetPassportDTO } from '@yosemite-crew/types';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} src={props.src} />
  ),
}));
jest.mock('@/app/lib/urls', () => ({
  getSafeImageUrl: () => 'https://img/x.png',
  ImageType: {},
}));
jest.mock('@/app/lib/date', () => ({
  formatDisplayDate: (iso: string) => `D(${iso})`,
}));

const full: PetPassportDTO = {
  identity: {
    id: 'p1',
    name: 'Doggy',
    species: 'dog',
    breed: 'Rottweiler',
    sex: 'male',
    dateOfBirth: '2024-01-10T00:00:00.000Z',
    colour: 'black',
    photoUrl: 'x',
  },
  microchip: {
    number: '985141000123456',
    implantedAt: '2024-02-01T00:00:00.000Z',
    location: 'left neck',
  },
  passportNumber: 'GB-YC-1',
  rabies: {
    id: 'v1',
    patientId: 'p1',
    vaccineType: 'RABIES',
    vaccineName: 'Nobivac Rabies',
    dateAdministered: '2024-04-01T00:00:00.000Z',
    validUntil: '2027-03-14T00:00:00.000Z',
    batchNumber: 'A234B',
    createdAt: '2024-04-02T00:00:00.000Z',
  },
  vaccinations: [
    {
      id: 'v2',
      patientId: 'p1',
      vaccineType: 'CORE',
      vaccineName: 'DHPP',
      dateAdministered: '2024-03-15T00:00:00.000Z',
      createdAt: '2024-03-16T00:00:00.000Z',
    },
  ],
  parasiteTreatments: [
    {
      id: 't1',
      patientId: 'p1',
      treatmentType: 'ECHINOCOCCUS',
      productName: 'Milbemax',
      treatedAt: '2024-06-20T14:00:00.000Z',
      createdAt: '2024-06-20T14:00:00.000Z',
    },
  ],
  rabiesTitrations: [
    {
      id: 's1',
      patientId: 'p1',
      approvedLab: 'EU Lab',
      sampleDate: '2024-05-01T00:00:00.000Z',
      resultIuMl: 0.8,
      createdAt: '2024-05-02T00:00:00.000Z',
    },
  ],
  issuance: {
    passportNumber: 'GB-YC-1',
    issuingVetName: 'Dr A',
    issuingPractice: 'Yosemite Vet Clinic',
    issuingAuthority: 'RCVS',
    issuingCountry: 'GB',
    issueDate: '2024-06-24T00:00:00.000Z',
  },
};

describe('PetPassportView', () => {
  it('renders identity, microchip, rabies and other vaccinations', () => {
    render(<PetPassportView passport={full} />);
    expect(screen.getByText('Doggy')).toBeInTheDocument();
    expect(screen.getByText('Rottweiler / Canine')).toBeInTheDocument();
    expect(screen.getByText('male')).toBeInTheDocument();
    expect(screen.getByText('985141000123456')).toBeInTheDocument();
    expect(screen.getByText('left neck')).toBeInTheDocument();
    expect(screen.getByText('GB-YC-1')).toBeInTheDocument();
    expect(screen.getByText('Nobivac Rabies')).toBeInTheDocument();
    expect(screen.getByText('Valid to D(2027-03-14T00:00:00.000Z)')).toBeInTheDocument();
    expect(screen.getByText('Given D(2024-04-01T00:00:00.000Z) · Batch A234B')).toBeInTheDocument();
    expect(screen.getByText('DHPP')).toBeInTheDocument();
    expect(screen.getByText('Milbemax')).toBeInTheDocument();
    expect(screen.getByText('Tapeworm · D(2024-06-20T14:00:00.000Z)')).toBeInTheDocument();
    expect(screen.getByText('EU Lab')).toBeInTheDocument();
    expect(screen.getByText('0.8 IU/ml · D(2024-05-01T00:00:00.000Z)')).toBeInTheDocument();
    expect(screen.getByText('Dr A')).toBeInTheDocument();
    expect(screen.getByText('Yosemite Vet Clinic')).toBeInTheDocument();
    expect(screen.getByText('RCVS')).toBeInTheDocument();
    expect(screen.getByText(/Not a legal substitute/)).toBeInTheDocument();
  });

  it('omits microchip, rabies and vaccination sections when absent', () => {
    const minimal: PetPassportDTO = {
      identity: { id: 'p', name: 'X', species: 'cat', breed: 'DSH', sex: 'female' },
      vaccinations: [],
      parasiteTreatments: [],
      rabiesTitrations: [],
    };
    render(<PetPassportView passport={minimal} />);
    expect(screen.getByText('DSH / Feline')).toBeInTheDocument();
    expect(screen.queryByText('Identification')).not.toBeInTheDocument();
    expect(screen.queryByText('Rabies vaccination')).not.toBeInTheDocument();
    expect(screen.queryByText('Other vaccinations')).not.toBeInTheDocument();
    expect(screen.queryByText('Parasite treatments')).not.toBeInTheDocument();
    expect(screen.queryByText('Rabies titration')).not.toBeInTheDocument();
  });

  it('falls back to Other for an unmapped species', () => {
    const card: PetPassportDTO = {
      identity: {
        id: 'p',
        name: 'X',
        species: 'ferret' as never,
        breed: 'Y',
        sex: 'unknown',
      },
      vaccinations: [],
      parasiteTreatments: [],
      rabiesTitrations: [],
    };
    render(<PetPassportView passport={card} />);
    expect(screen.getByText('Y / Other')).toBeInTheDocument();
  });
});
