import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LogoUpdator from '@/app/ui/widgets/UploadImage/LogoUpdator';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

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
});
