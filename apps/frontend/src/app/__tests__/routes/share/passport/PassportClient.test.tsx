import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PassportClient from '@/app/(routes)/(share)/passport/[id]/PassportClient';
import { useTheme } from '@/app/ui/theme';
import { getPublicPassport } from '@/app/features/petPassport/services/petPassport.service';
import type { PetPassportDTO } from '@yosemite-crew/types';

jest.mock('@/app/features/petPassport/services/petPassport.service', () => ({
  getPublicPassport: jest.fn(),
}));
jest.mock('@/app/ui/theme', () => ({ useTheme: jest.fn() }));
jest.mock('@/app/(routes)/(share)/passport/[id]/PublicPassportView', () => ({
  __esModule: true,
  default: ({ passport }: { passport: PetPassportDTO }) => (
    <div data-testid="passport">{passport.identity.name}</div>
  ),
}));

const mockedFetch = getPublicPassport as jest.Mock;
const mockedUseTheme = useTheme as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseTheme.mockReturnValue({ theme: 'light' });
});

describe('PassportClient (public pet passport page)', () => {
  it('renders the passport on success', async () => {
    mockedFetch.mockResolvedValue({ identity: { id: 'p1', name: 'Poppy' } });
    render(<PassportClient id="p1" />);
    expect(await screen.findByTestId('passport')).toHaveTextContent('Poppy');
    expect(mockedFetch).toHaveBeenCalledWith('p1');
  });

  it('shows an unavailable state on failure', async () => {
    mockedFetch.mockRejectedValue(new Error('404'));
    render(<PassportClient id="p1" />);
    expect(await screen.findByText('This passport could not be found.')).toBeInTheDocument();
  });

  it('takes the theme from the shared store, not from the DOM', async () => {
    // The contract, and the regression it guards. Reading
    // document.documentElement in a state initialiser makes the server render
    // light (no `document` there) and the client hydrate dark - a mismatch React
    // 19 repairs by discarding the tree. `useTheme` is the repo's
    // useSyncExternalStore wrapper and supplies a server snapshot, so both
    // passes agree.
    //
    // Asserting THROUGH the mocked hook is what gives this test teeth: an
    // implementation that reads the DOM instead would ignore the mock and keep
    // rendering light. A renderToString+hydrateRoot test cannot show this in
    // jsdom, where `document` exists during the server pass too, so both passes
    // would agree and the test would pass against the bug.
    mockedUseTheme.mockReturnValue({ theme: 'dark' });
    mockedFetch.mockResolvedValue({ identity: { id: 'p1', name: 'Poppy' } });

    render(<PassportClient id="p1" />);
    await screen.findByTestId('passport');

    expect(screen.getByRole('main')).toHaveAttribute('data-wb-theme', 'dark');
  });

  it('toggles between light and dark warm-bone themes', async () => {
    mockedFetch.mockResolvedValue({ identity: { id: 'p1', name: 'Poppy' } });
    render(<PassportClient id="p1" />);
    const main = document.getElementById('main-content');
    expect(main).toHaveAttribute('data-wb-theme', 'light');

    const toggle = screen.getByRole('button', { name: /toggle light or dark theme/i });
    await userEvent.click(toggle);
    expect(main).toHaveAttribute('data-wb-theme', 'dark');
    await userEvent.click(toggle);
    expect(main).toHaveAttribute('data-wb-theme', 'light');
  });
});
