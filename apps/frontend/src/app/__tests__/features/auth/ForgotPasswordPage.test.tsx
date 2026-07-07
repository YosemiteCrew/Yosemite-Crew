import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

let authState: { user: unknown; role: string };
jest.mock('@/app/stores/authStore', () => ({ useAuthStore: () => authState }));

const resolveDefaultOpenScreenRoute = jest.fn();
jest.mock('@/app/lib/defaultOpenScreen', () => ({
  resolveDefaultOpenScreenRoute: (role: string) => resolveDefaultOpenScreenRoute(role),
}));

jest.mock('@/app/features/auth/pages/ForgotPassword/ForgotPassword', () => ({
  __esModule: true,
  default: () => <div>Forgot password screen</div>,
}));

import ForgotPasswordPageWrapper from '@/app/features/auth/pages/ForgotPassword/ForgotPasswordPage';

describe('ForgotPasswordPage wrapper', () => {
  beforeEach(() => {
    push.mockReset();
    resolveDefaultOpenScreenRoute.mockReset();
    authState = { user: null, role: 'member' };
  });

  it('renders the forgot-password screen when no user is signed in', () => {
    render(<ForgotPasswordPageWrapper />);
    expect(screen.getByText('Forgot password screen')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('redirects an authenticated user to their default screen', () => {
    authState = { user: { id: '1' }, role: 'admin' };
    resolveDefaultOpenScreenRoute.mockReturnValue('/dashboard');
    render(<ForgotPasswordPageWrapper />);
    expect(resolveDefaultOpenScreenRoute).toHaveBeenCalledWith('admin');
    expect(push).toHaveBeenCalledWith('/dashboard');
  });
});
