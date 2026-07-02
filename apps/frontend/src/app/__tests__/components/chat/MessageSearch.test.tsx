import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageSearch } from '@/app/features/chat/components/MessageSearch';
import { useChannelStateContext, useChannelActionContext } from 'stream-chat-react';

jest.mock('stream-chat-react', () => ({
  useChannelStateContext: jest.fn(),
  useChannelActionContext: jest.fn(),
}));

const mockUseChannelStateContext = useChannelStateContext as unknown as jest.Mock;
const mockUseChannelActionContext = useChannelActionContext as unknown as jest.Mock;

describe('MessageSearch', () => {
  const search = jest.fn();
  const jumpToMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChannelStateContext.mockReturnValue({ channel: { search } });
    mockUseChannelActionContext.mockReturnValue({ jumpToMessage });
    search.mockResolvedValue({
      results: [
        { message: { id: 'm1', text: 'Vaccine reminder', user: { id: 'u2', name: 'Bella' } } },
      ],
    });
  });

  const openAndType = (value: string) => {
    fireEvent.click(screen.getByLabelText('Search messages'));
    fireEvent.change(screen.getByLabelText('Search in conversation'), { target: { value } });
  };

  it('opens the search panel from the header icon', () => {
    render(<MessageSearch />);
    expect(screen.queryByLabelText('Search in conversation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Search messages'));
    expect(screen.getByLabelText('Search in conversation')).toBeInTheDocument();
  });

  it('searches the channel and lists matching results', async () => {
    render(<MessageSearch />);
    openAndType('vaccine');
    await waitFor(() => expect(search).toHaveBeenCalledWith('vaccine'));
    expect(await screen.findByText('Vaccine reminder')).toBeInTheDocument();
    expect(screen.getByText('Bella')).toBeInTheDocument();
  });

  it('jumps to a message and closes when a result is clicked', async () => {
    render(<MessageSearch />);
    openAndType('vaccine');
    fireEvent.click(await screen.findByText('Vaccine reminder'));
    expect(jumpToMessage).toHaveBeenCalledWith('m1');
    expect(screen.queryByLabelText('Search in conversation')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no matches', async () => {
    search.mockResolvedValue({ results: [] });
    render(<MessageSearch />);
    openAndType('zzz');
    expect(await screen.findByText('No messages found')).toBeInTheDocument();
  });

  it('clears the query', async () => {
    render(<MessageSearch />);
    openAndType('vaccine');
    const input = screen.getByLabelText('Search in conversation') as HTMLInputElement;
    fireEvent.click(await screen.findByLabelText('Clear search'));
    expect(input.value).toBe('');
  });

  it('handles a search error gracefully', async () => {
    search.mockRejectedValue(new Error('boom'));
    render(<MessageSearch />);
    openAndType('x');
    expect(await screen.findByText('No messages found')).toBeInTheDocument();
  });

  it('closes via the backdrop', () => {
    render(<MessageSearch />);
    fireEvent.click(screen.getByLabelText('Search messages'));
    fireEvent.click(screen.getByLabelText('Close search'));
    expect(screen.queryByLabelText('Search in conversation')).not.toBeInTheDocument();
  });

  it('renders attachment fallback text for image-only results', async () => {
    search.mockResolvedValue({
      results: [{ message: { id: 'm2', user: { id: 'u3' } } }],
    });
    render(<MessageSearch />);
    openAndType('photo');
    expect(await screen.findByText('Attachment')).toBeInTheDocument();
    expect(screen.getByText('u3')).toBeInTheDocument();
  });
});
