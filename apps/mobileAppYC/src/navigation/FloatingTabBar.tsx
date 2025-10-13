import React from 'react';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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

export const FloatingTabBar: React.FC<BottomTabBarProps> = props => {
  const {state, navigation} = props;
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const useGlass = Platform.OS !== 'ios' && isLiquidGlassSupported;
  const styles = React.useMemo(() => createStyles(theme, useGlass), [theme, useGlass]);

  const shouldHideTabBar = React.useMemo(() => {
    const traverse = (navState: any): boolean => {
      if (!navState) {
        return false;
      }
      if (typeof navState.index === 'number' && navState.index > 0) {
        return true;
      }
      const nestedRoute = navState.routes?.[navState.index ?? 0];
      if (nestedRoute?.state) {
        return traverse(nestedRoute.state);
      }
      return false;
    };

    const focusedRoute = state.routes[state.index] as any;
    return traverse(focusedRoute?.state);
  }, [state]);

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
          navigation.navigate(route.name);
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
    <View
      style={[
        styles.wrapper,
        {paddingBottom: Math.max(insets.bottom, 12)},
      ]}>
      <ContainerComponent
        style={styles.bar}
        {...(useGlass
          ? {
              blurAmount: 30,
              blurType: 'regular' as const,
              tintColor: 'light',
            }
          : {})}>
        {renderItems()}
      </ContainerComponent>
    </View>
  );
};

const createStyles = (theme: any, useGlass: boolean) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 16,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EAEAEA',
      backgroundColor: useGlass ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.95)',
      paddingVertical: 15,
      paddingHorizontal: 20,
      ...theme.shadows.xs,
      overflow: 'hidden',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    iconWrapper: {
      width: 32,
      height: 32,
      borderRadius: 16,
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
