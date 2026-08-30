import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PassportClient from '@/app/(routes)/(share)/passport/[id]/PassportClient';
import { getPublicPassport } from '@/app/features/petPassport/services/petPassport.service';
import type { PetPassportDTO } from '@yosemite-crew/types';

jest.mock('@/app/features/petPassport/services/petPassport.service', () => ({
  getPublicPassport: jest.fn(),
}));
jest.mock('@/app/(routes)/(share)/passport/[id]/PublicPassportView', () => ({
  __esModule: true,
  default: ({ passport }: { passport: PetPassportDTO }) => (
    <div data-testid="passport">{passport.identity.name}</div>
  ),
}));

const mockedFetch = getPublicPassport as jest.Mock;

beforeEach(() => jest.clearAllMocks());

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

  it('opens in the theme the reader already chose, not always light', async () => {
    // The page has its own sun/moon toggle, but it used to hardcode 'light' on
    // mount, so a reader whose phone is dark got a full-brightness passport and
    // had to press the button every time. (share)/layout.tsx now resolves the
    // theme onto <html> before paint; this seeds from it.
    document.documentElement.dataset.theme = 'dark';
    try {
      mockedFetch.mockResolvedValue({ identity: { id: 'p1', name: 'Poppy' } });
      render(<PassportClient id="p1" />);
      await screen.findByTestId('passport');
      expect(screen.getByRole('main')).toHaveAttribute('data-wb-theme', 'dark');
    } finally {
      delete document.documentElement.dataset.theme;
    }
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
