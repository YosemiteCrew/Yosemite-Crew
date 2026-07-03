import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NetworkDirectoryModal } from '@/app/features/chat/components/NetworkDirectoryModal';
import {
  searchNetworkColleagues,
  createNetworkDirectChat,
} from '@/app/features/chat/services/chatService';

/**
 * Cross-clinic colleague directory tests. The two network chatService calls are
 * mocked so we can drive resolve/reject; @/app/ui, react-icons, and ChatAvatar
 * render for real per the testing conventions. The search is debounced 300ms;
 * findBy and waitFor poll past that delay (real timers), like MessageSearch.
 */

jest.mock('@/app/features/chat/services/chatService', () => ({
  searchNetworkColleagues: jest.fn(),
  createNetworkDirectChat: jest.fn(),
}));

const mockedSearch = searchNetworkColleagues as jest.Mock;
const mockedCreate = createNetworkDirectChat as jest.Mock;

const COLLEAGUE = {
  userId: 'u2',
  name: 'Dr. Rivera',
  role: 'Veterinarian',
  organisationId: 'org-2',
  organisationName: 'Riverside Vets',
};

beforeEach(() => {
  mockedSearch.mockReset();
  mockedCreate.mockReset();
  mockedSearch.mockResolvedValue([COLLEAGUE]);
  mockedCreate.mockResolvedValue({ channelId: 'channel-9' });
});

const typeQuery = (value: string) => {
  fireEvent.change(screen.getByLabelText('Search colleagues'), { target: { value } });
};

describe('NetworkDirectoryModal', () => {
  it('renders the title and a prompt before searching', () => {
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={jest.fn()} onStarted={jest.fn()} />
    );

    expect(
      screen.getByRole('dialog', { name: 'Message a colleague at another clinic' })
    ).toBeInTheDocument();
    expect(screen.getByText('Search for a colleague at another clinic')).toBeInTheDocument();
  });

  it('searches colleagues and lists results with the clinic name', async () => {
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={jest.fn()} onStarted={jest.fn()} />
    );

    typeQuery('riv');

    await waitFor(() => expect(mockedSearch).toHaveBeenCalledWith('org-1', 'riv'));
    expect(await screen.findByText('Dr. Rivera')).toBeInTheDocument();
    expect(screen.getByText('Veterinarian · Riverside Vets')).toBeInTheDocument();
  });

  it('starts a chat and calls onStarted(channelId) then onClose', async () => {
    const onStarted = jest.fn();
    const onClose = jest.fn();
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={onClose} onStarted={onStarted} />
    );

    typeQuery('riv');
    fireEvent.click(await screen.findByText('Dr. Rivera'));

    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith({
        organisationId: 'org-1',
        otherUserId: 'u2',
        otherOrganisationId: 'org-2',
      })
    );
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('channel-9'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there are no matches', async () => {
    mockedSearch.mockResolvedValue([]);
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={jest.fn()} onStarted={jest.fn()} />
    );

    typeQuery('zzz');

    expect(await screen.findByText('No colleagues found')).toBeInTheDocument();
  });

  it('surfaces an inline alert and does not close when starting fails', async () => {
    mockedCreate.mockRejectedValueOnce(new Error('nope'));
    const onStarted = jest.fn();
    const onClose = jest.fn();
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={onClose} onStarted={onStarted} />
    );

    typeQuery('riv');
    fireEvent.click(await screen.findByText('Dr. Rivera'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not start the conversation. Please try again.'
    );
    expect(onStarted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // the row is interactive again (label back to "Message")
    await waitFor(() => expect(screen.getByText('Message')).toBeInTheDocument());
  });

  it('handles a search error gracefully (empty list)', async () => {
    mockedSearch.mockRejectedValue(new Error('boom'));
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={jest.fn()} onStarted={jest.fn()} />
    );

    typeQuery('riv');

    expect(await screen.findByText('No colleagues found')).toBeInTheDocument();
  });

  it('clears the query and returns to the prompt', async () => {
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={jest.fn()} onStarted={jest.fn()} />
    );

    typeQuery('riv');
    expect(await screen.findByText('Dr. Rivera')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Search for a colleague at another clinic')).toBeInTheDocument();
  });

  it('closes from the close button', () => {
    const onClose = jest.fn();
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={onClose} onStarted={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the backdrop', () => {
    const onClose = jest.fn();
    render(
      <NetworkDirectoryModal organisationId="org-1" onClose={onClose} onStarted={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close directory' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
