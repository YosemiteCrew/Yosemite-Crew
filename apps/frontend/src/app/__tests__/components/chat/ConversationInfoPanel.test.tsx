import { render, screen, fireEvent } from '@testing-library/react';
import type { Channel as StreamChannel } from 'stream-chat';
import { ConversationInfoPanel } from '@/app/features/chat/components/ConversationInfoPanel';
import {
  deriveConversationAttachments,
  deriveConversationMembers,
  deriveConversationPinned,
} from '@/app/features/chat/components/conversationInfoPanelUtils';

const asChannel = (state: Record<string, unknown>) => ({ state }) as unknown as StreamChannel;

const fullChannel = asChannel({
  members: {
    u1: { user_id: 'u1', role: 'owner', user: { id: 'u1', name: 'Dr. Sarah Weber' } },
    u2: { user_id: 'u2', role: 'member', user: { id: 'u2', name: 'Lena Hartmann' } },
  },
  messages: [
    {
      id: 'm1',
      attachments: [
        { type: 'image' },
        { type: 'video' },
        { type: 'file', title: 'poppy-cytology.pdf', file_size: 184320 },
      ],
    },
    { id: 'm2', attachments: [{ type: 'file', fallback: 'invoice-2043.pdf', file_size: 512 }] },
  ],
  pinnedMessages: [
    { id: 'p1', text: 'Give the drops after a walk' },
    { id: 'p2', text: '   ' },
  ],
});

const baseProps = {
  channel: fullChannel,
  name: 'Lena Hartmann',
  muted: false,
  onClose: jest.fn(),
};

describe('deriveConversationMembers', () => {
  it('labels the channel creator as Owner and leaves other members unlabelled', () => {
    expect(deriveConversationMembers(fullChannel)).toEqual([
      { id: 'u1', name: 'Dr. Sarah Weber', role: 'Owner' },
      { id: 'u2', name: 'Lena Hartmann', role: undefined },
    ]);
  });

  it('falls back to the map key when the member carries no user', () => {
    expect(deriveConversationMembers(asChannel({ members: { u9: {} } }))).toEqual([
      { id: 'u9', name: 'u9', role: undefined },
    ]);
  });

  it('returns an empty list for a null channel', () => {
    expect(deriveConversationMembers(null)).toEqual([]);
  });
});

describe('deriveConversationAttachments', () => {
  it('splits images/videos into media and everything else into files', () => {
    const { media, files } = deriveConversationAttachments(fullChannel);
    expect(media).toEqual([
      { id: 'm1-0', kind: 'image' },
      { id: 'm1-1', kind: 'video' },
    ]);
    expect(files).toEqual([
      { id: 'm1-2', name: 'poppy-cytology.pdf', meta: '180 KB' },
      { id: 'm2-0', name: 'invoice-2043.pdf', meta: '512 B' },
    ]);
  });

  it('formats megabyte sizes and omits missing or bogus ones', () => {
    const { files } = deriveConversationAttachments(
      asChannel({
        messages: [
          {
            id: 'm1',
            attachments: [
              { type: 'file', title: 'scan.tiff', file_size: 3 * 1024 * 1024 },
              { type: 'file', title: 'nosize.pdf' },
              { type: 'file', title: 'bogus.pdf', file_size: -4 },
            ],
          },
        ],
      })
    );
    expect(files).toEqual([
      { id: 'm1-0', name: 'scan.tiff', meta: '3.0 MB' },
      { id: 'm1-1', name: 'nosize.pdf', meta: undefined },
      { id: 'm1-2', name: 'bogus.pdf', meta: undefined },
    ]);
  });

  it('falls back to the message index and a generic name', () => {
    const { files } = deriveConversationAttachments(
      asChannel({ messages: [{ attachments: [{ type: 'file' }] }] })
    );
    expect(files).toEqual([{ id: '0-0', name: 'Attachment', meta: undefined }]);
  });

  it('returns empty lists for a null channel', () => {
    expect(deriveConversationAttachments(null)).toEqual({ media: [], files: [] });
  });
});

describe('deriveConversationPinned', () => {
  it('drops pins without text', () => {
    expect(deriveConversationPinned(fullChannel)).toEqual([
      { id: 'p1', text: 'Give the drops after a walk' },
    ]);
  });

  it('falls back to an index-based key when the pin has no id', () => {
    expect(deriveConversationPinned(asChannel({ pinnedMessages: [{ text: 'hi' }] }))).toEqual([
      { id: 'pinned-0', text: 'hi' },
    ]);
  });

  it('returns an empty list for a null channel', () => {
    expect(deriveConversationPinned(null)).toEqual([]);
  });
});

describe('ConversationInfoPanel', () => {
  it('renders the drawer heading and every derived section', () => {
    render(<ConversationInfoPanel {...baseProps} subtitle="Pet parent · Poppy" />);

    expect(screen.getByRole('complementary', { name: 'Conversation info' })).toBeInTheDocument();
    expect(screen.getByText('Conversation info')).toBeInTheDocument();
    expect(screen.getByText('Pet parent · Poppy')).toBeInTheDocument();
    expect(screen.getByText('Members · 2')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Shared media · 2')).toBeInTheDocument();
    expect(screen.getByText('Files · 2')).toBeInTheDocument();
    expect(screen.getByText('180 KB')).toBeInTheDocument();
    expect(screen.getByText('Pinned · 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Shared image')).toBeInTheDocument();
    expect(screen.getByLabelText('Shared video')).toBeInTheDocument();
  });

  it('omits every section when the channel carries no state', () => {
    render(<ConversationInfoPanel {...baseProps} channel={null} />);

    expect(screen.queryByText(/Members ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shared media ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Files ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pinned ·/)).not.toBeInTheDocument();
  });

  it('renders the client-record link only when a href is supplied', () => {
    const { unmount } = render(<ConversationInfoPanel {...baseProps} />);
    expect(screen.queryByText('View client record')).not.toBeInTheDocument();
    unmount();

    render(<ConversationInfoPanel {...baseProps} clientRecordHref="/companions?c=1" />);
    expect(screen.getByRole('link', { name: /View client record/ })).toHaveAttribute(
      'href',
      '/companions?c=1'
    );
  });

  it('reflects and toggles the mute state', () => {
    const onToggleMute = jest.fn();
    const { unmount } = render(
      <ConversationInfoPanel {...baseProps} onToggleMute={onToggleMute} />
    );
    const toggle = screen.getByRole('switch', { name: 'Mute notifications' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(onToggleMute).toHaveBeenCalledTimes(1);
    unmount();

    render(<ConversationInfoPanel {...baseProps} muted onToggleMute={onToggleMute} />);
    expect(screen.getByRole('switch', { name: 'Mute notifications' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('calls onArchive and onClose from the footer and header', () => {
    const onArchive = jest.fn();
    const onClose = jest.fn();
    render(<ConversationInfoPanel {...baseProps} onArchive={onArchive} onClose={onClose} />);

    fireEvent.click(screen.getByText('Archive conversation'));
    expect(onArchive).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
