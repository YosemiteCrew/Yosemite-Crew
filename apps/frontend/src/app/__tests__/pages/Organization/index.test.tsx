import React from 'react';
import { render, screen } from '@testing-library/react';
import Organization from '@/app/features/organization/pages/Organization';

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

const usePrimaryOrgMock = jest.fn();

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => selector({ status: 'loaded' }),
}));

jest.mock('@/app/features/organization/pages/Organization/Sections', () => ({
  Profile: () => <div data-testid="profile" />,
  Specialities: () => <div data-testid="specialities" />,
  Rooms: () => <div data-testid="rooms" />,
  Team: () => <div data-testid="team" />,
  Payment: () => <div data-testid="payment" />,
  LinkedMedicalDevices: () => <div data-testid="linked-medical-devices" />,
  Documents: () => <div data-testid="documents" />,
  DocumentESigning: () => <div data-testid="document-e-signing" />,
  DeleteOrg: () => <div data-testid="delete-org" />,
}));

describe('Organization page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders verified org sections', () => {
    usePrimaryOrgMock.mockReturnValue({ id: 'org-1', isVerified: true });

    render(<Organization />);

    expect(screen.getByTestId('profile')).toBeInTheDocument();
    expect(screen.getByTestId('specialities')).toBeInTheDocument();
    expect(screen.getByTestId('team')).toBeInTheDocument();
    expect(screen.getByTestId('rooms')).toBeInTheDocument();
    expect(screen.getByTestId('payment')).toBeInTheDocument();
    expect(screen.getByTestId('linked-medical-devices')).toBeInTheDocument();
    expect(screen.getByTestId('documents')).toBeInTheDocument();
    expect(screen.getByTestId('document-e-signing')).toBeInTheDocument();
    expect(screen.getByTestId('delete-org')).toBeInTheDocument();
  });

  it('hides gated sections for unverified org', () => {
    usePrimaryOrgMock.mockReturnValue({ id: 'org-2', isVerified: false });

    render(<Organization />);

    expect(screen.getByTestId('profile')).toBeInTheDocument();
    expect(screen.getByTestId('specialities')).toBeInTheDocument();
    expect(screen.queryByTestId('team')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rooms')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment')).not.toBeInTheDocument();
    expect(screen.queryByTestId('linked-medical-devices')).not.toBeInTheDocument();
    expect(screen.queryByTestId('documents')).not.toBeInTheDocument();
    expect(screen.queryByTestId('document-e-signing')).not.toBeInTheDocument();
    expect(screen.getByTestId('delete-org')).toBeInTheDocument();
  });
});
