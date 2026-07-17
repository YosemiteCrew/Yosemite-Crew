import { renderHook } from '@testing-library/react';
import { usePhoneNavGate } from '@/app/ui/layout/PhoneShell/usePhoneNavGate';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePrimaryOrg } from '@/app/hooks/useOrgSelectors';
import { startRouteLoader, stopRouteLoader } from '@/app/lib/routeLoader';
import { PERMISSIONS } from '@/app/lib/permissions';

const mockUsePathname = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/hooks/useOrgSelectors', () => ({ usePrimaryOrg: jest.fn() }));
jest.mock('@/app/lib/routeLoader', () => ({
  startRouteLoader: jest.fn(),
  stopRouteLoader: jest.fn(),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUsePrimaryOrg = usePrimaryOrg as unknown as jest.Mock;

const setupStore = (
  primaryOrgId: string | null,
  effectivePermissions: string[] = Object.values(PERMISSIONS)
) => {
  mockUseOrgStore.mockImplementation((selector: any) =>
    selector({
      primaryOrgId,
      membershipsByOrgId: primaryOrgId ? { [primaryOrgId]: { effectivePermissions } } : {},
    })
  );
};

describe('usePhoneNavGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
  });

  it('enables all routes for a verified org with full permissions', () => {
    setupStore('org-1');
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', isVerified: true });

    const { result } = renderHook(() => usePhoneNavGate());
    expect(result.current.isRouteEnabled('Appointments')).toBe(true);
    expect(result.current.isRouteEnabled('Organization')).toBe(true);
    // Unknown / sheet-only entries (undefined route name) stay enabled.
    expect(result.current.isRouteEnabled()).toBe(true);
    expect(result.current.isRouteEnabled('Nonexistent')).toBe(true);
  });

  it('disables verification-gated routes for an unverified org but keeps Settings', () => {
    setupStore('org-1');
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', isVerified: false });

    const { result } = renderHook(() => usePhoneNavGate());
    expect(result.current.isRouteEnabled('Appointments')).toBe(false);
    expect(result.current.isRouteEnabled('Organization')).toBe(true); // verify: false
    expect(result.current.isRouteEnabled('Settings')).toBe(true);
  });

  it('disables everything but Settings when no org is present', () => {
    setupStore(null);
    mockUsePrimaryOrg.mockReturnValue(null);

    const { result } = renderHook(() => usePhoneNavGate());
    expect(result.current.isRouteEnabled('Organization')).toBe(false);
    expect(result.current.isRouteEnabled('Appointments')).toBe(false);
    expect(result.current.isRouteEnabled('Settings')).toBe(true);
  });

  it('disables permission-gated routes when the permission is missing', () => {
    setupStore('org-1', []);
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', isVerified: true });

    const { result } = renderHook(() => usePhoneNavGate());
    expect(result.current.isRouteEnabled('Dashboard')).toBe(false); // needs ANALYTICS_VIEW_ANY
    expect(result.current.isRouteEnabled('Organization')).toBe(true); // no required permission
  });

  it('handles a missing or permission-less membership without throwing', () => {
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', isVerified: true });

    // primaryOrgId is set but no membership entry exists -> resolves to null.
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1', membershipsByOrgId: {} })
    );
    const missing = renderHook(() => usePhoneNavGate());
    expect(missing.result.current.isRouteEnabled('Dashboard')).toBe(false);

    // membership object exists but carries no effectivePermissions array.
    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({ primaryOrgId: 'org-1', membershipsByOrgId: { 'org-1': {} } })
    );
    const empty = renderHook(() => usePhoneNavGate());
    expect(empty.result.current.isRouteEnabled('Dashboard')).toBe(false);
    expect(empty.result.current.isRouteEnabled('Organization')).toBe(true);

    // membershipsByOrgId map entirely absent from the store.
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    const absent = renderHook(() => usePhoneNavGate());
    expect(absent.result.current.isRouteEnabled('Dashboard')).toBe(false);
  });

  it('treats every route as enabled inside the developer portal', () => {
    mockUsePathname.mockReturnValue('/developers/home');
    setupStore('org-1', []);
    mockUsePrimaryOrg.mockReturnValue(null);

    const { result } = renderHook(() => usePhoneNavGate());
    expect(result.current.isDevPortal).toBe(true);
    expect(result.current.isRouteEnabled('Appointments')).toBe(true);
  });

  it('reports active state for a matching pathname prefix', () => {
    mockUsePathname.mockReturnValue('/appointments/123');
    setupStore('org-1');
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', isVerified: true });

    const { result } = renderHook(() => usePhoneNavGate());
    expect(result.current.isActive(['/appointments'])).toBe(true);
    expect(result.current.isActive(['/dashboard'])).toBe(false);
  });

  it('navigates with the route loader only when the target differs', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    setupStore('org-1');
    mockUsePrimaryOrg.mockReturnValue({ _id: 'org-1', isVerified: true });

    const { result } = renderHook(() => usePhoneNavGate());

    result.current.navigate('/appointments');
    expect(startRouteLoader).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/appointments');

    result.current.navigate('/dashboard'); // same route
    expect(stopRouteLoader).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);

    result.current.navigate(); // no href
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
