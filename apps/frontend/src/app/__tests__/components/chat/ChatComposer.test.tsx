import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatComposer } from '@/app/features/chat/components/ChatComposer';

const mockHandleSubmit = jest.fn();
const mockInsertText = jest.fn();
const mockSetText = jest.fn();
const mockUploadFiles = jest.fn();
const mockOpenShare = jest.fn();
let mockCooldown = 0;

jest.mock('stream-chat-react', () => ({
  useMessageInputContext: () => ({
    handleSubmit: mockHandleSubmit,
    cooldownRemaining: mockCooldown,
  }),
  useMessageComposer: () => ({
    textComposer: { insertText: mockInsertText, setText: mockSetText },
    attachmentManager: { uploadFiles: mockUploadFiles },
  }),
  useChannelStateContext: () => ({ channel: { id: 'ch1' } }),
  TextareaComposer: (props: { placeholder?: string }) => (
    <textarea aria-label="composer" placeholder={props.placeholder} />
  ),
  AttachmentPreviewList: () => <div data-testid="previews" />,
}));

jest.mock('@/app/features/chat/components/chatShareContext', () => ({
  useChatShare: () => ({ openShare: mockOpenShare }),
}));

describe('ChatComposer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCooldown = 0;
  });

  it('renders the textarea and send button', () => {
    render(<ChatComposer />);
    expect(screen.getByPlaceholderText('Write a message…')).toBeInTheDocument();
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
  });

  it('sends on the send button', () => {
    render(<ChatComposer />);
    fireEvent.click(screen.getByLabelText('Send message'));
    expect(mockHandleSubmit).toHaveBeenCalled();
  });

  it('disables send during cooldown', () => {
    mockCooldown = 5;
    render(<ChatComposer />);
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('opens the attach menu and shares from PIMS', () => {
    render(<ChatComposer />);
    fireEvent.click(screen.getByLabelText('Add attachment'));
    expect(screen.getByText('Photo')).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Share from PIMS'));
    expect(mockOpenShare).toHaveBeenCalledWith('ch1');
  });

  it('inserts an emoji', () => {
    render(<ChatComposer />);
    fireEvent.click(screen.getByLabelText('Emoji'));
    fireEvent.click(screen.getByText('🎉'));
    expect(mockInsertText).toHaveBeenCalledWith({ text: '🎉' });
  });

  it('fills the composer from a quick-reply chip (replaces, not appends)', () => {
    render(<ChatComposer />);
    fireEvent.click(screen.getByText('Appointment confirmed'));
    expect(mockSetText).toHaveBeenCalledWith('Your appointment is confirmed.');
  });

  it('uploads selected files through the attachment manager', () => {
    const { container } = render(<ChatComposer />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockUploadFiles).toHaveBeenCalled();
  });

  it('triggers the photo and document pickers and closes the menu via the backdrop', () => {
    render(<ChatComposer />);
    fireEvent.click(screen.getByLabelText('Add attachment'));
    fireEvent.click(screen.getByText('Photo'));
    fireEvent.click(screen.getByText('Document'));
    fireEvent.click(screen.getByLabelText('Close menu'));
    expect(screen.queryByText('Photo')).not.toBeInTheDocument();
  });

  it('closes the emoji menu via the backdrop', () => {
    render(<ChatComposer />);
    fireEvent.click(screen.getByLabelText('Emoji'));
    fireEvent.click(screen.getByLabelText('Close menu'));
    expect(screen.queryByText('🎉')).not.toBeInTheDocument();
  });

  it('does nothing on send when there is no channel id', () => {
    render(<ChatComposer />);
    fireEvent.click(screen.getByLabelText('Add attachment'));
    fireEvent.click(screen.getByText('Share from PIMS'));
    expect(mockOpenShare).toHaveBeenCalledWith('ch1');
  });
});
