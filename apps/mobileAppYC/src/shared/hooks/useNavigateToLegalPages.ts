import {useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';

/**
 * Hook for navigating to terms and privacy policy pages
 * Handles complex navigation stack traversal needed to reach HomeStack
 */
export const useNavigateToLegalPages = () => {
  const navigation = useNavigation();
  const tabNavigation = navigation.getParent?.();
  const rootNavigation = tabNavigation?.getParent?.();

  const findNavigatorWithRoute = useCallback((routeName: string) => {
    let nav: any = navigation;
    while (nav) {
      const state = nav.getState?.();
      if (state?.routeNames?.includes(routeName)) {
        return nav as NavigationProp<any>;
      }
      nav = nav.getParent?.();
    }
    return null;
  }, [navigation]);

  const navigateToRoute = useCallback(
    (screen: 'TermsAndConditions' | 'PrivacyPolicy') => {
      // Don't pop the current stack - we want to preserve the navigation history
      // so users can return to where they were (e.g., BookingFormScreen)
      const nav =
        findNavigatorWithRoute('HomeStack') ??
        rootNavigation ??
        tabNavigation ??
        (navigation as any).getParent?.();
      nav?.navigate?.('HomeStack', {screen});
    },
    [findNavigatorWithRoute, navigation, rootNavigation, tabNavigation],
  );

  const handleOpenTerms = useCallback(
    () => navigateToRoute('TermsAndConditions'),
    [navigateToRoute],
  );

  const handleOpenPrivacy = useCallback(
    () => navigateToRoute('PrivacyPolicy'),
    [navigateToRoute],
  );

  return {
    handleOpenTerms,
    handleOpenPrivacy,
  };
};
