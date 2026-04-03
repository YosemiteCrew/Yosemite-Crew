import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeleteConfirmationModal, {
  useDeleteConfirmation,
} from '@/app/ui/overlays/Modal/DeleteConfirmationModal';
import { renderHook, act } from '@testing-library/react';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons/Delete', () => ({
  __esModule: true,
  default: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/ui/overlays/Modal/ModalHeader', () => ({
  __esModule: true,
  default: ({ title, onClose }: any) => (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, error }: any) => (
    <div>
      <input aria-label="Enter email address" value={value} onChange={onChange} />
      {error ? <span>{error}</span> : null}
    </div>
  ),
}));

describe('useDeleteConfirmation', () => {
  it('validates email and resets state', () => {
    const { result } = renderHook(() => useDeleteConfirmation());

    act(() => {
      result.current.setShowModal(true);
      result.current.setConsent(true);
      result.current.setEmail('a@test.com');
    });

    act(() => {
      result.current.setEmail('');
    });

    let valid = true;
    act(() => {
      valid = result.current.validateEmail();
    });
    expect(valid).toBe(false);

    expect(result.current.emailError).toBe('Email is required');

    act(() => {
      result.current.reset();
    });

    expect(result.current.showModal).toBe(false);
    expect(result.current.email).toBe('');
    expect(result.current.consent).toBe(false);
    expect(result.current.emailError).toBe('');
  });
});

describe('DeleteConfirmationModal', () => {
  const baseProps = {
    showModal: true,
    setShowModal: jest.fn(),
    title: 'Delete account',
    confirmationQuestion: 'Are you sure?',
    itemsToRemove: ['Appointments', 'Documents'],
    emailPrompt: 'Please confirm email',
    consentLabel: 'I understand this is permanent',
    noteText: 'This action cannot be undone',
    onDelete: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal details and closes on cancel', () => {
    render(<DeleteConfirmationModal {...baseProps} />);

    expect(screen.getByText('Delete account')).toBeInTheDocument();
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(baseProps.setShowModal).toHaveBeenCalledWith(false);
  });

  it('shows email validation error when deleting without email', async () => {
    render(<DeleteConfirmationModal {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(baseProps.onDelete).not.toHaveBeenCalled();
  });

  it('deletes successfully when email is provided', async () => {
    render(<DeleteConfirmationModal {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Enter email address'), {
      target: { value: 'owner@yosemite.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(baseProps.onDelete).toHaveBeenCalledTimes(1);
      expect(baseProps.setShowModal).toHaveBeenCalledWith(false);
    });
  });
});
