import { renderHook } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { useNavigateToLegalPages } from '../../src/shared/hooks/useNavigateToLegalPages';

// --- Mocks ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

describe('useNavigateToLegalPages Hook', () => {
  // Helper to construct mock navigators with parent/child relationships
  const createMockNavigator = (
    name: string,
    routeNames: string[] = [],
    parent: any = null,
  ) => {
    return {
      name, // identifier for debugging
      getParent: jest.fn(() => parent),
      getState: jest.fn(() => ({ routeNames })),
      navigate: jest.fn(),
      popToTop: jest.fn(),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Primary Logic: Finding 'HomeStack' in tree
  // ===========================================================================

  it('navigates to TermsAndConditions using the current navigator if it owns "HomeStack"', () => {
    const mockNav = createMockNavigator('current', ['HomeStack']);
    (useNavigation as jest.Mock).mockReturnValue(mockNav);

    const { result } = renderHook(() => useNavigateToLegalPages());

    result.current.handleOpenTerms();

    // Should pop to top on current nav
    expect(mockNav.popToTop).toHaveBeenCalledTimes(1);
    // Should navigate using the found navigator
    expect(mockNav.navigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'TermsAndConditions',
    });
  });

  it('navigates to PrivacyPolicy using a parent navigator that owns "HomeStack"', () => {
    // Structure: Parent (has HomeStack) -> Child (current)
    const parentNav = createMockNavigator('parent', ['HomeStack']);
    const childNav = createMockNavigator('child', ['OtherRoute'], parentNav);

    (useNavigation as jest.Mock).mockReturnValue(childNav);

    const { result } = renderHook(() => useNavigateToLegalPages());

    result.current.handleOpenPrivacy();

    // Should pop on CURRENT nav
    expect(childNav.popToTop).toHaveBeenCalledTimes(1);
    // Should navigate on PARENT nav (because traversal found it)
    expect(parentNav.navigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'PrivacyPolicy',
    });
    // Current nav navigate should not be called
    expect(childNav.navigate).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // 2. Fallback Priority Logic (Root -> Tab -> Parent)
  // ===========================================================================

  it('falls back to rootNavigation if "HomeStack" is not found in traversal', () => {
    // Structure: Root -> Tab -> Child
    // "HomeStack" is NOT in routeNames, forcing `findNavigatorWithRoute` to return null.
    // Logic: find... ?? rootNavigation ?? ...
    const rootNav = createMockNavigator('root', ['RootRoute']);
    const tabNav = createMockNavigator('tab', ['TabRoute'], rootNav);
    const childNav = createMockNavigator('child', ['ChildRoute'], tabNav);

    (useNavigation as jest.Mock).mockReturnValue(childNav);

    const { result } = renderHook(() => useNavigateToLegalPages());

    result.current.handleOpenTerms();

    // Fallback #1: rootNavigation (derived from tabNavigation?.getParent())
    expect(rootNav.navigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'TermsAndConditions',
    });
    expect(tabNav.navigate).not.toHaveBeenCalled();
  });

  it('falls back to tabNavigation if rootNavigation is missing', () => {
    // Structure: Tab -> Child (Tab has no parent, so root is undefined)
    const tabNav = createMockNavigator('tab', ['TabRoute'], null);
    const childNav = createMockNavigator('child', ['ChildRoute'], tabNav);

    (useNavigation as jest.Mock).mockReturnValue(childNav);

    const { result } = renderHook(() => useNavigateToLegalPages());

    result.current.handleOpenTerms();

    // Fallback #2: tabNavigation (derived from navigation.getParent())
    expect(tabNav.navigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'TermsAndConditions',
    });
  });

  // ===========================================================================
  // 3. Safety & Edge Cases
  // ===========================================================================

  it('handles navigation gracefully when no valid navigator is found (all null)', () => {
    const isolatedNav = createMockNavigator('isolated', [], null);
    (useNavigation as jest.Mock).mockReturnValue(isolatedNav);

    const { result } = renderHook(() => useNavigateToLegalPages());

    // Should not crash even though no parent/root exists
    expect(() => result.current.handleOpenTerms()).not.toThrow();

    // popToTop still called on current
    expect(isolatedNav.popToTop).toHaveBeenCalled();
    // navigate never called because no valid 'nav' target resolved
    expect(isolatedNav.navigate).not.toHaveBeenCalled();
  });

  it('skips popToTop if the method does not exist', () => {
    const mockNav = createMockNavigator('current', ['HomeStack']);
    // Simulate popToTop being undefined (e.g. strict type mock or diff navigator type)
    // @ts-ignore
    mockNav.popToTop = undefined;
    (useNavigation as jest.Mock).mockReturnValue(mockNav);

    const { result } = renderHook(() => useNavigateToLegalPages());

    // Should proceed to navigate without throwing
    result.current.handleOpenTerms();
    expect(mockNav.navigate).toHaveBeenCalled();
  });

  it('handles traversal logic when state or routeNames are undefined (Branch Coverage)', () => {
    // Logic check: if (state?.routeNames?.includes(routeName))
    const navNoState = {
      getParent: jest.fn(() => null),
      getState: undefined, // undefined state
      navigate: jest.fn(),
    };

    const navNoRouteNames = {
      getParent: jest.fn(() => navNoState),
      getState: jest.fn(() => ({})), // state exists, but no routeNames
      navigate: jest.fn(),
    };

    (useNavigation as jest.Mock).mockReturnValue(navNoRouteNames);

    const { result } = renderHook(() => useNavigateToLegalPages());

    // Trigger action
    result.current.handleOpenTerms();

    // Verify traversal happened (called getParent on child)
    expect(navNoRouteNames.getParent).toHaveBeenCalled();
    // Verify it didn't crash on undefined state
    expect(navNoState.getParent).toHaveBeenCalled();
  });
});