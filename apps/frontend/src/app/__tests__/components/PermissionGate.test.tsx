import React from 'react';
import { render, screen } from '@testing-library/react';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { usePermissions } from '@/app/hooks/usePermissions';

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) =>
    selector({
      primaryOrgId: 'org-x',
      membershipsByOrgId: { 'org-x': { roleDisplay: 'Vet technician' } },
    }),
}));

const mockUsePermissions = usePermissions as unknown as jest.Mock;

describe('PermissionGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows skeleton while loading permissions and hides fallback', () => {
    mockUsePermissions.mockReturnValue({
      isLoading: true,
      can: jest.fn(),
    });

    render(
      <PermissionGate
        skeleton={<div data-testid="skeleton">Loading...</div>}
        fallback={<div data-testid="fallback">Not authorized</div>}
      >
        <div data-testid="child">Child</div>
      </PermissionGate>
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('shows nothing while loading when no skeleton is provided', () => {
    mockUsePermissions.mockReturnValue({
      isLoading: true,
      can: jest.fn(),
    });

    render(
      <PermissionGate fallback={<div data-testid="fallback">Not authorized</div>}>
        <div data-testid="child">Child</div>
      </PermissionGate>
    );

    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('renders fallback when permission check fails', () => {
    mockUsePermissions.mockReturnValue({
      isLoading: false,
      can: jest.fn(() => false),
    });

    render(
      <PermissionGate fallback={<div data-testid="fallback">Nope</div>}>
        <div data-testid="child">Child</div>
      </PermissionGate>
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('renders the PermissionDeniedState when denied with a deniedResource and no fallback', () => {
    mockUsePermissions.mockReturnValue({
      isLoading: false,
      can: jest.fn(() => false),
    });

    render(
      <PermissionGate deniedResource="Finance" deniedDetail="invoices and payouts">
        <div data-testid="child">Child</div>
      </PermissionGate>
    );

    expect(screen.getByText(/You don.t have access to Finance/)).toBeInTheDocument();
    expect(
      screen.getByText(/Your role \(Vet technician\) can.t view invoices and payouts\./)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('child')).toBeNull();
  });

  it('renders nothing when denied with neither fallback nor deniedResource', () => {
    mockUsePermissions.mockReturnValue({
      isLoading: false,
      can: jest.fn(() => false),
    });

    const { container } = render(
      <PermissionGate>
        <div data-testid="child">Child</div>
      </PermissionGate>
    );

    expect(screen.queryByTestId('child')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders children when permissions allow', () => {
    const canMock = jest.fn(() => true);
    mockUsePermissions.mockReturnValue({
      isLoading: false,
      can: canMock,
    });

    render(
      <PermissionGate anyOf={['perm:read' as any]} fallback={<div>Fallback</div>}>
        <div data-testid="child">Allowed</div>
      </PermissionGate>
    );

    expect(canMock).toHaveBeenCalledWith({ anyOf: ['perm:read'] });
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
