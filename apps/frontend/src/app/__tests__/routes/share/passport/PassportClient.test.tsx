import { render, screen } from '@testing-library/react';
import PassportClient from '@/app/(routes)/(share)/passport/[id]/PassportClient';
import { getPublicPassport } from '@/app/features/petPassport/services/petPassport.service';
import type { PetPassportDTO } from '@yosemite-crew/types';

jest.mock('@/app/features/petPassport/services/petPassport.service', () => ({
  getPublicPassport: jest.fn(),
}));
jest.mock('@/app/ui/cards/PetPassport/PetPassportView', () => ({
  __esModule: true,
  default: ({ passport }: { passport: PetPassportDTO }) => (
    <div data-testid="passport">{passport.identity.name}</div>
  ),
}));

const mockedFetch = getPublicPassport as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('PassportClient (public pet passport page)', () => {
  it('renders the passport on success', async () => {
    mockedFetch.mockResolvedValue({ identity: { id: 'p1', name: 'Doggy' } });
    render(<PassportClient id="p1" />);
    expect(await screen.findByTestId('passport')).toHaveTextContent('Doggy');
    expect(mockedFetch).toHaveBeenCalledWith('p1');
  });

  it('shows an unavailable state on failure', async () => {
    mockedFetch.mockRejectedValue(new Error('404'));
    render(<PassportClient id="p1" />);
    expect(await screen.findByText('This passport could not be found.')).toBeInTheDocument();
  });
});
