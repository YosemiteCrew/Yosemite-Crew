import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Organization } from '@/app/features/organization/pages/Organization';

const usePrimaryOrgMock = jest.fn();
const useOrgStoreMock = jest.fn();
const teamMock = jest.fn();

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => useOrgStoreMock(selector),
}));

jest.mock('@/app/features/organization/pages/Organization/Sections', () => ({
  Profile: () => <div data-testid="profile" />,
  Specialities: () => <div data-testid="specialities" />,
  Rooms: () => <div data-testid="rooms" />,
  Team: (props: any) => {
    teamMock(props);
    return <div data-testid="team" />;
  },
  Payment: () => <div data-testid="payment" />,
  Documents: () => <div data-testid="documents" />,
  DocumentESigning: () => <div data-testid="document-e-signing" />,
  LinkedMedicalDevices: () => <div data-testid="linked-medical-devices" />,
  DeleteOrg: () => <div data-testid="delete-org" />,
}));

describe('Organization page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOrgStoreMock.mockImplementation((selector) => selector({ status: 'loaded' }));
  });

  it('renders verified org sections and passes verified org state into the team section', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org-1', name: 'Org', isVerified: true });

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
    expect(teamMock).toHaveBeenCalledWith(expect.objectContaining({ isVerified: true }));
  });

  it('hides gated sections for unverified org', () => {
    usePrimaryOrgMock.mockReturnValue({ _id: 'org-2', name: 'Org 2', isVerified: false });

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

  it('shows the skeleton while organization data is loading', () => {
    useOrgStoreMock.mockImplementation((selector) => selector({ status: 'loading' }));
    usePrimaryOrgMock.mockReturnValue(null);

    const { container } = render(<Organization />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('profile')).not.toBeInTheDocument();
  });
});
