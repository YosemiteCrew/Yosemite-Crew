import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionInitializer from '@/app/ui/layout/SessionInitializer';
import { useAuthStore } from '@/app/stores/authStore';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { setCompanionTerminologyForOrg } from '@/app/lib/companionTerminology';

jest.mock('@/app/ui/layout/Header/Header', () => () => <div data-testid="header" />);
jest.mock('@/app/ui/layout/Sidebar/Sidebar', () => () => <div data-testid="sidebar" />);
jest.mock('@/app/hooks/useLoadOrg', () => ({ useLoadOrg: jest.fn() }));
jest.mock('@/app/hooks/useProfiles', () => ({
  useLoadProfiles: jest.fn(),
  usePrimaryOrgProfile: jest.fn().mockReturnValue(null),
}));
jest.mock('@/app/hooks/useAvailabiities', () => ({ useLoadAvailabilities: jest.fn() }));
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn((selector: any) =>
    selector({
      primaryOrgId: null,
      orgsById: {
        'org-1': { type: 'HOSPITAL' },
      },
    })
  ),
}));

jest.mock('@/app/lib/companionTerminology', () => ({
  getCompanionTerminologyForOrg: jest.fn(() => 'COMPANION'),
  rewriteCompanionTerminologyText: jest.fn((text: string) => text),
  setCompanionTerminologyForOrg: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: Object.assign(jest.fn(), {
    getState: jest.fn(),
  }),
}));

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockGetState = (useAuthStore as any).getState as jest.Mock;
const mockUsePrimaryOrgProfile = usePrimaryOrgProfile as unknown as jest.Mock;

describe('SessionInitializer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({ checkSession: jest.fn().mockResolvedValue(null) });
    mockUsePrimaryOrgProfile.mockReturnValue(null);
  });

  it('hides private children while checking session', () => {
    mockUseAuthStore.mockImplementation((selector: any) => selector({ status: 'checking' }));

    render(
      <SessionInitializer>
        <div data-testid="child" />
      </SessionInitializer>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(mockGetState).toHaveBeenCalled(); // checkSession triggered via effect
  });

  it('shows private children once authenticated', () => {
    mockUseAuthStore.mockImplementation((selector: any) => selector({ status: 'authenticated' }));

    render(
      <SessionInitializer>
        <div data-testid="child" />
      </SessionInitializer>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('stores valid profile terminology for selected org', () => {
    const useOrgStore = jest.requireMock('@/app/stores/orgStore').useOrgStore as jest.Mock;
    useOrgStore.mockImplementation((selector: any) =>
      selector({
        primaryOrgId: 'org-1',
        orgsById: { 'org-1': { type: 'HOSPITAL' } },
      })
    );
    mockUseAuthStore.mockImplementation((selector: any) => selector({ status: 'authenticated' }));
    mockUsePrimaryOrgProfile.mockReturnValue({
      personalDetails: {
        pmsPreferences: {
          animalTerminology: 'PATIENT',
        },
      },
    });

    render(
      <SessionInitializer>
        <div data-testid="child" />
      </SessionInitializer>
    );

    expect(setCompanionTerminologyForOrg).toHaveBeenCalledWith('org-1', 'PATIENT');
  });
});
