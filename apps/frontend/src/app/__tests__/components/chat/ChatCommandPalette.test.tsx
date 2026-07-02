import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { StreamChat, ChannelFilters } from 'stream-chat';
import { ChatCommandPalette } from '@/app/features/chat/components/ChatCommandPalette';

/**
 * ⌘K command palette tests. The Stream client is mocked as a plain object so we
 * can drive queryChannels resolution; @/app/ui, react-icons, and ChatAvatar all
 * render for real per the testing conventions.
 */

type FakeChannel = {
  cid: string;
  id: string;
  data?: { name?: string };
  state?: { members?: Record<string, { user?: { id?: string; name?: string } }> };
};

const channelWithName: FakeChannel = {
  cid: 'messaging:c1',
  id: 'c1',
  data: { name: 'Bella' },
  state: { members: {} },
};

const channelFromMember: FakeChannel = {
  cid: 'messaging:c2',
  id: 'c2',
  // no data.name -> titleOf falls back to the other member's name
  state: { members: { m1: { user: { id: 'other', name: 'Tim' } } } },
};

function makeClient(channels: FakeChannel[] = [channelWithName, channelFromMember]) {
  return {
    userID: 'me',
    queryChannels: jest.fn().mockResolvedValue(channels),
  } as unknown as StreamChat & { queryChannels: jest.Mock };
}

const filters = { type: 'messaging' } as ChannelFilters;

async function openPalette() {
  await act(async () => {
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
  });
}

describe('ChatCommandPalette', () => {
  it('is closed initially (renders nothing)', () => {
    const client = makeClient();
    const { container } = render(
      <ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on Cmd+K and lists channels from the query', async () => {
    const client = makeClient();
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await openPalette();

    expect(screen.getByRole('dialog', { name: 'Jump to conversation' })).toBeInTheDocument();
    expect(client.queryChannels as jest.Mock).toHaveBeenCalledWith(
      filters,
      { last_message_at: -1 },
      { limit: 30 }
    );

    await waitFor(() => expect(screen.getByText('Bella')).toBeInTheDocument());
    // member fallback title for the channel without data.name
    expect(screen.getByText('Tim')).toBeInTheDocument();
  });

  it('opens on Ctrl+K as well', async () => {
    const client = makeClient();
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    });

    expect(screen.getByRole('dialog', { name: 'Jump to conversation' })).toBeInTheDocument();
  });

  it('filters results by title as the user types', async () => {
    const client = makeClient();
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await openPalette();
    await waitFor(() => expect(screen.getByText('Bella')).toBeInTheDocument());

    const input = screen.getByLabelText('Search conversations');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'tim' } });
    });

    expect(screen.queryByText('Bella')).not.toBeInTheDocument();
    expect(screen.getByText('Tim')).toBeInTheDocument();
  });

  it('pressing Enter jumps to the first result', async () => {
    const onJump = jest.fn();
    const client = makeClient();
    render(<ChatCommandPalette client={client} filters={filters} onJump={onJump} />);

    await openPalette();
    await waitFor(() => expect(screen.getByText('Bella')).toBeInTheDocument());

    const input = screen.getByLabelText('Search conversations');
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(onJump).toHaveBeenCalledWith('c1');
    // jumping closes the palette
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Jump to conversation' })).not.toBeInTheDocument()
    );
  });

  it('clicking a result row jumps to that channel id and closes', async () => {
    const onJump = jest.fn();
    const client = makeClient();
    render(<ChatCommandPalette client={client} filters={filters} onJump={onJump} />);

    await openPalette();
    await waitFor(() => expect(screen.getByText('Tim')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Tim'));
    });

    expect(onJump).toHaveBeenCalledWith('c2');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Jump to conversation' })).not.toBeInTheDocument()
    );
  });

  it('closes on Escape', async () => {
    const client = makeClient();
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await openPalette();
    expect(screen.getByRole('dialog', { name: 'Jump to conversation' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog', { name: 'Jump to conversation' })).not.toBeInTheDocument();
  });

  it('closes when the backdrop is clicked', async () => {
    const client = makeClient();
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await openPalette();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close palette' }));
    });

    expect(screen.queryByRole('dialog', { name: 'Jump to conversation' })).not.toBeInTheDocument();
  });

  it('shows "No conversations found" when the query returns []', async () => {
    const client = makeClient([]);
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await openPalette();

    await waitFor(() => expect(screen.getByText('No conversations found')).toBeInTheDocument());
  });

  it('shows "No conversations found" when a query rejects', async () => {
    const client = {
      userID: 'me',
      queryChannels: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as StreamChat;
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await openPalette();

    await waitFor(() => expect(screen.getByText('No conversations found')).toBeInTheDocument());
  });

  it('toggles closed again on a second Cmd+K', async () => {
    const client = makeClient();
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await openPalette();
    expect(screen.getByRole('dialog', { name: 'Jump to conversation' })).toBeInTheDocument();

    await openPalette();
    expect(screen.queryByRole('dialog', { name: 'Jump to conversation' })).not.toBeInTheDocument();
  });

  it('falls back to member id then "Conversation" when no name is present', async () => {
    const noNameChannel: FakeChannel = {
      cid: 'messaging:c3',
      id: 'c3',
      state: { members: { m1: { user: { id: 'just-id' } } } },
    };
    // no state at all -> exercises the `channel.state?.members ?? {}` fallback
    const noStateChannel: FakeChannel = {
      cid: 'messaging:c4',
      id: 'c4',
    };
    const client = makeClient([noNameChannel, noStateChannel]);
    render(<ChatCommandPalette client={client} filters={filters} onJump={jest.fn()} />);

    await openPalette();

    await waitFor(() => expect(screen.getByText('just-id')).toBeInTheDocument());
    expect(screen.getByText('Conversation')).toBeInTheDocument();
  });
});
