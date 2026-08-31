import React from 'react';
import { render } from '@testing-library/react';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { useAuthStore } from '@/app/stores/authStore';

const mockReplace = jest.fn();
const mockRedirect = jest.fn();
const mockUsePathname = jest.fn(() => '/developers/home');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockUsePathname(),
  redirect: (...args: string[]) => mockRedirect(...args),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

describe('DevRouteGuard', () => {
  const originalAuthGuard = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
  const originalTestHostname = process.env.YC_TEST_HOSTNAME;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'false';
    process.env.YC_TEST_HOSTNAME = 'localhost';
    mockUseAuthStore.mockImplementation(
      () =>
        ({
          status: 'authenticated',
          role: 'developer',
          signout: jest.fn(),
        }) as any
    );
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = originalAuthGuard;
    process.env.YC_TEST_HOSTNAME = originalTestHostname;
  });

  it('renders children for developer role', () => {
    const { getByText } = render(
      <DevRouteGuard>
        <div>child</div>
      </DevRouteGuard>
    );
    expect(getByText('child')).toBeInTheDocument();
  });

  it('redirects unauthenticated developer path', () => {
    mockUseAuthStore.mockImplementation(() => ({
      status: 'unauthenticated',
      role: null,
      signout: jest.fn(),
    }));

    render(
      <DevRouteGuard>
        <div>child</div>
      </DevRouteGuard>
    );
    expect(mockRedirect).toHaveBeenCalledWith('/developers/signin');
  });

  // An account can hold the practice role and the developer role at once. The
  // guard used to compare only `role`, which is whichever single role
  // `/v1/auth/me` surfaced, so a dual-role account was shown the rejection
  // screen on a portal it is entitled to.
  describe('accounts holding more than one role', () => {
    const renderGuard = (state: Record<string, unknown>) => {
      mockUseAuthStore.mockImplementation(
        () => ({ status: 'authenticated', signout: jest.fn(), ...state }) as any
      );
      return render(
        <DevRouteGuard>
          <div>child</div>
        </DevRouteGuard>
      );
    };

    it('admits an account whose developer role is not the one surfaced as `role`', () => {
      const { getByText } = renderGuard({ role: 'member', roles: ['member', 'developer'] });
      expect(getByText('child')).toBeInTheDocument();
    });

    it('admits it regardless of the order the role store returns', () => {
      const { getByText } = renderGuard({ role: 'member', roles: ['developer', 'member'] });
      expect(getByText('child')).toBeInTheDocument();
    });

    it('still rejects an account that holds no developer role', () => {
      const { queryByText, getByText } = renderGuard({
        role: 'member',
        roles: ['member', 'owner'],
      });
      expect(queryByText('child')).not.toBeInTheDocument();
      expect(getByText(/isn.t a developer account/i)).toBeInTheDocument();
    });

    it('falls back to the single role when the API sent no role list', () => {
      const { getByText } = renderGuard({ role: 'developer', roles: [] });
      expect(getByText('child')).toBeInTheDocument();
    });

    it('normalises casing and padding before deciding', () => {
      const { getByText } = renderGuard({ role: 'member', roles: ['member', '  Developer  '] });
      expect(getByText('child')).toBeInTheDocument();
    });
  });

  it('keeps the session and explains itself when authenticated without developer role', () => {
    const signout = jest.fn();
    mockUseAuthStore.mockImplementation(() => ({
      status: 'authenticated',
      role: 'user',
      signout,
    }));

    const { queryByText, getByText } = render(
      <DevRouteGuard>
        <div>child</div>
      </DevRouteGuard>
    );

    /* The session survives. Signing the user out here used to destroy a valid
       session for the whole app just because a `/developers/*` URL was opened,
       and the redirect that followed sent them to a sign-in that could only
       fail the same way - which read as "valid credentials rejected". */
    expect(signout).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(queryByText('child')).not.toBeInTheDocument();
    expect(getByText(/isn.t a developer account/i)).toBeInTheDocument();
  });

  it('only trusts devAuth on localhost when the local bypass flag is enabled', () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    globalThis.sessionStorage.setItem('devAuth', 'true');
    mockUseAuthStore.mockImplementation(() => ({
      status: 'authenticated',
      role: 'user',
      signout: jest.fn(),
    }));

    const { getByText } = render(
      <DevRouteGuard>
        <div>child</div>
      </DevRouteGuard>
    );

    expect(getByText('child')).toBeInTheDocument();
  });

  it('ignores devAuth outside localhost', () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    process.env.YC_TEST_HOSTNAME = 'dev.yosemitecrew.com';
    globalThis.sessionStorage.setItem('devAuth', 'true');
    const signout = jest.fn();
    mockUseAuthStore.mockImplementation(() => ({
      status: 'authenticated',
      role: 'user',
      signout,
    }));

    const { getByText, queryByText } = render(
      <DevRouteGuard>
        <div>child</div>
      </DevRouteGuard>
    );

    // The bypass flag is inert off localhost, so this is an ordinary
    // non-developer: blocked, told why, session intact.
    expect(queryByText('child')).not.toBeInTheDocument();
    expect(getByText(/isn.t a developer account/i)).toBeInTheDocument();
    expect(signout).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
