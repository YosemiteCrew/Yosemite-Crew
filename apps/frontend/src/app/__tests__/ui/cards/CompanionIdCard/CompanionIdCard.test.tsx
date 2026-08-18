import { render, screen } from '@testing-library/react';
import CompanionIdCard from '@/app/ui/cards/CompanionIdCard/CompanionIdCard';
import type { CompanionCardDTO } from '@yosemite-crew/types';

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
  formatDisplayDate: (iso: string) => `formatted:${iso}`,
}));

const fullCard: CompanionCardDTO = {
  audience: 'STAFF',
  identity: {
    id: 'p1',
    name: 'Doggy',
    type: 'dog',
    breed: 'Rottweiler',
    colour: 'black',
    photoUrl: 'x',
    microchipNumber: '1234',
  },
  passportNumber: '5678',
  dateOfBirth: '2024-01-10T00:00:00.000Z',
  alerts: [
    { title: 'Needs muzzle', severity: 'high' },
    { title: 'Calm', severity: 'low' },
  ],
  medical: {
    allergy: 'pollen',
    bloodGroup: 'DEA 1.1 Positive',
    currentWeight: 15,
    isNeutered: true,
  },
  insurance: { isInsured: true, companyName: 'PetCo' },
  latestVisit: { status: 'fulfilled' },
  ownerContact: {
    firstName: 'Harshit',
    lastName: 'Wandhare',
    phoneNumber: '+91',
    email: 'h@x.com',
  },
};

describe('CompanionIdCard', () => {
  it('renders the full staff card', () => {
    render(<CompanionIdCard card={fullCard} />);
    expect(screen.getByText('Doggy')).toBeInTheDocument();
    expect(screen.getByText('Rottweiler / Canine')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('5678')).toBeInTheDocument();
    expect(screen.getByText('formatted:2024-01-10T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText('Needs muzzle')).toBeInTheDocument();
    expect(screen.getByText('PetCo')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('Harshit Wandhare')).toBeInTheDocument();
    expect(screen.getByText('h@x.com')).toBeInTheDocument();
    expect(screen.getByText('fulfilled')).toBeInTheDocument();
  });

  it('renders a redacted public card without the hidden rows', () => {
    const publicCard: CompanionCardDTO = {
      audience: 'PUBLIC',
      identity: { id: 'p1', name: 'Doggy', type: 'cat', breed: 'DSH' },
    };
    render(<CompanionIdCard card={publicCard} />);
    expect(screen.getByText('DSH / Feline')).toBeInTheDocument();
    expect(screen.queryByText('Passport')).not.toBeInTheDocument();
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
    expect(screen.queryByText('Insurance')).not.toBeInTheDocument();
  });

  it('shows the not-insured and not-neutered states', () => {
    const card: CompanionCardDTO = {
      audience: 'STAFF',
      identity: { id: 'p', name: 'X', type: 'dog', breed: 'Y' },
      medical: { isNeutered: false },
      insurance: { isInsured: false },
    };
    render(<CompanionIdCard card={card} />);
    expect(screen.getByText('Not insured')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('falls back to Other species and Insured without a named company', () => {
    const card: CompanionCardDTO = {
      audience: 'STAFF',
      identity: { id: 'p', name: 'X', type: 'other', breed: 'Y' },
      insurance: { isInsured: true },
    };
    render(<CompanionIdCard card={card} />);
    expect(screen.getByText('Y / Other')).toBeInTheDocument();
    expect(screen.getByText('Insured')).toBeInTheDocument();
  });
});
