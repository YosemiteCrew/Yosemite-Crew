import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PetPassportModal from '@/app/features/petPassport/components/PetPassportModal';
import { getPetPassport } from '@/app/features/petPassport/services/petPassport.service';
import type { PetPassportDTO } from '@yosemite-crew/types';

jest.mock('@/app/features/petPassport/services/petPassport.service', () => ({
  getPetPassport: jest.fn(),
}));
jest.mock('@/app/ui/cards/PetPassport/PetPassportView', () => ({
  __esModule: true,
  default: ({ passport }: { passport: PetPassportDTO }) => (
    <div data-testid="passport">{passport.identity.name}</div>
  ),
}));
jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({
    children,
    showModal,
    setShowModal,
  }: {
    children: React.ReactNode;
    showModal: boolean;
    setShowModal: () => void;
  }) =>
    showModal ? (
      <div data-testid="modal">
        <button type="button" onClick={() => setShowModal()}>
          dismiss
        </button>
        {children}
      </div>
    ) : null,
}));
jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h2>{title}</h2>,
}));
const notifyMock = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({ useNotify: () => ({ notify: notifyMock }) }));

const mockedFetch = getPetPassport as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('PetPassportModal', () => {
  it('does not render or fetch when closed', () => {
    render(
      <PetPassportModal open={false} companionId="p1" companionName="Doggy" onClose={jest.fn()} />
    );
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('renders the passport on success', async () => {
    mockedFetch.mockResolvedValue({ identity: { name: 'Doggy' } });
    render(
      <PetPassportModal open companionId="p1" companionName="Doggy Wandhare" onClose={jest.fn()} />
    );
    expect(screen.getByRole('heading', { name: "Doggy's passport" })).toBeInTheDocument();
    expect(await screen.findByTestId('passport')).toHaveTextContent('Doggy');
    expect(mockedFetch).toHaveBeenCalledWith('p1');
  });

  it('shows an error state and notifies on failure', async () => {
    mockedFetch.mockRejectedValue(new Error('404'));
    render(<PetPassportModal open companionId="p1" companionName="Doggy" onClose={jest.fn()} />);
    expect(await screen.findByText('This passport could not be loaded.')).toBeInTheDocument();
    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Passport unavailable' })
      )
    );
  });

  it('closes via the modal dismiss control', async () => {
    const onClose = jest.fn();
    mockedFetch.mockResolvedValue({ identity: { name: 'Doggy' } });
    render(<PetPassportModal open companionId="p1" companionName="Doggy" onClose={onClose} />);
    await screen.findByTestId('passport');
    fireEvent.click(screen.getByText('dismiss'));
    expect(onClose).toHaveBeenCalled();
  });
});
