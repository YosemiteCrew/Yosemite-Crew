import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatMessage } from '@/app/features/chat/components/ChatMessage';
import { useMessageContext, useChannelActionContext } from 'stream-chat-react';

jest.mock('stream-chat-react', () => ({
  useMessageContext: jest.fn(),
  useChannelActionContext: jest.fn(),
  Attachment: () => <div data-testid="attachment" />,
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (s: string) => s,
}));

const mockUseMessageContext = useMessageContext as unknown as jest.Mock;
const mockUseChannelActionContext = useChannelActionContext as unknown as jest.Mock;

type MsgOverrides = {
  message?: Record<string, unknown>;
  isMyMessage?: boolean;
  readBy?: unknown[];
};

const baseMessage = {
  text: 'Hello there',
  user: { id: 'other', name: 'Tim' },
  created_at: new Date('2026-06-25T15:00:00Z'),
  status: 'received',
  reaction_counts: {},
  own_reactions: [],
  attachments: [],
};

const setup = (over: MsgOverrides = {}) => {
  const handleReaction = jest.fn();
  const handleOpenThread = jest.fn();
  const editMessage = jest.fn().mockResolvedValue(undefined);
  const deleteMessage = jest.fn().mockResolvedValue(undefined);
  mockUseMessageContext.mockReturnValue({
    message: { ...baseMessage, ...over.message },
    isMyMessage: () => over.isMyMessage ?? false,
    handleReaction,
    handleOpenThread,
    readBy: over.readBy ?? [],
  });
  mockUseChannelActionContext.mockReturnValue({ editMessage, deleteMessage });
  const utils = render(<ChatMessage />);
  return { handleReaction, handleOpenThread, editMessage, deleteMessage, ...utils };
};

describe('ChatMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders an incoming text message', () => {
    setup();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders the deleted placeholder', () => {
    setup({ message: { deleted_at: new Date() } });
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
  });

  it('renders the deleted placeholder for a deleted-type message', () => {
    setup({ message: { type: 'deleted' } });
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
  });

  it('shows seen status for my message once read', () => {
    setup({ isMyMessage: true, readBy: [{ id: 'x' }] });
    expect(screen.getByLabelText('Seen')).toBeInTheDocument();
  });

  it('shows sent status for my message with no readers', () => {
    setup({ isMyMessage: true, readBy: [] });
    expect(screen.getByLabelText('Sent')).toBeInTheDocument();
  });

  it('shows the sending clock', () => {
    setup({ isMyMessage: true, message: { status: 'sending' } });
    expect(screen.getByLabelText('Sending')).toBeInTheDocument();
  });

  it('renders a reaction chip and toggles it', () => {
    const { handleReaction } = setup({
      message: { reaction_counts: { '👍': 2 }, own_reactions: [{ type: '👍' }] },
    });
    fireEvent.click(screen.getByLabelText('2 👍 reaction'));
    expect(handleReaction).toHaveBeenCalledWith('👍', expect.anything());
  });

  it('opens the reaction picker and adds a reaction', () => {
    const { handleReaction } = setup();
    fireEvent.click(screen.getByLabelText('React'));
    fireEvent.click(screen.getByText('❤️'));
    expect(handleReaction).toHaveBeenCalledWith('❤️', expect.anything());
  });

  it('replies via the thread handler', () => {
    const { handleOpenThread } = setup();
    fireEvent.click(screen.getByLabelText('Reply'));
    expect(handleOpenThread).toHaveBeenCalled();
  });

  it('edits my message', async () => {
    const { editMessage } = setup({ isMyMessage: true });
    fireEvent.click(screen.getByLabelText('More'));
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Edit message'), { target: { value: 'Edited text' } });
    fireEvent.click(screen.getByLabelText('Save edit'));
    await waitFor(() =>
      expect(editMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'Edited text' }))
    );
  });

  it('cancels editing without saving', () => {
    const { editMessage } = setup({ isMyMessage: true });
    fireEvent.click(screen.getByLabelText('More'));
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByLabelText('Cancel edit'));
    expect(editMessage).not.toHaveBeenCalled();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('deletes my message', () => {
    const { deleteMessage } = setup({ isMyMessage: true });
    fireEvent.click(screen.getByLabelText('More'));
    fireEvent.click(screen.getByText('Delete'));
    expect(deleteMessage).toHaveBeenCalled();
  });

  it('does not show the More menu for incoming messages', () => {
    setup({ isMyMessage: false });
    expect(screen.queryByLabelText('More')).not.toBeInTheDocument();
  });

  it('renders a shared-entity card instead of a bubble', () => {
    setup({
      message: {
        text: '',
        sharedEntity: { entityType: 'APPOINTMENT', entityId: 'a1', title: 'Checkup' },
      },
    });
    expect(screen.getByText('Checkup')).toBeInTheDocument();
  });

  it('renders attachments', () => {
    setup({ message: { text: '', attachments: [{ type: 'image', image_url: 'x' }] } });
    expect(screen.getByTestId('attachment')).toBeInTheDocument();
  });

  it('highlights an @mention', () => {
    setup({ message: { text: 'hey @bella welcome' } });
    expect(screen.getByText('@bella')).toBeInTheDocument();
  });

  it('saves an edit via the Enter key', async () => {
    const { editMessage } = setup({ isMyMessage: true });
    fireEvent.click(screen.getByLabelText('More'));
    fireEvent.click(screen.getByText('Edit'));
    const input = screen.getByLabelText('Edit message');
    fireEvent.change(input, { target: { value: 'Via enter' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(editMessage).toHaveBeenCalledWith(expect.objectContaining({ text: 'Via enter' }))
    );
  });

  it('cancels an edit via the Escape key', () => {
    setup({ isMyMessage: true });
    fireEvent.click(screen.getByLabelText('More'));
    fireEvent.click(screen.getByText('Edit'));
    const input = screen.getByLabelText('Edit message');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByLabelText('Edit message')).not.toBeInTheDocument();
  });

  it('does not edit when the text is unchanged', () => {
    const { editMessage } = setup({ isMyMessage: true });
    fireEvent.click(screen.getByLabelText('More'));
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByLabelText('Save edit'));
    expect(editMessage).not.toHaveBeenCalled();
  });

  it('closes the reaction picker via the backdrop', () => {
    setup();
    fireEvent.click(screen.getByLabelText('React'));
    expect(screen.getByText('❤️')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('❤️')).not.toBeInTheDocument();
  });

  it('closes the more-menu via the backdrop', () => {
    setup({ isMyMessage: true });
    fireEvent.click(screen.getByLabelText('More'));
    expect(screen.getByText('Edit')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('renders my message with a non-owned reaction chip and opens the picker', () => {
    const { handleReaction } = setup({
      isMyMessage: true,
      message: { reaction_counts: { '🎉': 3 }, own_reactions: [] },
    });
    fireEvent.click(screen.getByLabelText('3 🎉 reaction'));
    expect(handleReaction).toHaveBeenCalledWith('🎉', expect.anything());
    fireEvent.click(screen.getByLabelText('React'));
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('renders my deleted message', () => {
    setup({ isMyMessage: true, message: { deleted_at: new Date() } });
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
  });

  it('highlights an @mention in my message', () => {
    setup({ isMyMessage: true, message: { text: 'hi @vet there' } });
    expect(screen.getByText('@vet')).toBeInTheDocument();
  });

  it('falls back to the user id when the sender has no name', () => {
    setup({ message: { user: { id: 'uid-only' } } });
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders with no created_at timestamp', () => {
    setup({ message: { created_at: undefined } });
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('marks a reaction I made on an incoming message and ignores zero counts', () => {
    setup({ message: { reaction_counts: { '👍': 4, '😢': 0 }, own_reactions: [{ type: '👍' }] } });
    expect(screen.getByLabelText('4 👍 reaction')).toBeInTheDocument();
    expect(screen.queryByLabelText('0 😢 reaction')).not.toBeInTheDocument();
  });

  it('renders my message bubble with status when read by no one and undefined readBy', () => {
    setup({ isMyMessage: true, readBy: undefined });
    expect(screen.getByLabelText('Sent')).toBeInTheDocument();
  });
});
