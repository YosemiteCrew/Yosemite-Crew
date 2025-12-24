import React from 'react';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {
  getFocusedRouteNameFromRoute,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import {
  Image,
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
  Appointments: {label: 'Appointments', iconKey: 'appointments'},
  Documents: {label: 'Documents', iconKey: 'documents'},
  Tasks: {label: 'Tasks', iconKey: 'tasks'},
};

const ROOT_ROUTE_MAP: Record<string, string> = {
  HomeStack: 'Home',
  Appointments: 'MyAppointments',
  Documents: 'DocumentsMain',
  Tasks: 'TasksMain',
  AdverseEvent: 'Landing',
};
const TAB_BAR_GLASS_TINT = 'rgba(255, 255, 255, 0.7)';

export const FloatingTabBar: React.FC<BottomTabBarProps> = props => {
  const {state, navigation} = props;
  const {theme} = useTheme();
  const useGlass = Platform.OS === 'ios' && isLiquidGlassSupported;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

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

  if (shouldHideTabBar) {
    return null;
  }

  const renderItems = () =>
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
          activeOpacity={0.85}
          style={styles.tabItem}>
          <View
            style={[
              styles.iconWrapper,
              isFocused && styles.iconWrapperActive,
            ]}>
            <Image
              source={
                isFocused
                  ? Images.navigation[config.iconKey].focused
                  : Images.navigation[config.iconKey].light
              }
              style={styles.iconImage}
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

  const ContainerComponent = useGlass ? LiquidGlassView : View;

  return (
    <View style={styles.wrapper}>
      <ContainerComponent
        style={[styles.bar, useGlass && styles.barGlass]}
        {...(useGlass
          ? {
              effect: 'regular' as const,
              tintColor: TAB_BAR_GLASS_TINT,
              colorScheme: 'light' as const,
            }
          : {})}>
        {renderItems()}
      </ContainerComponent>
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
      ...theme.shadows.floatingMd,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.white,
      paddingVertical: 15,
      paddingHorizontal: 20,
      overflow: 'hidden',
    },
    barGlass: {
      backgroundColor: 'transparent',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    iconWrapper: {
      width: 32,
      height: 32,
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconWrapperActive: {},
    label: {
      textAlign: 'center',
      ...theme.typography.tabLabel,
      color: theme.colors.textSecondary,
    },
    labelActive: {
      ...theme.typography.tabLabelFocused,
      color: theme.colors.secondary,
    },
    labelInactive: {
      color: theme.colors.textSecondary,
    },
    iconImage: {
      width: 20,
      height: 20,
    },
  });
