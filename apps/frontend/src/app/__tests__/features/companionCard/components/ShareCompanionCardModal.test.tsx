import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareCompanionCardModal from '@/app/features/companionCard/components/ShareCompanionCardModal';
import * as service from '@/app/features/companionCard/services/companionCard.service';
import type { CompanionCardDTO } from '@yosemite-crew/types';

jest.mock('@/app/features/companionCard/services/companionCard.service');
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr">{value}</div>,
}));
jest.mock('@/app/ui/cards/CompanionIdCard/CompanionIdCard', () => ({
  __esModule: true,
  default: ({ card }: { card: CompanionCardDTO }) => (
    <div data-testid="id-card">{card.identity.name}</div>
  ),
}));
jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ children, showModal }: { children: React.ReactNode; showModal: boolean }) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));
jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h2>{title}</h2>,
}));
jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: { text: string; onClick: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
  Secondary: ({ text, onClick }: { text: string; onClick: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
}));
const notifyMock = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({ useNotify: () => ({ notify: notifyMock }) }));

const card: CompanionCardDTO = {
  audience: 'STAFF',
  identity: { id: 'p1', name: 'Doggy', type: 'dog', breed: 'Rottweiler' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (service.listShareTokens as jest.Mock).mockResolvedValue([]);
});

const open = (extra: Record<string, unknown> = {}) =>
  render(
    <ShareCompanionCardModal
      open
      card={card}
      companionId="p1"
      companionName="Doggy Wandhare"
      onClose={jest.fn()}
      {...extra}
    />
  );

describe('ShareCompanionCardModal', () => {
  it('renders the card preview and the create action', async () => {
    open();
    expect(screen.getByRole('heading', { name: "Share Doggy's card" })).toBeInTheDocument();
    expect(screen.getByTestId('id-card')).toHaveTextContent('Doggy');
    expect(screen.getByText('Create shareable card link')).toBeInTheDocument();
    await waitFor(() => expect(service.listShareTokens).toHaveBeenCalledWith('p1'));
  });

  it('issues a token and shows the QR and copy link', async () => {
    const user = userEvent.setup();
    (service.issueShareToken as jest.Mock).mockResolvedValue({
      token: 'raw',
      qrPayload: 'http://host/card/raw',
      share: { id: 's1' },
    });
    open();
    await user.click(screen.getByText('Create shareable card link'));
    expect(service.issueShareToken).toHaveBeenCalledWith('p1', { audience: 'PUBLIC' });
    expect(await screen.findByTestId('qr')).toHaveTextContent('http://host/card/raw');
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('notifies gracefully when issuing fails', async () => {
    const user = userEvent.setup();
    (service.issueShareToken as jest.Mock).mockRejectedValue(new Error('404'));
    open();
    await user.click(screen.getByText('Create shareable card link'));
    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Sharing unavailable' })
      )
    );
  });

  it('lists active links and revokes one', async () => {
    const user = userEvent.setup();
    (service.listShareTokens as jest.Mock).mockResolvedValue([
      { id: 's1', audience: 'PUBLIC', viewCount: 3, revokedAt: null },
      { id: 's2', audience: 'REFERRAL_CLINIC', viewCount: 0, revokedAt: '2026-01-01' },
    ]);
    (service.revokeShareToken as jest.Mock).mockResolvedValue({});
    open();
    expect(await screen.findByText('Public link - 3 views')).toBeInTheDocument();
    await user.click(screen.getByText('Revoke'));
    expect(service.revokeShareToken).toHaveBeenCalledWith('s1');
  });

  it('survives a failing token list and does not fetch when closed', async () => {
    (service.listShareTokens as jest.Mock).mockRejectedValue(new Error('404'));
    const { rerender } = open();
    await waitFor(() => expect(service.listShareTokens).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('id-card')).toBeInTheDocument();
    rerender(
      <ShareCompanionCardModal
        open={false}
        card={card}
        companionId="p1"
        companionName="Doggy"
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });
});
