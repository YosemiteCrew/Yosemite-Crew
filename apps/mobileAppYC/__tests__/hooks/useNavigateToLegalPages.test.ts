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

  it('navigates with the current navigator when it contains the target screen', () => {
    const parentNav = createMockNavigator('parent', ['HomeStack']);
    const currentNav = createMockNavigator('current', ['TermsAndConditions'], parentNav);
    (useNavigation as jest.Mock).mockReturnValue(currentNav);

    const {result} = renderHook(() => useNavigateToLegalPages());

    result.current.handleOpenTerms();

    expect(currentNav.navigate).toHaveBeenCalledWith('TermsAndConditions');
    expect(parentNav.navigate).not.toHaveBeenCalled();
  });

  it('navigates with a parent navigator when it owns the target screen', () => {
    const parentNav = createMockNavigator('parent', ['PrivacyPolicy']);
    const childNav = createMockNavigator('child', ['OtherRoute'], parentNav);
    (useNavigation as jest.Mock).mockReturnValue(childNav);

    const {result} = renderHook(() => useNavigateToLegalPages());

    result.current.handleOpenPrivacy();

    expect(parentNav.navigate).toHaveBeenCalledWith('PrivacyPolicy');
    expect(childNav.navigate).not.toHaveBeenCalled();
  });

  it('falls back to navigating through HomeStack when the screen is missing but HomeStack exists', () => {
    const rootNav = createMockNavigator('root', ['RootRoute']);
    const tabNav = createMockNavigator('tab', ['HomeStack'], rootNav);
    const childNav = createMockNavigator('child', ['ChildRoute'], tabNav);

    (useNavigation as jest.Mock).mockReturnValue(childNav);

    const {result} = renderHook(() => useNavigateToLegalPages());

    result.current.handleOpenTerms();

    expect(tabNav.navigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'TermsAndConditions',
    });
    expect(rootNav.navigate).not.toHaveBeenCalled();
    expect(childNav.navigate).not.toHaveBeenCalledWith('TermsAndConditions');
  });

  it('falls back to the highest available navigator when no matching routes exist', () => {
    const rootNav = createMockNavigator('root', ['RootRoute']);
    const tabNav = createMockNavigator('tab', ['TabRoute'], rootNav);
    const childNav = createMockNavigator('child', ['ChildRoute'], tabNav);

    (useNavigation as jest.Mock).mockReturnValue(childNav);

    const {result} = renderHook(() => useNavigateToLegalPages());

    result.current.handleOpenPrivacy();

    expect(rootNav.navigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'PrivacyPolicy',
    });
    expect(tabNav.navigate).not.toHaveBeenCalledWith('HomeStack', expect.anything());
  });

  it('handles traversal when state or routeNames are undefined without throwing', () => {
    const navNoState = {
      getParent: jest.fn(() => null),
      getState: undefined,
      navigate: jest.fn(),
    };

    const navNoRouteNames = {
      getParent: jest.fn(() => navNoState),
      getState: jest.fn(() => ({})),
      navigate: jest.fn(),
    };

    (useNavigation as jest.Mock).mockReturnValue(navNoRouteNames);

    const {result} = renderHook(() => useNavigateToLegalPages());

    expect(() => result.current.handleOpenTerms()).not.toThrow();
    expect(navNoRouteNames.getParent).toHaveBeenCalled();
    expect(navNoState.getParent).toHaveBeenCalled();
    expect(navNoState.navigate).not.toHaveBeenCalled();
  });
});
