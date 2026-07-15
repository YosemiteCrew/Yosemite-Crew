import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LogoUpdator from '@/app/ui/widgets/UploadImage/LogoUpdator';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import { postData } from '@/app/services/axios';
import axios from 'axios';

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
}));

jest.mock('axios', () => ({
  put: jest.fn(),
}));

jest.mock('react-icons/md', () => ({
  MdArrowRightAlt: () => <span>arrow</span>,
}));

jest.mock('react-icons/io5', () => ({
  IoCamera: () => <span>camera</span>,
}));

describe('LogoUpdator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('falls back when imageUrl is not https', () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl="javascript:alert(1)"
      />
    );

    expect(screen.getAllByAltText('Logo')[0]).toHaveAttribute(
      'src',
      MEDIA_SOURCES.avatars.business
    );
  });

  it('shows validation error when update without file', () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );

    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(screen.getByText('Please choose an image to upload.')).toBeInTheDocument();
  });

  it('shows validation error when non-image file is selected', () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );

    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const badFile = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [badFile] } });

    expect(
      screen.getByText('Please choose a valid image file (PNG, JPG, or WEBP).')
    ).toBeInTheDocument();
    expect(screen.getByText('camera')).toBeInTheDocument();
  });

  it('swaps the image src to the default avatar when the logo image errors', () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );
    const trigger = screen.getAllByAltText('Logo')[0] as HTMLImageElement;
    fireEvent.error(trigger);
    expect(trigger).toHaveAttribute('src', MEDIA_SOURCES.avatars.person);

    fireEvent.click(trigger);
    const modalImage = screen.getAllByAltText('Logo')[1] as HTMLImageElement;
    fireEvent.error(modalImage);
    expect(modalImage).toHaveAttribute('src', MEDIA_SOURCES.avatars.person);
  });

  it('does not open the modal when disabled', () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
        disabled
      />
    );
    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('shows an error when apiUrl is empty', () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl=""
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );
    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(screen.getByText('Profile is not ready yet.')).toBeInTheDocument();
  });

  it('uploads a valid file, calls onSave, and closes the modal on success', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: { uploadUrl: 'https://s3.example.com/upload', s3Key: 'logo/key.png' },
    });
    (axios.put as jest.Mock).mockResolvedValue({});
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={onSave}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );

    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const goodFile = new File(['img'], 'logo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [goodFile] } });

    expect(screen.getByAltText('New Logo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('logo/key.png');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  it('shows the error message when upload fails', async () => {
    (postData as jest.Mock).mockRejectedValue(new Error('network down'));

    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );

    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const goodFile = new File(['img'], 'logo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [goodFile] } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument();
    });
  });

  it('falls back to a generic error message when the rejection has no message', async () => {
    (postData as jest.Mock).mockRejectedValue({});

    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );

    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const goodFile = new File(['img'], 'logo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [goodFile] } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });
  });

  it('replaces an existing preview when a second file is picked, and resets on cancel', () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );

    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const firstFile = new File(['a'], 'a.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [firstFile] } });
    expect(screen.getByAltText('New Logo')).toBeInTheDocument();

    const secondFile = new File(['b'], 'b.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [secondFile] } });
    expect(screen.getByAltText('New Logo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('does nothing when the file input change event has no file', () => {
    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={jest.fn()}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );
    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(screen.queryByText('camera')).toBeInTheDocument();
  });

  it('ignores repeat update clicks while an upload is already in progress', async () => {
    let resolveUpload: (() => void) | undefined;
    (postData as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = () => resolve({ data: { uploadUrl: 'url', s3Key: 'key' } });
      })
    );
    (axios.put as jest.Mock).mockResolvedValue({});
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <LogoUpdator
        title="Update Logo"
        apiUrl="/api/logo"
        onSave={onSave}
        imageUrl={MEDIA_SOURCES.avatars.business}
      />
    );

    fireEvent.click(screen.getAllByAltText('Logo')[0]);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'logo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    fireEvent.click(screen.getByRole('button', { name: 'Updating...' }));

    resolveUpload?.();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });
});
