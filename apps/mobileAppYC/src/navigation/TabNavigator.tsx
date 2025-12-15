import React from 'react';
import {Alert, Platform, ToastAndroid, View, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {TabParamList} from './types';
import AppointmentStackNavigator from './AppointmentStackNavigator';
import {HomeStackNavigator} from './HomeStackNavigator';
import {DocumentStackNavigator} from './DocumentStackNavigator';
import {TaskStackNavigator} from './TaskStackNavigator';
import {FloatingTabBar} from './FloatingTabBar';
import {useTheme} from '../hooks';
import {StackActions} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {selectSelectedCompanionId} from '@/features/companion';
import type {RootState} from '@/app/store';
import {
  type CoParentPermissions,
  type ParentCompanionAccess,
} from '@/features/coParent';
import {GifLoader} from '@/shared/components/common';
import {
  GlobalLoaderProvider,
  useGlobalLoader,
} from '@/context/GlobalLoaderContext';
type NestedNavState = {
  key?: string;
  index?: number;
  routes: Array<{ name: string }>;
};

const isNestedState = (s: unknown): s is NestedNavState =>
  !!s && typeof s === 'object' && Array.isArray((s as any).routes);

const Tab = createBottomTabNavigator<TabParamList>();

const renderFloatingTabBar = (props: BottomTabBarProps) => (
  <FloatingTabBar {...props} />
);

const createTabPressListener = (
  navigation: any,
  route: {name: keyof TabParamList},
  guard?: () => boolean,
) => ({
  tabPress: (e: any) => {
    if (guard && !guard()) {
      e.preventDefault();
      return;
    }
    const state = navigation.getState();
    const targetIndex = state.routes.findIndex((r: any) => r.name === route.name);
    const isFocused = state.index === targetIndex;
    const tabRoute = state.routes[targetIndex];
    const nestedState = tabRoute && 'state' in tabRoute ? tabRoute.state : null;

    // Only intercept when the tab is already focused; otherwise let it switch normally
    if (isFocused && isNestedState(nestedState) && nestedState.routes.length > 1) {
      e.preventDefault();
      // Pop to top of the nested stack (target that stack specifically)
      const targetKey = nestedState.key;
      if (targetKey) {
        navigation.dispatch({
          ...StackActions.popToTop(),
          target: targetKey,
        });
      } else {
        navigation.dispatch(
          StackActions.popToTop()
        );
      }
      return;
    }

    // If nested stack has exactly 1 route but it's not the initial screen,
    // navigate to the known initial route for that tab.
    if (isFocused && isNestedState(nestedState) && nestedState.routes.length === 1) {
      const currentRouteName = nestedState.routes[nestedState.index || 0]?.name;
      // Map of tab name -> initial screen name of its stack
      const initialByTab: Partial<Record<keyof TabParamList, string>> = {
        Tasks: 'TasksMain',
        Appointments: 'MyAppointments',
      };
      const expectedInitial = initialByTab[route.name];
      if (expectedInitial && currentRouteName && currentRouteName !== expectedInitial) {
        e.preventDefault();
        navigation.navigate(route.name, {screen: expectedInitial});
      }
    }
  },
});

const EMPTY_ACCESS_MAP: Record<string, ParentCompanionAccess> = {};

const TabNavigatorInner: React.FC = () => {
  const {theme} = useTheme();
  const {isLoading: showGlobalLoader} = useGlobalLoader();
  const selectedCompanionId = useSelector(selectSelectedCompanionId);
  const hasCompanions = useSelector(
    (state: RootState) => (state.companion?.companions?.length ?? 0) > 0,
  );
  const accessMap = useSelector(
    (state: RootState) => state.coParent?.accessByCompanionId ?? EMPTY_ACCESS_MAP,
  );
  const defaultAccess = useSelector((state: RootState) => state.coParent?.defaultAccess ?? null);
  const globalRole = useSelector((state: RootState) => state.coParent?.lastFetchedRole);
  const globalPermissions = useSelector(
    (state: RootState) => state.coParent?.lastFetchedPermissions,
  );
  const accessForCompanion =
    selectedCompanionId && accessMap
      ? accessMap[selectedCompanionId] ?? null
      : null;
  const role = (accessForCompanion?.role ?? defaultAccess?.role ?? globalRole ?? '').toUpperCase();
  const isPrimaryParent = role.includes('PRIMARY');
  const canAccessFeature = React.useCallback(
    (permission: keyof CoParentPermissions) => {
      if (!hasCompanions || isPrimaryParent) {
        return true;
      }
      const permissions =
        accessForCompanion?.permissions ?? defaultAccess?.permissions ?? globalPermissions;
      if (!permissions) {
        return false;
      }
      return Boolean(permissions[permission]);
    },
    [
      accessForCompanion?.permissions,
      defaultAccess?.permissions,
      globalPermissions,
      hasCompanions,
      isPrimaryParent,
    ],
  );
  const guardTab = React.useCallback(
    (permission: keyof CoParentPermissions, label: string) => () => {
      if (!canAccessFeature(permission)) {
        const message = `You don't have access to ${label}. Ask the primary parent to enable it.`;
        if (Platform.OS === 'android') {
          ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
          Alert.alert('Permission needed', message);
        }
        return false;
      }
      return true;
    },
    [canAccessFeature],
  );

  return (
    <View style={styles.container}>
      <Tab.Navigator
        tabBar={renderFloatingTabBar}
        screenOptions={{
          headerStyle: {backgroundColor: theme.colors.background},
          headerShadowVisible: false,
          headerTintColor: theme.colors.secondary,
          headerTitleStyle: {
            fontFamily: theme.typography.screenTitle.fontFamily,
            fontSize: theme.typography.screenTitle.fontSize,
            fontWeight: theme.typography.screenTitle.fontWeight,
          },
        }}>
        <Tab.Screen
          name="HomeStack"
          component={HomeStackNavigator}
          options={{headerShown: false}}
        />
        <Tab.Screen
          name="Appointments"
          component={AppointmentStackNavigator}
          options={{headerShown: false}}
          listeners={({navigation, route}) =>
            createTabPressListener(
              navigation,
              route,
              guardTab('appointments', 'appointments'),
            )
          }
        />
        <Tab.Screen
          name="Documents"
          component={DocumentStackNavigator}
          options={{headerShown: false}}
          listeners={({navigation, route}) =>
            createTabPressListener(
              navigation,
              route,
              guardTab('documents', 'documents'),
            )
          }
        />
        <Tab.Screen
          name="Tasks"
          component={TaskStackNavigator}
          options={{headerShown: false, popToTopOnBlur: true}}
          listeners={({navigation, route}) =>
            createTabPressListener(navigation, route, guardTab('tasks', 'tasks'))
          }
        />
      </Tab.Navigator>

      {/* Global loader overlay - displays above the FloatingTabBar */}
      {showGlobalLoader && (
        <View style={styles.loaderOverlay}>
          <GifLoader size="medium" />
        </View>
      )}
    </View>
  );
};

export const TabNavigator: React.FC = () => {
  return (
    <GlobalLoaderProvider>
      <TabNavigatorInner />
    </GlobalLoaderProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});
