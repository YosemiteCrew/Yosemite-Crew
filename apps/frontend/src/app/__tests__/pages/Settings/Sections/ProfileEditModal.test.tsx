import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileEditModal from '@/app/features/settings/pages/Settings/Sections/ProfileEditModal';

// Render the modal shell as a plain wrapper so its content is directly testable.
jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        header-close
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/settings/pages/Settings/Sections/ProfileDetails', () => ({
  __esModule: true,
  default: () => <div>ProfileDetails</div>,
}));

jest.mock('@/app/features/settings/pages/Settings/Sections/SecuritySection', () => ({
  __esModule: true,
  default: () => <div>SecuritySection</div>,
}));

describe('Settings ProfileEditModal', () => {
  it('renders the Edit profile header with the profile and security editors', () => {
    render(<ProfileEditModal showModal setShowModal={jest.fn()} />);
    expect(screen.getByText('Edit profile')).toBeInTheDocument();
    expect(screen.getByText('ProfileDetails')).toBeInTheDocument();
    expect(screen.getByText('SecuritySection')).toBeInTheDocument();
  });

  it('closes via the header close affordance', () => {
    const setShowModal = jest.fn();
    render(<ProfileEditModal showModal setShowModal={setShowModal} />);
    fireEvent.click(screen.getByRole('button', { name: 'header-close' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });
});
