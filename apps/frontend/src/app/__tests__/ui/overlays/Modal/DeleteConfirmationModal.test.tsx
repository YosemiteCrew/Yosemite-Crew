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
  // Mirrors BaseButton: isDisabled must actually disable, otherwise the
  // assertions below would pass without exercising the gate.
  default: ({ text, onClick, isDisabled }: any) => (
    <button type="button" onClick={onClick} disabled={isDisabled}>
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

    fireEvent.click(screen.getByLabelText('Confirm deletion consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(baseProps.onDelete).not.toHaveBeenCalled();
  });

  it('shows email validation error when email format is invalid', async () => {
    render(<DeleteConfirmationModal {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Enter email address'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByLabelText('Confirm deletion consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(baseProps.onDelete).not.toHaveBeenCalled();
  });

  it('deletes successfully when email is provided', async () => {
    render(<DeleteConfirmationModal {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Enter email address'), {
      target: { value: 'owner@yosemite.com' },
    });
    fireEvent.click(screen.getByLabelText('Confirm deletion consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(baseProps.onDelete).toHaveBeenCalledTimes(1);
      expect(baseProps.setShowModal).toHaveBeenCalledWith(false);
    });
  });
});

describe('DeleteConfirmationModal consent gate', () => {
  const baseProps = {
    showModal: true,
    setShowModal: jest.fn(),
    title: 'Delete organization',
    confirmationQuestion: 'Are you sure?',
    itemsToRemove: ['All records'],
    emailPrompt: 'Type your email to confirm',
    consentLabel: 'I understand this is permanent',
    noteText: 'This cannot be undone.',
  };

  afterEach(() => jest.clearAllMocks());

  it('keeps Delete disabled until both consent and an email are given', () => {
    render(<DeleteConfirmationModal {...baseProps} onDelete={jest.fn()} />);
    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    expect(deleteButton).toBeDisabled();

    // Consent is the gate. It was read by nothing before, so the checkbox was
    // decorative on an irreversible action.
    fireEvent.click(screen.getByLabelText('Confirm deletion consent'));
    expect(deleteButton).toBeEnabled();
  });

  it('deletes once consent is given and the email is valid', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<DeleteConfirmationModal {...baseProps} onDelete={onDelete} />);

    fireEvent.change(screen.getByLabelText('Enter email address'), {
      target: { value: 'owner@clinic.com' },
    });
    fireEvent.click(screen.getByLabelText('Confirm deletion consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('cannot be triggered while consent is unticked', () => {
    const onDelete = jest.fn();
    render(<DeleteConfirmationModal {...baseProps} onDelete={onDelete} />);

    fireEvent.change(screen.getByLabelText('Enter email address'), {
      target: { value: 'owner@clinic.com' },
    });
    // A disabled button swallows the click, so the irreversible action is
    // unreachable without consent. This is the hole that existed before:
    // handleDelete read the email but never the checkbox.
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('still blocks an invalid email once consent is given', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<DeleteConfirmationModal {...baseProps} onDelete={onDelete} />);

    fireEvent.change(screen.getByLabelText('Enter email address'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByLabelText('Confirm deletion consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).not.toHaveBeenCalled());
  });
});
