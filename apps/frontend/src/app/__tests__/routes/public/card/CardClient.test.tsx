import { render, screen } from '@testing-library/react';
import CardClient from '@/app/(routes)/(public)/card/[token]/CardClient';
import { getPublicCompanionCard } from '@/app/features/companionCard/services/companionCard.service';
import type { CompanionCardDTO } from '@yosemite-crew/types';

jest.mock('@/app/features/companionCard/services/companionCard.service', () => ({
  getPublicCompanionCard: jest.fn(),
}));
jest.mock('@/app/ui/cards/CompanionIdCard/CompanionIdCard', () => ({
  __esModule: true,
  default: ({ card }: { card: CompanionCardDTO }) => (
    <div data-testid="id-card">{card.identity.name}</div>
  ),
}));

const mockedFetch = getPublicCompanionCard as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('CardClient (public companion card page)', () => {
  it('renders the redacted card on success', async () => {
    mockedFetch.mockResolvedValue({
      audience: 'PUBLIC',
      identity: { id: 'p1', name: 'Doggy', type: 'dog', breed: 'Rottweiler' },
    });
    render(<CardClient token="tok" />);
    expect(await screen.findByTestId('id-card')).toHaveTextContent('Doggy');
    expect(mockedFetch).toHaveBeenCalledWith('tok');
  });

  it('shows the unavailable state when the token cannot be resolved', async () => {
    mockedFetch.mockRejectedValue(new Error('Card not found.'));
    render(<CardClient token="bad" />);
    expect(await screen.findByText('This card is no longer available.')).toBeInTheDocument();
  });

  it('shows a loading state while resolving', () => {
    mockedFetch.mockReturnValue(new Promise(() => {}));
    render(<CardClient token="tok" />);
    expect(screen.getByText('Loading companion card...')).toBeInTheDocument();
  });
});
