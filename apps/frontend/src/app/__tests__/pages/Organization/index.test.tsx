import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Organization } from '@/app/features/organization/pages/Organization';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('Sections/Profile')) {
        const MockProfile = (
          jest.requireMock('@/app/features/organization/pages/Organization/Sections/Profile') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockProfile {...props} />;
      }
      if (source.includes('Specialities/Specialities')) {
        const MockSpecialities = (
          jest.requireMock(
            '@/app/features/organization/pages/Organization/Sections/Specialities/Specialities'
          ) as { default: React.FC<Record<string, unknown>> }
        ).default;
        return <MockSpecialities {...props} />;
      }
      if (source.includes('Rooms/Rooms')) {
        const MockRooms = (
          jest.requireMock(
            '@/app/features/organization/pages/Organization/Sections/Rooms/Rooms'
          ) as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockRooms {...props} />;
      }
      if (source.includes('Team/Team')) {
        const MockTeam = (
          jest.requireMock('@/app/features/organization/pages/Organization/Sections/Team/Team') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockTeam {...props} />;
      }
      if (source.includes('Sections/Payment')) {
        const MockPayment = (
          jest.requireMock('@/app/features/organization/pages/Organization/Sections/Payment') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockPayment {...props} />;
      }
      if (source.includes('Documents/Documents')) {
        const MockDocuments = (
          jest.requireMock(
            '@/app/features/organization/pages/Organization/Sections/Documents/Documents'
          ) as { default: React.FC<Record<string, unknown>> }
        ).default;
        return <MockDocuments {...props} />;
      }
      if (source.includes('Sections/DocumentESigning')) {
        const MockDocumentESigning = (
          jest.requireMock(
            '@/app/features/organization/pages/Organization/Sections/DocumentESigning'
          ) as { default: React.FC<Record<string, unknown>> }
        ).default;
        return <MockDocumentESigning {...props} />;
      }
      if (source.includes('Sections/LinkedMedicalDevices')) {
        const MockLinkedMedicalDevices = (
          jest.requireMock(
            '@/app/features/organization/pages/Organization/Sections/LinkedMedicalDevices'
          ) as { default: React.FC<Record<string, unknown>> }
        ).default;
        return <MockLinkedMedicalDevices {...props} />;
      }
      if (source.includes('Sections/DeleteOrg')) {
        const MockDeleteOrg = (
          jest.requireMock('@/app/features/organization/pages/Organization/Sections/DeleteOrg') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockDeleteOrg {...props} />;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

const usePrimaryOrgMock = jest.fn();
const useOrgStoreMock = jest.fn();
const teamMock = jest.fn();

jest.mock('@/app/hooks/useOrgSelectors', () => ({
  usePrimaryOrg: () => usePrimaryOrgMock(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => useOrgStoreMock(selector),
}));

jest.mock('@/app/features/organization/pages/Organization/Sections/Profile', () => ({
  __esModule: true,
  default: () => <div data-testid="profile" />,
}));
jest.mock(
  '@/app/features/organization/pages/Organization/Sections/Specialities/Specialities',
  () => ({
    __esModule: true,
    default: () => <div data-testid="specialities" />,
  })
);
jest.mock('@/app/features/organization/pages/Organization/Sections/Rooms/Rooms', () => ({
  __esModule: true,
  default: () => <div data-testid="rooms" />,
}));
jest.mock('@/app/features/organization/pages/Organization/Sections/Team/Team', () => ({
  __esModule: true,
  default: (props: any) => {
    teamMock(props);
    return <div data-testid="team" />;
  },
}));
jest.mock('@/app/features/organization/pages/Organization/Sections/Payment', () => ({
  __esModule: true,
  default: () => <div data-testid="payment" />,
}));
jest.mock('@/app/features/organization/pages/Organization/Sections/Documents/Documents', () => ({
  __esModule: true,
  default: () => <div data-testid="documents" />,
}));
jest.mock('@/app/features/organization/pages/Organization/Sections/DocumentESigning', () => ({
  __esModule: true,
  default: () => <div data-testid="document-e-signing" />,
}));
jest.mock('@/app/features/organization/pages/Organization/Sections/LinkedMedicalDevices', () => ({
  __esModule: true,
  default: () => <div data-testid="linked-medical-devices" />,
}));
jest.mock('@/app/features/organization/pages/Organization/Sections/DeleteOrg', () => ({
  __esModule: true,
  default: () => <div data-testid="delete-org" />,
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
