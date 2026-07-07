import React, {useEffect as useReactEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import {LiquidGlassView, isLiquidGlassSupported} from '@callstack/liquid-glass';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import type {RootState, AppDispatch} from '@/app/store';
import {fetchDocuments} from '@/features/documents/documentSlice';
import {fetchTasksForCompanion} from '@/features/tasks';

type BottomTabBarProps =
  import('@react-navigation/bottom-tabs').BottomTabBarProps;

const ICON_MAP: Record<
  string,
  {label: string; iconKey: keyof typeof Images.navigation}
> = {
  HomeStack: {label: 'Home', iconKey: 'home'},
  Appointments: {label: 'Bookings', iconKey: 'appointments'},
  Documents: {label: 'Docs', iconKey: 'documents'},
  Tasks: {label: 'Tasks', iconKey: 'tasks'},
};

const ROOT_ROUTE_MAP: Record<string, string> = {
  HomeStack: 'Home',
  Appointments: 'MyAppointments',
  Documents: 'DocumentsMain',
  Tasks: 'TasksMain',
  AdverseEvent: 'Landing',
};

interface TabLayout {
  x: number;
  width: number;
}

export const FloatingTabBar: React.FC<BottomTabBarProps> = props => {
  const {state, navigation} = props;
  const {theme} = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const companions = useSelector((s: RootState) => s.companion.companions);
  const selectedCompanionIdFromState = useSelector(
    (s: RootState) => s.companion.selectedCompanionId,
  );
  const companionId = selectedCompanionIdFromState ?? companions[0]?.id ?? null;
  const isIOS = Platform.OS === 'ios';
  const useGlass = isIOS && isLiquidGlassSupported;
  const styles = React.useMemo(
    () => createStyles(theme, isIOS),
    [theme, isIOS],
  );

  const refreshTabData = React.useCallback(
    (routeName: string) => {
      if (!companionId) {
        return;
      }
      if (routeName === 'Documents') {
        dispatch(fetchDocuments({companionId}));
      }
      if (routeName === 'Tasks') {
        dispatch(fetchTasksForCompanion({companionId}));
      }
    },
    [companionId, dispatch],
  );

  const pillTranslateX = useSharedValue(0);
  const pillScale = useSharedValue(1);
  const [tabLayouts, setTabLayouts] = useState<TabLayout[]>([]);
  const isReady =
    tabLayouts.length > 0 && tabLayouts.length === state.routes.length;
  const activePillWidth = isReady ? (tabLayouts[state.index]?.width ?? 0) : 0;
  const hasInitializedRef = useRef(false);

  // Calculate if tab bar should be hidden based on nested navigation
  const shouldHideTabBar = (() => {
    const focusedRoute = state.routes[state.index];
    if (!focusedRoute) {
      return false;
    }

    const rootScreenName = ROOT_ROUTE_MAP[focusedRoute.name];
    if (!rootScreenName) {
      return false;
    }

    const nestedState = focusedRoute.state;
    const nestedStateIndex = nestedState?.index ?? 0;
    const nestedRouteName =
      getFocusedRouteNameFromRoute(focusedRoute) ??
      nestedState?.routeNames?.[nestedStateIndex] ??
      (typeof focusedRoute.params === 'object'
        ? (focusedRoute.params as {screen?: string})?.screen
        : undefined);

    if (!nestedRouteName) {
      return false;
    }

    return nestedRouteName !== rootScreenName;
  })();

  // Handle tab layout measurements
  const onTabLayout = (index: number, event: LayoutChangeEvent) => {
    const {x, width} = event.nativeEvent.layout;
    setTabLayouts(prev => {
      const newLayouts = [...prev];
      newLayouts[index] = {x, width};
      return newLayouts;
    });
  };

  // Animate pill to active tab
  useReactEffect(() => {
    const activeTabLayout = tabLayouts[state.index];
    if (!activeTabLayout || tabLayouts.length !== state.routes.length) {
      return;
    }

    if (hasInitializedRef.current) {
      // Bouncy spring animation with scale wiggle effect
      pillTranslateX.value = withSpring(activeTabLayout.x, {
        damping: 12,
        stiffness: 180,
        velocity: 3,
      });
      pillScale.value = withSequence(
        withSpring(1.15, {damping: 16, stiffness: 320}),
        withSpring(1, {damping: 12, stiffness: 180}),
      );
    } else {
      // Initial position - no animation
      pillTranslateX.value = activeTabLayout.x;
      pillScale.value = 1;
      hasInitializedRef.current = true;
    }
  }, [state.index, tabLayouts, pillTranslateX, pillScale, state.routes.length]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: pillTranslateX.value},
      {scaleX: pillScale.value},
      {scaleY: pillScale.value},
    ],
  }));

  useReactEffect(() => {
    const activeRoute = state.routes[state.index];
    if (activeRoute) {
      refreshTabData(activeRoute.name);
    }
  }, [refreshTabData, state.index, state.routes]);

  if (shouldHideTabBar) {
    return null;
  }

  const buildSlidingPill = () => {
    if (!isReady) {
      return null;
    }

    return (
      <Animated.View
        style={[
          styles.pillContainer,
          {width: activePillWidth},
          pillAnimatedStyle,
        ]}>
        {useGlass ? (
          <LiquidGlassView
            style={styles.pillGlass}
            effect="clear"
            tintColor={theme.colors.secondary}
            colorScheme="light"
            interactive
          />
        ) : (
          <View style={[styles.pillGlass, styles.pillSolid]} />
        )}
      </Animated.View>
    );
  };

  const buildTabs = () =>
    state.routes.map((route, index) => {
      const config = ICON_MAP[route.name] ?? {
        label: route.name,
        iconKey: 'home',
      };
      const isFocused = state.index === index;

      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
          const rootScreen = ROOT_ROUTE_MAP[route.name];
          refreshTabData(route.name);
          if (rootScreen) {
            navigation.navigate(route.name, {screen: rootScreen});
          } else {
            navigation.navigate(route.name);
          }
        }
      };

      return (
        <PressableOpacity
          key={route.key}
          accessibilityRole="button"
          accessibilityState={isFocused ? {selected: true} : {}}
          onPress={onPress}
          activeOpacity={0.7}
          style={styles.tabItem}
          onLayout={event => onTabLayout(index, event)}>
          <View style={styles.iconWrapper}>
            <Image
              source={
                isFocused
                  ? Images.navigation[config.iconKey].focused
                  : Images.navigation[config.iconKey].light
              }
              style={[styles.iconImage, isFocused && styles.iconImageActive]}
              resizeMode="contain"
            />
          </View>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.label,
              isFocused ? styles.labelActive : styles.labelInactive,
            ]}>
            {config.label}
          </Text>
        </PressableOpacity>
      );
    });

  const BarComponent = useGlass ? LiquidGlassView : View;

  return (
    <View style={styles.wrapper}>
      <View style={styles.shadowContainer}>
        <View
          style={[
            styles.shadowWrapper,
            !useGlass && styles.shadowWrapperSolid,
          ]}>
          <BarComponent
            style={[styles.bar, useGlass ? styles.barGlass : styles.barSolid]}
            {...(useGlass
              ? {
                  effect: 'clear' as const,
                  tintColor: theme.colors.whiteOverlay70,
                  colorScheme: 'light' as const,
                  interactive: false,
                }
              : {})}>
            {buildSlidingPill()}
            {buildTabs()}
          </BarComponent>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: any, isIOS: boolean) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: theme.spacing['6'],
      right: theme.spacing['6'],
      bottom: theme.spacing['11'],
      zIndex: 10,
      overflow: 'visible',
    },
    shadowContainer: {
      backgroundColor: 'transparent',
      overflow: 'visible',
    },
    shadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: 'transparent',
      overflow: 'visible',
      boxShadow: `0px 1px 3px ${theme.colors.neutralShadow}`,
    },
    shadowWrapperSolid: {
      backgroundColor: 'transparent',
    },
    bar: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      borderRadius: isIOS ? theme.borderRadius.md : theme.borderRadius.xl,
      backgroundColor: 'transparent',
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['4'],
      overflow: 'visible',
    },
    barGlass: {
      backgroundColor: 'transparent',
    },
    barSolid: {
      backgroundColor: theme.colors.cardOverlay,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
    },
    pillContainer: {
      position: 'absolute',
      top: theme.spacing['2'],
      bottom: theme.spacing['2'],
      zIndex: 2,
    },
    pill: {
      flex: 1,
      borderRadius: theme.borderRadius.xl,
      backgroundColor: theme.colors.secondary,
    },
    pillGlass: {
      flex: 1,
      borderRadius: isIOS ? theme.borderRadius.lg : theme.borderRadius['2xl'],
      backgroundColor: 'transparent',
    },
    pillSolid: {
      backgroundColor: theme.colors.secondary,
    },
    invisiblePill: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['1.25'],
      zIndex: 3,
      paddingVertical: theme.spacing['2'],
      paddingHorizontal: theme.spacing['2'],
    },
    iconWrapper: {
      width: theme.spacing['7'],
      height: theme.spacing['7'],
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconWrapperActive: {},
    label: {
      ...theme.typography.tabLabel,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      maxWidth: '100%',
    },
    labelActive: {
      ...theme.typography.tabLabelFocused,
      color: theme.colors.white,
    },
    labelInactive: {
      ...theme.typography.tabLabel,
      color: theme.colors.textSecondary,
    },
    iconImage: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      tintColor: theme.colors.textSecondary,
    },
    iconImageActive: {
      tintColor: theme.colors.white,
    },
  });
