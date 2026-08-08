import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddTeam from '@/app/features/organization/pages/Organization/Sections/Team/AddTeam';
import { sendInvite } from '@/app/features/organization/services/teamService';
import { useSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { useSubscriptionCounterUpdate } from '@/app/hooks/useStripeOnboarding';
import { useCanMoreForPrimaryOrg } from '@/app/hooks/useBilling';
import { useNotify } from '@/app/hooks/useNotify';

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/primitives/Accordion/Accordion', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

const FieldMock = ({ error, inlabel, placeholder, value, onChange }: any) => (
  <div>
    <span>{inlabel || placeholder}</span>
    {onChange && (
      <input
        aria-label={inlabel || placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e)}
      />
    )}
    {error ? <div>{error}</div> : null}
  </div>
);

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: (props: any) => <FieldMock {...props} />,
}));

jest.mock('@/app/ui/inputs/MultiSelectDropdown', () => ({
  __esModule: true,
  default: ({ error, placeholder, options, onChange }: any) => (
    <div>
      <span>{placeholder}</span>
      <button type="button" onClick={() => onChange(options.map((o: any) => o.value))}>
        select all specialities
      </button>
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ error, placeholder, options, onSelect }: any) => (
    <div>
      <span>{placeholder}</span>
      <button type="button" onClick={() => onSelect(options[0])}>
        select role
      </button>
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/SelectLabel', () => ({
  __esModule: true,
  default: ({ title, setOption }: any) => (
    <div>
      {title}
      <button type="button" onClick={() => setOption('contract')}>
        set employee type
      </button>
    </div>
  ),
}));

jest.mock('@/app/hooks/useSpecialities', () => ({
  useSpecialitiesForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/organization/services/teamService', () => ({
  sendInvite: jest.fn(),
}));

jest.mock('@/app/hooks/useStripeOnboarding', () => ({
  useSubscriptionCounterUpdate: jest.fn(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCanMoreForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: jest.fn(),
}));

jest.mock('@/app/lib/validators', () => ({
  getEmailValidationError: (value: string) =>
    value.includes('@') ? undefined : 'Enter a valid email',
  normalizeEmail: (value: string) => value.trim(),
}));

describe('AddTeam', () => {
  const notify = jest.fn();
  const refetch = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue([
      { name: 'Surgery', _id: 'spec-1' },
    ]);
    (useSubscriptionCounterUpdate as jest.Mock).mockReturnValue({ refetch });
    (useCanMoreForPrimaryOrg as jest.Mock).mockReturnValue({ canMore: true, reason: null });
    (useNotify as jest.Mock).mockReturnValue({ notify });
  });

  it('shows validation errors when fields are missing', () => {
    render(<AddTeam showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Speciality is required')).toBeInTheDocument();
    expect(screen.getByText('Role is required')).toBeInTheDocument();
  });

  it('shows the limit-reached booking error when canMore is false', () => {
    (useCanMoreForPrimaryOrg as jest.Mock).mockReturnValue({
      canMore: false,
      reason: 'limit_reached',
    });
    render(<AddTeam showModal setShowModal={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(
      screen.getByText('You’ve reached your free user limit. Please upgrade to book more.')
    ).toBeInTheDocument();
  });

  it('shows a generic booking error for unknown reasons when canMore is false', () => {
    (useCanMoreForPrimaryOrg as jest.Mock).mockReturnValue({
      canMore: false,
      reason: 'unknown',
    });
    render(<AddTeam showModal setShowModal={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(
      screen.getByText('We couldn’t verify your users limit right now. Please try again.')
    ).toBeInTheDocument();
  });

  it('sends the invite, refetches, notifies success, closes modal and resets form on success', async () => {
    (sendInvite as jest.Mock).mockResolvedValue(undefined);
    const setShowModal = jest.fn();
    render(<AddTeam showModal setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByText('select all specialities'));
    fireEvent.click(screen.getByText('select role'));

    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => {
      expect(sendInvite).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com' })
      );
    });
    expect(refetch).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Invite sent' })
    );
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('notifies an error and logs when sendInvite rejects', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('invite failed');
    (sendInvite as jest.Mock).mockRejectedValue(error);
    const setShowModal = jest.fn();
    render(<AddTeam showModal setShowModal={setShowModal} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByText('select all specialities'));
    fireEvent.click(screen.getByText('select role'));

    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to send invite' })
      );
    });
    expect(consoleSpy).toHaveBeenCalledWith(error);
    expect(setShowModal).not.toHaveBeenCalledWith(false);
    consoleSpy.mockRestore();
  });

  it('clears the email error as the user types', () => {
    render(<AddTeam showModal setShowModal={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument();
  });

  it('closes the modal via the Close icon', () => {
    const setShowModal = jest.fn();
    render(<AddTeam showModal setShowModal={setShowModal} />);
    fireEvent.click(screen.getByText('close'));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('changes employee type via SelectLabel setOption', () => {
    render(<AddTeam showModal setShowModal={jest.fn()} />);
    fireEvent.click(screen.getByText('set employee type'));
    expect(screen.getByText('Employee type')).toBeInTheDocument();
  });

  it('renders the panel title alongside a single close control', () => {
    render(<AddTeam showModal setShowModal={jest.fn()} />);
    expect(screen.getAllByText('close')).toHaveLength(1);
    expect(screen.getAllByText('Add team')[0]).toBeInTheDocument();
  });
});
