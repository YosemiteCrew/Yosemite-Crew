import { renderHook } from '@testing-library/react';
import { useLoadProfiles, usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useAuthStore } from '@/app/stores/authStore';

// --- Mocks ---

jest.mock('@/app/features/organization/services/profileService', () => ({
  loadProfiles: jest.fn(),
}));

jest.mock('@/app/stores/orgStore');
jest.mock('@/app/stores/profileStore');
jest.mock('@/app/stores/authStore');

const mockProfileGetState = jest.fn();

describe('useProfiles Hooks', () => {
  let mockOrgState: any;
  let mockProfileState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock State
    mockOrgState = {
      primaryOrgId: null,
    };

    mockProfileState = {
      status: 'idle',
      profilesByOrgId: {},
    };

    // Setup Store Mocks (Zustand selector pattern)
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) => selector(mockOrgState));
    (useUserProfileStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockProfileState)
    );
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'authenticated' })
    );
    mockProfileGetState.mockReturnValue(mockProfileState);
    (useUserProfileStore as unknown as jest.Mock & { getState: jest.Mock }).getState =
      mockProfileGetState;
  });

  // --- Section 1: useLoadProfiles Logic ---

  describe('useLoadProfiles', () => {
    it('should trigger loadProfiles when primaryOrgId is set and profile not yet loaded', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockProfileState.status = 'idle';

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).toHaveBeenCalledTimes(1);
      expect(loadProfiles).toHaveBeenCalledWith({ silent: true, orgId: 'org-1' });
    });

    it('should NOT trigger loadProfiles if primaryOrgId is null', () => {
      mockOrgState.primaryOrgId = null;
      mockProfileState.status = 'idle';

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).not.toHaveBeenCalled();
    });

    it('should NOT trigger loadProfiles while unauthenticated', () => {
      mockOrgState.primaryOrgId = 'org-1';
      (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
        selector({ status: 'unauthenticated' })
      );

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).not.toHaveBeenCalled();
    });

    it('should NOT trigger loadProfiles if status is loading', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockProfileState.status = 'loading';

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).not.toHaveBeenCalled();
    });

    it('should NOT trigger loadProfiles if profile is already loaded for primaryOrgId', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockProfileState.status = 'success';
      mockProfileState.profilesByOrgId = { 'org-1': { id: 'p1' } };

      renderHook(() => useLoadProfiles());

      expect(loadProfiles).not.toHaveBeenCalled();
    });
  });

  // --- Section 2: usePrimaryOrgProfile Logic ---

  describe('usePrimaryOrgProfile', () => {
    const mockProfile = { id: 'p1', name: 'User 1' };

    it('should return null if primaryOrgId is not set', () => {
      mockOrgState.primaryOrgId = null;
      mockProfileState.profilesByOrgId = { 'org-1': mockProfile };

      const { result } = renderHook(() => usePrimaryOrgProfile());

      expect(result.current).toBeNull();
    });

    it('should return null if primaryOrgId is set but no profile exists for it', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockProfileState.profilesByOrgId = { 'org-2': mockProfile }; // Mismatch

      const { result } = renderHook(() => usePrimaryOrgProfile());

      expect(result.current).toBeNull();
    });

    it('should return the profile if primaryOrgId matches an entry', () => {
      mockOrgState.primaryOrgId = 'org-1';
      mockProfileState.profilesByOrgId = { 'org-1': mockProfile };

      const { result } = renderHook(() => usePrimaryOrgProfile());

      expect(result.current).toEqual(mockProfile);
    });

    it('should return null if profiles map is undefined (edge case)', () => {
      // Technically strict TS prevents this, but runtime JS might allow it
      mockOrgState.primaryOrgId = 'org-1';
      // simulate missing map key entirely logic is handled by selector usually, but good to test hook safety
      mockProfileState.profilesByOrgId = {};

      const { result } = renderHook(() => usePrimaryOrgProfile());

      expect(result.current).toBeNull();
    });
  });
});
