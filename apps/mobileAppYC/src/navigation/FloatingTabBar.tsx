import React, {useEffect, useRef, useState} from 'react';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {
  getFocusedRouteNameFromRoute,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import {
  Animated,
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {LiquidGlassView, isLiquidGlassSupported} from '@callstack/liquid-glass';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

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
  const useGlass = Platform.OS === 'ios' && isLiquidGlassSupported;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Animated values for sliding pill - using JS driver for both since we need width
  const pillLeft = useRef(new Animated.Value(0)).current;
  const pillWidth = useRef(new Animated.Value(0)).current;
  const pillScale = useRef(new Animated.Value(1)).current;
  const [tabLayouts, setTabLayouts] = useState<TabLayout[]>([]);
  const [isReady, setIsReady] = useState(false);

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

    const nestedState = focusedRoute.state as
      | NavigationState
      | PartialState<NavigationState>
      | undefined;
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
  useEffect(() => {
    const activeTabLayout = tabLayouts[state.index];
    if (!activeTabLayout || tabLayouts.length !== state.routes.length) {
      return;
    }

    if (!isReady) {
      // Initial position - no animation
      pillLeft.setValue(activeTabLayout.x);
      pillWidth.setValue(activeTabLayout.width);
      pillScale.setValue(1);
      setIsReady(true);
    } else {
      // Bouncy spring animation with scale wiggle effect
      Animated.parallel([
        // Position and width with extra bounce
        Animated.spring(pillLeft, {
          toValue: activeTabLayout.x,
          useNativeDriver: false,
          tension: 40,
          friction: 6,
          velocity: 3,
        }),
        Animated.spring(pillWidth, {
          toValue: activeTabLayout.width,
          useNativeDriver: false,
          tension: 40,
          friction: 6,
          velocity: 3,
        }),
        // Scale up then down for wiggle effect
        Animated.sequence([
          Animated.spring(pillScale, {
            toValue: 1.15,
            useNativeDriver: false,
            tension: 300,
            friction: 10,
          }),
          Animated.spring(pillScale, {
            toValue: 1,
            useNativeDriver: false,
            tension: 80,
            friction: 8,
          }),
        ]),
      ]).start();
    }
  }, [
    state.index,
    tabLayouts,
    isReady,
    pillLeft,
    pillWidth,
    pillScale,
    state.routes.length,
  ]);

  if (shouldHideTabBar) {
    return null;
  }

  const renderSlidingPill = () => {
    if (!isReady) {
      return null;
    }

    return (
      <Animated.View
        style={[
          styles.pillContainer,
          {
            left: pillLeft,
            width: pillWidth,
            transform: [{scaleX: pillScale}, {scaleY: pillScale}],
          },
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
          <View style={styles.pillGlass} />
        )}
      </Animated.View>
    );
  };

  const renderTabs = () =>
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
          if (rootScreen) {
            navigation.navigate(route.name, {screen: rootScreen});
          } else {
            navigation.navigate(route.name);
          }
        }
      };

      return (
        <TouchableOpacity
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
        </TouchableOpacity>
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
            style={[styles.bar, useGlass && styles.barGlass]}
            {...(useGlass
              ? {
                  effect: 'clear' as const,
                  tintColor: 'rgba(255, 255, 255, 0.5)',
                  colorScheme: 'light' as const,
                  interactive: false,
                }
              : {})}>
            {renderSlidingPill()}
            {renderTabs()}
          </BarComponent>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 45,
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
    },
    shadowWrapperSolid: {
      backgroundColor: theme.colors.white,
    },
    bar: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: 'transparent',
      paddingVertical: 14,
      paddingHorizontal: 16,
      overflow: 'visible',
    },
    barGlass: {
      backgroundColor: 'transparent',
    },
    pillContainer: {
      position: 'absolute',
      top: 8,
      bottom: 8,
      zIndex: 2,
    },
    pill: {
      flex: 1,
      borderRadius: theme.borderRadius.xl,
      backgroundColor: theme.colors.secondary,
    },
    pillGlass: {
      flex: 1,
      borderRadius: theme.borderRadius.xl,
      backgroundColor: 'transparent',
    },
    invisiblePill: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      zIndex: 3,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    iconWrapper: {
      width: 28,
      height: 28,
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconWrapperActive: {},
    label: {
      ...theme.typography.tabLabel,
      textAlign: 'center',
      color: theme.colors.text,
      maxWidth: '100%',
    },
    labelActive: {
      ...theme.typography.tabLabelFocused,
      color: theme.colors.white,
    },
    labelInactive: {
      ...theme.typography.tabLabel,
      color: theme.colors.text,
    },
    iconImage: {
      width: 20,
      height: 20,
      tintColor: theme.colors.textSecondary,
    },
    iconImageActive: {
      tintColor: theme.colors.white,
    },
  });
