import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeleteProfile from '@/app/features/settings/pages/Settings/Sections/DeleteProfile';

const notifyMock = jest.fn();
const signOutMock = jest.fn();
const deleteDataMock = jest.fn();
const startRouteLoaderMock = jest.fn();
const stopRouteLoaderMock = jest.fn();
const routerReplaceMock = jest.fn();
let mockOrgState: any;
let mockUserSub: any;

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

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, inlabel, onChange, error }: any) => (
    <div>
      <label>
        {inlabel}
        <input value={value} onChange={onChange} />
      </label>
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) => (showModal ? <div>{children}</div> : null),
}));

jest.mock('@/app/hooks/useAuth', () => ({
  useSignOut: () => ({ signOut: signOutMock }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: () => startRouteLoaderMock(),
  stopRouteLoader: () => stopRouteLoaderMock(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector(mockOrgState),
}));

jest.mock('@/app/services/axios', () => ({
  deleteData: (...args: any[]) => deleteDataMock(...args),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ attributes: { sub: mockUserSub } }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock, push: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn(() => null), entries: jest.fn(() => [].entries()) }),
  usePathname: () => '/',
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { isAxiosError: (e: any) => !!(e && e.isAxiosError) },
  isAxiosError: (e: any) => !!(e && e.isAxiosError),
}));

const openModal = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Delete profile' }));
  fireEvent.change(screen.getByLabelText('Enter email address'), {
    target: { value: 'me@example.com' },
  });
  // Deleting a profile is irreversible, so the consent box gates the button.
  fireEvent.click(screen.getByLabelText('Confirm deletion consent'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
};

describe('Settings DeleteProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrgState = { membershipsByOrgId: {}, orgsById: {} };
    mockUserSub = 'user-1';
    deleteDataMock.mockResolvedValue(undefined);
    signOutMock.mockResolvedValue(undefined);
  });

  it('renders the danger-zone card with heading and description', () => {
    render(<DeleteProfile />);

    expect(
      screen.getByText('Leaves all organizations and erases your account')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete profile' })).toBeInTheDocument();
  });

  it('opens modal and validates required email', () => {
    render(<DeleteProfile />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete profile' }));
    fireEvent.click(screen.getByLabelText('Confirm deletion consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('warns to transfer ownership first when the user owns organizations', () => {
    mockOrgState = {
      membershipsByOrgId: {
        o1: { roleDisplay: 'Owner' },
        o2: { roleCode: 'owner' },
        o3: { roleDisplay: 'Vet' },
        o4: { roleDisplay: 'Owner' },
        o5: {},
        o6: null,
      },
      orgsById: {
        o1: { name: 'Alpha' },
        o2: { name: 'Beta' },
        o3: { name: 'Gamma' },
        o5: { name: 'Epsilon' },
      },
    };
    render(<DeleteProfile />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete profile' }));

    expect(notifyMock).toHaveBeenCalledWith('warning', {
      title: 'Transfer ownership first',
      text: 'You still own Alpha, Beta. Transfer ownership before deleting your profile.',
    });
    expect(screen.queryByLabelText('Enter email address')).not.toBeInTheDocument();
  });

  it('deletes the profile, signs out and redirects on success', async () => {
    render(<DeleteProfile />);

    openModal();

    await waitFor(() =>
      expect(screen.queryByLabelText('Enter email address')).not.toBeInTheDocument()
    );
    expect(startRouteLoaderMock).toHaveBeenCalled();
    expect(deleteDataMock).toHaveBeenCalledWith('/fhir/v1/user/user-1');
    expect(signOutMock).toHaveBeenCalled();
    expect(routerReplaceMock).toHaveBeenCalledWith('/signin');
  });

  it('notifies when the user identity is missing', async () => {
    mockUserSub = undefined;
    render(<DeleteProfile />);

    openModal();

    await waitFor(() =>
      expect(screen.queryByLabelText('Enter email address')).not.toBeInTheDocument()
    );
    expect(notifyMock).toHaveBeenCalledWith('error', {
      title: 'Unable to delete profile',
      text: 'Missing user identity. Please sign in again.',
    });
    expect(deleteDataMock).not.toHaveBeenCalled();
  });

  it('surfaces the API error message when deletion fails with an axios error', async () => {
    deleteDataMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Server refused' } },
    });
    render(<DeleteProfile />);

    openModal();

    await waitFor(() =>
      expect(screen.queryByLabelText('Enter email address')).not.toBeInTheDocument()
    );
    expect(notifyMock).toHaveBeenCalledWith('error', {
      title: 'Unable to delete profile',
      text: 'Server refused',
    });
    expect(stopRouteLoaderMock).toHaveBeenCalled();
  });

  it('falls back to the error message when the axios error has no response body', async () => {
    deleteDataMock.mockRejectedValueOnce({ isAxiosError: true, message: 'Network Error' });
    render(<DeleteProfile />);

    openModal();

    await waitFor(() =>
      expect(screen.queryByLabelText('Enter email address')).not.toBeInTheDocument()
    );
    expect(notifyMock).toHaveBeenCalledWith('error', {
      title: 'Unable to delete profile',
      text: 'Network Error',
    });
  });

  it('shows a generic error when deletion fails with a non-axios error', async () => {
    deleteDataMock.mockRejectedValueOnce(new Error('boom'));
    render(<DeleteProfile />);

    openModal();

    await waitFor(() =>
      expect(screen.queryByLabelText('Enter email address')).not.toBeInTheDocument()
    );
    expect(notifyMock).toHaveBeenCalledWith('error', {
      title: 'Unable to delete profile',
      text: 'Please try again.',
    });
    expect(stopRouteLoaderMock).toHaveBeenCalled();
  });
});
