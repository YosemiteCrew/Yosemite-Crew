import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionInitializer from '@/app/ui/layout/SessionInitializer';
import { useAuthStore } from '@/app/stores/authStore';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';
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
jest.mock('@/app/hooks/useFullscreenLoader', () => ({ useFullscreenLoader: jest.fn() }));
const ORG_STATE = {
  primaryOrgId: null,
  orgsById: {
    'org-1': { type: 'HOSPITAL' },
  },
};

jest.mock('@/app/stores/orgStore', () => ({
  // `getState` as well as the selector form: the terminology rewriter reads the
  // store imperatively (it runs outside React, from a MutationObserver), and a
  // mock with only the hook form made it throw the moment the title rewrite
  // started running on mount.
  useOrgStore: Object.assign(
    jest.fn((selector: any) => selector(ORG_STATE)),
    { getState: () => ORG_STATE }
  ),
}));

// The org-scoped refresh effect fires thirteen loaders the moment primaryOrgId
// is truthy, and one test sets it. Unmocked, those reach axios and leave real
// XMLHttpRequests open after the run ("Jest did not exit"). Stub them all.
jest.mock('@/app/features/organization/services/orgService', () => ({ loadOrgs: jest.fn() }));
jest.mock('@/app/features/organization/services/profileService', () => ({
  loadProfiles: jest.fn(),
}));
jest.mock('@/app/features/organization/services/availabilityService', () => ({
  loadAvailability: jest.fn(),
}));
jest.mock('@/app/features/organization/services/teamService', () => ({ loadTeam: jest.fn() }));
jest.mock('@/app/features/organization/services/specialityService', () => ({
  loadSpecialitiesForOrg: jest.fn(),
}));
jest.mock('@/app/features/organization/services/roomService', () => ({
  loadRoomsForOrgPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  loadAppointmentsForPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/features/companions/services/companionService', () => ({
  loadCompanionsForPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/features/billing/services/invoiceService', () => ({
  loadInvoicesForOrgPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/features/tasks/services/taskService', () => ({
  loadTasksForPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/features/documents/services/documentService', () => ({
  loadDocumentsForOrgPrimaryOrg: jest.fn(),
}));
jest.mock('@/app/features/forms/services/formService', () => ({ loadForms: jest.fn() }));
jest.mock('@/app/hooks/useIntegrations', () => ({ loadIntegrationsForPrimaryOrg: jest.fn() }));

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
    expect(useFullscreenLoader).toHaveBeenCalledWith('session-initializer', true);
    expect(mockGetState).toHaveBeenCalled(); // checkSession triggered via effect
  });

  it('renders private children without a session when the auth guard is disabled (local UI mode)', () => {
    const original = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    mockUseAuthStore.mockImplementation((selector: any) => selector({ status: 'checking' }));

    try {
      render(
        <SessionInitializer>
          <div data-testid="child" />
        </SessionInitializer>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(useFullscreenLoader).toHaveBeenCalledWith('session-initializer', false);
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
      else process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = original;
    }
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
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(useFullscreenLoader).toHaveBeenCalledWith('session-initializer', false);
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

  describe('terminology rewriting', () => {
    const terminology = jest.requireMock('@/app/lib/companionTerminology');
    const identity = (text: string) => text;

    beforeEach(() => {
      // The suite-wide mock returns its input unchanged, which makes both
      // behaviours below unobservable - a rewriter that never fires and one
      // that fires correctly produce identical DOM. Substitute for real here so
      // the walk and the title are actually exercised.
      terminology.rewriteCompanionTerminologyText.mockImplementation((text: string) =>
        text.replace(/Companion/g, 'Patient').replace(/companion/g, 'patient')
      );
      mockUseAuthStore.mockImplementation((selector: any) => selector({ status: 'authenticated' }));
    });

    afterEach(() => {
      terminology.rewriteCompanionTerminologyText.mockImplementation(identity);
      document.title = '';
    });

    it('rewrites the browser tab title, which lives outside the observed root', () => {
      // Route metadata is static and server-rendered, so it cannot know the
      // org's term; the observer is rooted at document.body and never reaches
      // <head>. An org set to Patients had a tab reading Companions.
      document.title = 'Companions | Yosemite Crew';

      render(
        <SessionInitializer>
          <div data-testid="child" />
        </SessionInitializer>
      );

      expect(document.title).toBe('Patients | Yosemite Crew');
    });

    it('rewrites attributes on DESCENDANTS of an added node, not just the node itself', async () => {
      render(
        <SessionInitializer>
          <div data-testid="child" />
        </SessionInitializer>
      );

      // Mimic a modal mounting: the added node is the wrapper, and the control
      // carrying the term is nested inside it. Only the wrapper's own
      // attributes used to be rewritten, so "Upload companion photo" stayed raw
      // inside the Add patient modal.
      const host = document.createElement('div');
      host.innerHTML =
        '<div><button aria-label="Upload companion photo" title="Companion photo">' +
        '<span>Add companion</span></button></div>';
      document.body.append(host);

      const button = await screen.findByRole('button', { name: 'Upload patient photo' });
      expect(button).toHaveAttribute('title', 'Patient photo');
      expect(button.textContent).toBe('Add patient');

      host.remove();
    });

    it('leaves a terminology-locked subtree alone', async () => {
      render(
        <SessionInitializer>
          <div data-testid="child" />
        </SessionInitializer>
      );

      const host = document.createElement('div');
      host.innerHTML =
        '<div data-terminology-lock="true">' +
        '<button aria-label="Companion settings">Companion</button></div>';
      document.body.append(host);

      const locked = await screen.findByRole('button', { name: 'Companion settings' });
      expect(locked.textContent).toBe('Companion');

      host.remove();
    });
  });
});
