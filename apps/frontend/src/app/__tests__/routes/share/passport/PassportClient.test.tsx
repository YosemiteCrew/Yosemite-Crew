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

  it('leaves the theme to the root attribute until the reader overrides it', async () => {
    // Two regressions in one contract.
    //
    // First: the theme comes from `useTheme` - the repo's useSyncExternalStore
    // wrapper, which has a server snapshot - not from reading
    // document.documentElement in a state initialiser. That earlier version
    // rendered light on the server and dark on the client, a mismatch React 19
    // repairs by discarding the tree. Asserting through the mocked hook is what
    // gives this teeth: a DOM-reading implementation ignores the mock.
    //
    // Second: with no local override the attribute is ABSENT, so
    // `.yc-warmbone` follows html[data-theme], which the pre-paint script sets
    // before first paint. Stamping the resolved value here instead would emit
    // data-wb-theme="light" from the server and paint the passport bright until
    // hydration corrected it.
    mockedUseTheme.mockReturnValue({ theme: 'dark' });
    mockedFetch.mockResolvedValue({ identity: { id: 'p1', name: 'Poppy' } });

    render(<PassportClient id="p1" />);
    await screen.findByTestId('passport');

    expect(screen.getByRole('main')).not.toHaveAttribute('data-wb-theme');
  });

  it('stamps the attribute only once the reader uses the toggle', async () => {
    // The override still has to win, including over a dark root - that is the
    // whole point of keeping a per-page control.
    mockedUseTheme.mockReturnValue({ theme: 'dark' });
    mockedFetch.mockResolvedValue({ identity: { id: 'p1', name: 'Poppy' } });

    render(<PassportClient id="p1" />);
    await screen.findByTestId('passport');

    await userEvent.click(screen.getByRole('button', { name: /toggle light or dark theme/i }));
    expect(screen.getByRole('main')).toHaveAttribute('data-wb-theme', 'light');
  });

  it('toggles between light and dark warm-bone themes', async () => {
    mockedFetch.mockResolvedValue({ identity: { id: 'p1', name: 'Poppy' } });
    render(<PassportClient id="p1" />);
    // Awaited, not fired-and-forgotten: the passport fetch resolves into state,
    // and leaving it in flight is a React update outside act(), which
    // jest.setup.ts turns into a thrown error.
    await screen.findByTestId('passport');

    const main = document.getElementById('main-content');
    // Absent, not "light". The attribute now appears only once the reader
    // overrides; until then the surface follows html[data-theme], which is what
    // stops the passport painting bright for a dark reader before hydration.
    expect(main).not.toHaveAttribute('data-wb-theme');

    const toggle = screen.getByRole('button', { name: /toggle light or dark theme/i });
    await userEvent.click(toggle);
    expect(main).toHaveAttribute('data-wb-theme', 'dark');
    await userEvent.click(toggle);
    expect(main).toHaveAttribute('data-wb-theme', 'light');
  });
});
