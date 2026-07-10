import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PermissionDeniedState from '@/app/ui/layout/states/PermissionDeniedState';

const pushMock = jest.fn();
const backMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

let mockOrgState: { primaryOrgId: string | null; membershipsByOrgId: Record<string, any> };

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector(mockOrgState),
}));

describe('PermissionDeniedState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrgState = {
      primaryOrgId: 'org-x',
      membershipsByOrgId: { 'org-x': { roleDisplay: 'Vet technician' } },
    };
  });

  it('binds the denied resource, detail and the real membership role', () => {
    render(<PermissionDeniedState resource="Finance" detail="invoices and payouts" />);

    expect(screen.getByText(/You don.t have access to Finance/)).toBeInTheDocument();
    expect(
      screen.getByText(/Your role \(Vet technician\) can.t view invoices and payouts\./)
    ).toBeInTheDocument();
  });

  it('falls back to detail = resource and roleCode when data is sparse', () => {
    mockOrgState = {
      primaryOrgId: 'org-x',
      membershipsByOrgId: { 'org-x': { roleCode: 'RECEPTION' } },
    };
    render(<PermissionDeniedState resource="Inventory" />);

    expect(screen.getByText(/can.t view Inventory\./)).toBeInTheDocument();
    expect(screen.getByText(/\(RECEPTION\)/)).toBeInTheDocument();
  });

  it('uses default resource + "your current role" when nothing is provided', () => {
    mockOrgState = { primaryOrgId: null, membershipsByOrgId: {} };
    render(<PermissionDeniedState />);

    expect(screen.getByText(/You don.t have access to this area/)).toBeInTheDocument();
    expect(screen.getByText(/\(your current role\)/)).toBeInTheDocument();
  });

  it('wires the default request-access and back router actions', () => {
    render(<PermissionDeniedState resource="Finance" />);

    fireEvent.click(screen.getByText('Request access'));
    expect(pushMock).toHaveBeenCalledWith('/organization');

    fireEvent.click(screen.getByText('Back'));
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it('honours explicit role and handler overrides', () => {
    const onRequestAccess = jest.fn();
    const onBack = jest.fn();
    render(
      <PermissionDeniedState
        resource="Finance"
        role="Owner"
        onRequestAccess={onRequestAccess}
        onBack={onBack}
      />
    );

    expect(screen.getByText(/\(Owner\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Request access'));
    fireEvent.click(screen.getByText('Back'));
    expect(onRequestAccess).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
