import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  type ImageSourcePropType,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavigationProp, useFocusEffect} from '@react-navigation/native';
import {Platform, ToastAndroid} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {HomeStackParamList, TabParamList} from '@/navigation/types';
import {useAuth} from '@/features/auth/context/AuthContext';
import {Images} from '@/assets/images';
import {SearchBar, YearlySpendCard} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassHeader} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {
  selectCompanions,
  selectSelectedCompanionId,
  setSelectedCompanion,
  fetchCompanions,
} from '@/features/companion';
import {selectAuthUser} from '@/features/auth/selectors';
import {AppointmentCard} from '@/shared/components/common/AppointmentCard/AppointmentCard';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {
  fetchExpenseSummary,
  selectExpenseSummaryByCompanion,
  selectExpensesLoading,
  selectHasHydratedCompanion as selectExpensesHydrated,
} from '@/features/expenses';
import {
  fetchAppointmentsForCompanion,
} from '@/features/appointments/appointmentsSlice';
import {createSelectUpcomingAppointments} from '@/features/appointments/selectors';
import {useEmergency} from '@/features/home/context/EmergencyContext';
import {openMapsToAddress, openMapsToPlaceId} from '@/shared/utils/openMaps';
import {
  fetchParentAccess,
  type CoParentPermissions,
  type ParentCompanionAccess,
} from '@/features/coParent';
import {initializeMockData, fetchLinkedBusinesses} from '@/features/linkedBusinesses';
import {formatDateTime} from '@/features/appointments/utils/timeFormatting';
import {useAutoSelectCompanion} from '@/shared/hooks/useAutoSelectCompanion';
import {useBusinessPhotoFallback} from '@/features/appointments/hooks/useBusinessPhotoFallback';
import {transformAppointmentCardData} from '@/features/appointments/utils/appointmentCardData';
import {handleChatActivation} from '@/features/appointments/utils/chatActivation';
import {getBusinessCoordinates as getBusinessCoordinatesUtil} from '@/features/appointments/utils/businessCoordinates';
import {useCheckInHandler} from '@/features/appointments/hooks/useCheckInHandler';
import {useAppointmentDataMaps} from '@/features/appointments/hooks/useAppointmentDataMaps';
import {useFetchPhotoFallbacks} from '@/features/appointments/hooks/useFetchPhotoFallbacks';
import {baseTileContainer, sharedTileStyles} from '@/shared/styles/tileStyles';
import {useFetchOrgRatingIfNeeded, type OrgRatingState} from '@/features/appointments/hooks/useOrganisationRating';
import {usePlacesBusinessSearch, type ResolvedBusinessSelection} from '@/features/linkedBusinesses/hooks/usePlacesBusinessSearch';
import {mapSelectionToVetBusiness} from '@/features/linkedBusinesses/utils/mapSelectionToVetBusiness';
import {fetchNotificationsForCompanion} from '@/features/notifications/thunks';
import {
  selectNotificationsLoading,
  selectHasHydratedCompanion as selectNotificationsHydrated,
  selectUnreadCount,
} from '@/features/notifications/selectors';
import {useGlobalLoader} from '@/context/GlobalLoaderContext';
import {TaskCard} from '@/features/tasks/components';
import {
  fetchTasksForCompanion,
  selectHasHydratedCompanion as selectTasksHydrated,
  selectNextUpcomingTask,
  markTaskStatus,
} from '@/features/tasks';
import type {TaskCategory} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/features/tasks/utils/taskLabels';
import {useLiquidGlassHeaderLayout} from '@/shared/hooks/useLiquidGlassHeaderLayout';
import {upsertBusiness} from '@/features/appointments/businessesSlice';
import {BusinessSearchDropdown} from '@/features/linkedBusinesses/components/BusinessSearchDropdown';

const EMPTY_ACCESS_MAP: Record<string, ParentCompanionAccess> = {};

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const QUICK_ACTIONS: Array<{
  id: TaskCategory;
  label: string;
  icon: ImageSourcePropType;
}> = [
  {id: 'health', label: 'Manage health', icon: Images.healthIcon},
  {id: 'hygiene', label: 'Hygiene maintenance', icon: Images.hygeineIcon},
  {id: 'dietary', label: 'Dietary plans', icon: Images.dietryIcon},
];

export const deriveHomeGreetingName = (rawFirstName?: string | null) => {
  const trimmed = rawFirstName?.trim() ?? '';
  const resolvedName = trimmed.length > 0 ? trimmed : 'Sky';
  const displayName =
    resolvedName.length > 13 ? `${resolvedName.slice(0, 13)}...` : resolvedName;
  return {resolvedName, displayName};
};

export const HomeScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {user} = useAuth();
  const authUser = useSelector(selectAuthUser);
  const dispatch = useDispatch<AppDispatch>();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const {openEmergencySheet} = useEmergency();
  const {showLoader, hideLoader} = useGlobalLoader();

  const companions = useSelector(selectCompanions);
  const selectedCompanionIdRedux = useSelector(selectSelectedCompanionId);
  const companionLoading = useSelector((state: RootState) => state.companion?.loading);
  const expenseSummarySelector = React.useMemo(
    () => selectExpenseSummaryByCompanion(selectedCompanionIdRedux ?? null),
    [selectedCompanionIdRedux],
  );
  const expenseSummary = useSelector(expenseSummarySelector);
  const expensesLoading = useSelector(selectExpensesLoading);
  const accessMap = useSelector(
    (state: RootState) => state.coParent?.accessByCompanionId ?? EMPTY_ACCESS_MAP,
  );
  const defaultAccess = useSelector((state: RootState) => state.coParent?.defaultAccess ?? null);
  const globalRole = useSelector((state: RootState) => state.coParent?.lastFetchedRole);
  const globalPermissions = useSelector(
    (state: RootState) => state.coParent?.lastFetchedPermissions,
  );
  const currentAccessEntry = selectedCompanionIdRedux
    ? accessMap[selectedCompanionIdRedux] ?? null
    : null;
  const hasCompanions = companions.length > 0;
  const unreadNotifications = useSelector(selectUnreadCount);
  const notificationsLoading = useSelector(selectNotificationsLoading);
  const userCurrencyCode = authUser?.currency ?? 'USD';
  const {businessMap, employeeMap, serviceMap} = useAppointmentDataMaps();
  const upcomingAppointmentsSelector = React.useMemo(() => createSelectUpcomingAppointments(), []);
  const upcomingAppointments = useSelector((state: RootState) =>
    upcomingAppointmentsSelector(state, selectedCompanionIdRedux ?? null),
  );
  const hasUnreadNotifications = unreadNotifications > 0;
  const [orgRatings, setOrgRatings] = React.useState<Record<string, OrgRatingState>>({});
  const hasNotificationsHydrated = useSelector(
    selectNotificationsHydrated('default-companion'),
  );
  const appointmentsLoading = useSelector(
    (state: RootState) => state.appointments?.loading,
  );
  const linkedBusinessesLoading = useSelector(
    (state: RootState) => state.linkedBusinesses?.loading,
  );
  const accessLoading = useSelector(
    (state: RootState) => state.coParent?.accessLoading,
  );
  const [initialLoadStarted, setInitialLoadStarted] = React.useState(
    Boolean(user?.id),
  );
  const [initialRequests, setInitialRequests] = React.useState({
    companions: false,
    appointments: false,
    expenses: false,
    access: false,
    linkedBusinesses: false,
    notifications: false,
  });
  const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);

  const targetCompanionId = React.useMemo(() => {
    const fallback =
      companions[0]?.id ??
      (companions[0] as any)?._id ??
      (companions[0] as any)?.identifier?.[0]?.value;
    return selectedCompanionIdRedux ?? fallback ?? null;
  }, [companions, selectedCompanionIdRedux]);

  const hasExpenseHydrated = useSelector(
    selectExpensesHydrated(targetCompanionId),
  );
  const hasAppointmentsHydrated = useSelector((state: RootState) =>
    targetCompanionId
      ? Boolean(state.appointments?.hydratedCompanions?.[targetCompanionId])
      : true,
  );
  const hasTasksHydrated = useSelector(selectTasksHydrated(targetCompanionId));
  const nextUpcomingTaskSelector = React.useMemo(
    () => selectNextUpcomingTask(targetCompanionId),
    [targetCompanionId],
  );
  const nextUpcomingTask = useSelector(nextUpcomingTaskSelector);
  const markInitialRequest = React.useCallback(
    (key: keyof typeof initialRequests) => {
      setInitialRequests(prev => (prev[key] ? prev : {...prev, [key]: true}));
    },
    [],
  );

  const {resolvedName: firstName, displayName} = deriveHomeGreetingName(
    authUser?.firstName,
  );
  // Hydrate expenses summary when companion changes and not yet loaded or missing
  useEffect(() => {
    if (
      selectedCompanionIdRedux &&
      hasCompanions &&
      (!hasExpenseHydrated || !expenseSummary)
    ) {
      markInitialRequest('expenses');
      dispatch(
        fetchExpenseSummary({
          companionId: selectedCompanionIdRedux,
        }),
      );
    }
  }, [
    dispatch,
    selectedCompanionIdRedux,
    hasCompanions,
    hasExpenseHydrated,
    expenseSummary,
    markInitialRequest,
  ]);
  const [checkingIn, setCheckingIn] = React.useState<Record<string, boolean>>({});
  const {businessFallbacks, handleAvatarError, requestBusinessPhoto} = useBusinessPhotoFallback();
  const {handleCheckIn: handleCheckInUtil} = useCheckInHandler();
  useAutoSelectCompanion(companions, selectedCompanionIdRedux);
  const [headerAvatarError, setHeaderAvatarError] = React.useState(false);
  const headerAvatarUri = React.useMemo(
    () => normalizeImageUri(authUser?.profilePicture ?? authUser?.profileToken ?? null),
    [authUser?.profilePicture, authUser?.profileToken],
  );
  const getAccessEntry = React.useCallback(
    (companionId?: string | null) => {
      if (companionId) {
        return accessMap[companionId] ?? null;
      }
      return currentAccessEntry ?? defaultAccess;
    },
    [accessMap, currentAccessEntry, defaultAccess],
  );
  const canAccessFeature = React.useCallback(
    (permission: keyof CoParentPermissions, companionId?: string | null) => {
      const entry = getAccessEntry(companionId);
      const role = (entry?.role ?? defaultAccess?.role ?? globalRole ?? '').toUpperCase();
      const permissions = entry?.permissions ?? defaultAccess?.permissions ?? globalPermissions;
      const isPrimary = role.includes('PRIMARY');
      if (isPrimary) {
        return true;
      }
      if (!permissions) {
        return false;
      }
      return Boolean(permissions[permission]);
    },
    [
      defaultAccess?.permissions,
      defaultAccess?.role,
      getAccessEntry,
      globalPermissions,
      globalRole,
    ],
  );
  const showPermissionToast = React.useCallback((label: string) => {
    const message = `You don't have access to ${label}. Ask the primary parent to enable it.`;
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Permission needed', message);
    }
  }, []);

  const guardFeature = React.useCallback(
    (permission: keyof CoParentPermissions, label: string, companionId?: string | null) => {
      if (!hasCompanions) {
        return true;
      }
      if (!canAccessFeature(permission, companionId)) {
        showPermissionToast(label);
        return false;
      }
      return true;
    },
    [canAccessFeature, hasCompanions, showPermissionToast],
  );
  const ensureCompanionForSearch = React.useCallback(() => {
    if (hasCompanions) {
      return true;
    }
    const message = 'Add a companion to search services.';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Add a companion', message);
    }
    return false;
  }, [hasCompanions]);

  const selectedCompanion = React.useMemo(() => {
    if (targetCompanionId) {
      return companions.find(c => c.id === targetCompanionId) ?? null;
    }
    return companions[0] ?? null;
  }, [companions, targetCompanionId]);

  const handleSearchError = React.useCallback((error: unknown) => {
    console.log('[HomeSearch] Search error', error);
  }, []);

  const handlePmsSelection = React.useCallback(
    async (selection: ResolvedBusinessSelection) => {
      const businessPayload = mapSelectionToVetBusiness(selection);

      dispatch(upsertBusiness(businessPayload));

      navigation
        .getParent<NavigationProp<TabParamList>>()
        ?.navigate('Appointments', {
          screen: 'BusinessDetails',
          params: {
            businessId: businessPayload.id,
            returnTo: {tab: 'HomeStack', screen: 'Home'},
          },
        });
    },
    [dispatch, navigation],
  );

  const handleNonPmsSelection = React.useCallback(
    async (selection: ResolvedBusinessSelection) => {
      if (!ensureCompanionForSearch() || !selectedCompanion || !targetCompanionId) {
        return;
      }

      navigation.navigate('LinkedBusinesses', {
        screen: 'BusinessAdd',
        params: {
          companionId: targetCompanionId,
          companionName: selectedCompanion.name,
          companionBreed: selectedCompanion.breed?.breedName,
          companionImage: selectedCompanion.profileImage ?? undefined,
          category: 'hospital',
          businessId: selection.placeId,
          businessName: selection.name,
          businessAddress: selection.address,
          phone: selection.phone,
          email: selection.email,
          photo: selection.photo,
          isPMSRecord: false,
          rating: selection.rating,
          distance: selection.distance,
          placeId: selection.placeId,
        },
      });
    },
    [ensureCompanionForSearch, navigation, selectedCompanion, targetCompanionId],
  );

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    handleSearchChange,
    handleSelectBusiness,
    clearResults,
  } = usePlacesBusinessSearch({
    onSelectPms: handlePmsSelection,
    onSelectNonPms: handleNonPmsSelection,
    onError: handleSearchError,
  });

  useFocusEffect(
    React.useCallback(() => {
      setSearchQuery('');
      clearResults();
      if (targetCompanionId && !hasTasksHydrated) {
        dispatch(fetchTasksForCompanion({companionId: targetCompanionId}));
      }
    }, [clearResults, dispatch, hasTasksHydrated, setSearchQuery, targetCompanionId]),
  );

  React.useEffect(() => {
    setHeaderAvatarError(false);
  }, [headerAvatarUri]);

  // Fetch companions on mount and set the first one as default
  React.useEffect(() => {
    const loadCompanionsAndSelectDefault = async () => {
      if (user?.parentId) {
        markInitialRequest('companions');
        await dispatch(fetchCompanions(user.parentId));
        // Initialize mock linked business data for testing
        dispatch(initializeMockData());
      }
    };

    loadCompanionsAndSelectDefault();
  }, [dispatch, markInitialRequest, user?.parentId]);

  const fetchParentAccessStateRef = React.useRef({
    lastParentId: null as string | null,
    lastCompanionCount: 0,
  });

  React.useEffect(() => {
    if (!authUser?.parentId || companions.length === 0) {
      return;
    }

    const state = fetchParentAccessStateRef.current;
    const parentIdChanged = state.lastParentId !== authUser.parentId;
    const companionCountChanged = state.lastCompanionCount !== companions.length;

    // Dispatch if parent changed (logout/login as different user) OR companions loaded for first time
    if (parentIdChanged || (companionCountChanged && companions.length > 0)) {
      state.lastParentId = authUser.parentId;
      state.lastCompanionCount = companions.length;

      dispatch(
        fetchParentAccess({
          parentId: authUser.parentId,
          companionIds: companions.map(c => c.id),
        }),
      );
      markInitialRequest('access');
    }
  }, [authUser?.parentId, companions, dispatch, markInitialRequest]);

  // New useEffect to handle default selection once companions are loaded
  React.useEffect(() => {
    // If companions exist and no companion is currently selected, select the first one.
    if (companions.length > 0 && !selectedCompanionIdRedux) {
      const fallbackId =
        companions[0]?.id ??
        (companions[0] as any)?._id ??
        (companions[0] as any)?.identifier?.[0]?.value;
      if (fallbackId) {
        dispatch(setSelectedCompanion(fallbackId));
      }
    }
  }, [companions, selectedCompanionIdRedux, dispatch]);

  // Always refresh appointments when companion changes or initial load finishes
  React.useEffect(() => {
    const targetId = targetCompanionId;
    if (!targetId) {
      return;
    }
    if (!selectedCompanionIdRedux) {
      dispatch(setSelectedCompanion(targetId));
    }
    markInitialRequest('appointments');
    dispatch(fetchAppointmentsForCompanion({companionId: targetId}));
  }, [dispatch, markInitialRequest, selectedCompanionIdRedux, targetCompanionId]);

  // Fetch linked hospitals for emergency feature
  React.useEffect(() => {
    if (selectedCompanionIdRedux) {
      markInitialRequest('linkedBusinesses');
      dispatch(
        fetchLinkedBusinesses({companionId: selectedCompanionIdRedux, category: 'hospital'}),
      );
    }
  }, [dispatch, markInitialRequest, selectedCompanionIdRedux]);

  // Hydrate notifications after login to drive red dot state
  React.useEffect(() => {
    if (user && !hasNotificationsHydrated) {
      markInitialRequest('notifications');
      dispatch(fetchNotificationsForCompanion({companionId: 'default-companion'}));
    }
  }, [dispatch, hasNotificationsHydrated, markInitialRequest, user]);

  // Refresh notifications when returning to Home
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        markInitialRequest('notifications');
        dispatch(fetchNotificationsForCompanion({companionId: 'default-companion'}));
      }
    }, [dispatch, markInitialRequest, user]),
  );

  const previousCurrencyRef = React.useRef(userCurrencyCode);

  React.useEffect(() => {
    if (
      selectedCompanionIdRedux &&
      hasExpenseHydrated &&
      previousCurrencyRef.current !== userCurrencyCode
    ) {
      previousCurrencyRef.current = userCurrencyCode;
      markInitialRequest('expenses');
      dispatch(
        fetchExpenseSummary({companionId: selectedCompanionIdRedux}),
      );
    }
  }, [
    dispatch,
    markInitialRequest,
    selectedCompanionIdRedux,
    userCurrencyCode,
    hasExpenseHydrated,
  ]);

  // Always refresh expense summary when returning to Home
  useFocusEffect(
    React.useCallback(() => {
      if (selectedCompanionIdRedux) {
        markInitialRequest('expenses');
        dispatch(fetchExpenseSummary({companionId: selectedCompanionIdRedux}));
      }
    }, [dispatch, markInitialRequest, selectedCompanionIdRedux]),
  );

  React.useEffect(() => {
    if (user?.id && !initialLoadStarted) {
      setInitialLoadStarted(true);
    }
  }, [initialLoadStarted, user?.id]);

  const areRequiredRequestsStarted = React.useMemo(() => {
    if (!initialLoadStarted) return false;
    if (user?.parentId && !initialRequests.companions) return false;
    if (user && !hasNotificationsHydrated && !initialRequests.notifications) return false;
    if (authUser?.parentId && companions.length > 0 && !initialRequests.access) return false;
    if (targetCompanionId && !initialRequests.appointments) return false;
    if (selectedCompanionIdRedux && !hasExpenseHydrated && !initialRequests.expenses) return false;
    if (selectedCompanionIdRedux && !initialRequests.linkedBusinesses) return false;
    return true;
  }, [
    initialLoadStarted,
    user,
    initialRequests,
    hasNotificationsHydrated,
    authUser?.parentId,
    companions.length,
    targetCompanionId,
    selectedCompanionIdRedux,
    hasExpenseHydrated,
  ]);

  const areRequestsComplete = React.useMemo(() => {
    if (initialRequests.companions && companionLoading) return false;
    if (initialRequests.access && accessLoading) return false;
    if (initialRequests.notifications && (notificationsLoading || !hasNotificationsHydrated)) return false;
    if (initialRequests.appointments && (appointmentsLoading || !hasAppointmentsHydrated)) return false;
    if (initialRequests.expenses && (expensesLoading || !hasExpenseHydrated)) return false;
    if (initialRequests.linkedBusinesses && linkedBusinessesLoading) return false;
    return true;
  }, [
    initialRequests,
    companionLoading,
    accessLoading,
    notificationsLoading,
    hasNotificationsHydrated,
    appointmentsLoading,
    hasAppointmentsHydrated,
    expensesLoading,
    hasExpenseHydrated,
    linkedBusinessesLoading,
  ]);

  const isHomeDataReady = React.useMemo(() => {
    if (!areRequiredRequestsStarted) return false;
    if (!areRequestsComplete) return false;
    if (companions.length > 0 && !targetCompanionId) return false;
    return true;
  }, [areRequiredRequestsStarted, areRequestsComplete, companions.length, targetCompanionId]);

  React.useEffect(() => {
    if (initialLoadComplete) {
      return;
    }
    if (isHomeDataReady) {
      setInitialLoadComplete(true);
    }
  }, [initialLoadComplete, isHomeDataReady]);

  React.useEffect(() => {
    if (!initialLoadStarted) {
      hideLoader();
      return;
    }
    if (initialLoadComplete) {
      hideLoader();
    } else {
      showLoader();
    }
  }, [hideLoader, initialLoadComplete, initialLoadStarted, showLoader]);

  React.useEffect(() => {
    return () => {
      hideLoader();
    };
  }, [hideLoader]);

  const handleAddCompanion = () => {
    navigation.navigate('AddCompanion');
  };

  const handleSelectCompanion = (id: string) => {
    dispatch(setSelectedCompanion(id));
  };

  const renderEmptyStateTile = (
    title: string,
    subtitle: string,
    key: string,
    onPress?: () => void,
  ) => {
    const content = (
        <View style={styles.tileShadowWrapper}>
          <LiquidGlassCard
            key={key}
            glassEffect="clear"
            interactive
            style={styles.infoTile}
            fallbackStyle={styles.tileFallback}>
            <Text style={styles.tileTitle}>{title}</Text>
            <Text style={styles.tileSubtitle}>{subtitle}</Text>
          </LiquidGlassCard>
        </View>
    );
    if (!onPress) {
      return content;
    }
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} testID={`${key}-empty-tile`}>
        {content}
      </TouchableOpacity>
    );
  };

  const handleOpenTasks = React.useCallback(() => {
    if (!guardFeature('tasks', 'tasks')) {
      return;
    }
    navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Tasks', {
      screen: 'TasksMain',
    });
  }, [guardFeature, navigation]);

  const handleViewTask = React.useCallback(
    (taskId: string) => {
      if (!guardFeature('tasks', 'tasks')) {
        return;
      }
      navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Tasks', {
        screen: 'TaskView',
        params: {taskId, source: 'home'},
      });
    },
    [guardFeature, navigation],
  );

  const handleQuickActionPress = React.useCallback(
    (category: TaskCategory) => {
      if (!guardFeature('tasks', 'tasks')) {
        return;
      }
      navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Tasks', {
        screen: 'TasksList',
        params: {category},
      });
    },
    [guardFeature, navigation],
  );

  const handleEditTask = React.useCallback(
    (taskId: string) => {
      if (!guardFeature('tasks', 'tasks')) {
        return;
      }
      navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Tasks', {
        screen: 'EditTask',
        params: {taskId, source: 'home'},
      });
    },
    [guardFeature, navigation],
  );

  const handleCompleteTask = React.useCallback(
    (taskId: string) => {
      if (!guardFeature('tasks', 'tasks')) {
        return;
      }
      dispatch(markTaskStatus({taskId, status: 'completed'}));
    },
    [dispatch, guardFeature],
  );

  const handleEmergencyPress = React.useCallback(() => {
    if (!guardFeature('emergencyBasedPermissions', 'emergency actions')) {
      return;
    }
    openEmergencySheet();
  }, [guardFeature, openEmergencySheet]);

  const getCoordinatesForAppointment = React.useCallback(
    (appointmentId: string) => {
      const apt = upcomingAppointments.find(a => a.id === appointmentId);
      if (!apt) {
        return {lat: null, lng: null};
      }
      return getBusinessCoordinatesUtil(apt, businessMap);
    },
    [businessMap, upcomingAppointments],
  );

  // Fetch business photo fallbacks when primary photos are missing or dummy
  useFetchPhotoFallbacks(upcomingAppointments, businessMap, requestBusinessPhoto);

  const fetchOrgRatingIfNeeded = useFetchOrgRatingIfNeeded({
    orgRatings,
    setOrgRatings,
    logTag: 'Home',
  });

  const nextUpcomingAppointment = React.useMemo(() => {
    if (!upcomingAppointments.length) {
      return null;
    }
    const priority: Record<string, number> = {
      UPCOMING: 0,
      IN_PROGRESS: 0.25,
      CHECKED_IN: 0.5,
      PAID: 1,
      CONFIRMED: 2,
      SCHEDULED: 2,
      RESCHEDULED: 2.5,
      REQUESTED: 3,
    };
    const sorted = [...upcomingAppointments].sort((a, b) => {
      const priorityA = priority[a.status] ?? 5;
      const priorityB = priority[b.status] ?? 5;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      const dateA = new Date(`${a.date}T${a.time ?? '00:00'}Z`).getTime();
      const dateB = new Date(`${b.date}T${b.time ?? '00:00'}Z`).getTime();
      return dateA - dateB;
    });
    return sorted[0] ?? null;
  }, [upcomingAppointments]);

  useEffect(() => {
    if (nextUpcomingAppointment?.businessId && nextUpcomingAppointment.status === 'COMPLETED') {
      fetchOrgRatingIfNeeded(nextUpcomingAppointment.businessId);
    }
  }, [fetchOrgRatingIfNeeded, nextUpcomingAppointment]);

  const handleViewAppointment = React.useCallback(
    (appointmentId: string) => {
      if (!guardFeature('appointments', 'appointments')) {
        return;
      }
      navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Appointments', {
        screen: 'ViewAppointment',
        params: {appointmentId},
      });
    },
    [guardFeature, navigation],
  );

  const handleChatAppointment = React.useCallback(
    (appointmentId: string) => {
      if (!guardFeature('chatWithVet', 'chat with vet')) {
        return;
      }
      const appointment = upcomingAppointments.find(a => a.id === appointmentId);

      if (!appointment) {
        Alert.alert(
          'Chat unavailable',
          'Book an appointment with an assigned vet to access chat.',
          [{text: 'OK'}],
        );
        return;
      }

      const emp = appointment.employeeId ? employeeMap.get(appointment.employeeId) : undefined;
      const service = appointment.serviceId ? serviceMap.get(appointment.serviceId) : undefined;
      const doctorName =
        emp?.name ??
        appointment.employeeName ??
        service?.name ??
        appointment.serviceName ??
        'Assigned vet';
      const petName = companions.find(c => c.id === appointment.companionId)?.name;
      const vetId = emp?.id ?? appointment.employeeId ?? 'unknown-vet';

      const openChat = () => {
        const timeComponent = appointment.time ?? '00:00';
        const normalizedTime = timeComponent.length === 5 ? `${timeComponent}:00` : timeComponent;
        const appointmentDateTime = `${appointment.date}T${normalizedTime}`;

        navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Appointments', {
          screen: 'ChatChannel',
          params: {
            appointmentId: appointment.id,
            vetId,
            appointmentTime: appointmentDateTime,
            doctorName,
            petName,
          },
        });
      };

      handleChatActivation({
        appointment,
        employee: emp,
        companions,
        doctorName,
        petName,
        onOpenChat: openChat,
      });
    },
    [companions, employeeMap, guardFeature, navigation, serviceMap, upcomingAppointments],
  );

  const handleCheckInAppointment = React.useCallback(
    async (appointmentId: string) => {
      if (!guardFeature('appointments', 'appointments')) {
        return;
      }
      const target = upcomingAppointments.find(a => a.id === appointmentId);
      if (!target) {
        Alert.alert('Appointment not found', 'Please refresh and try again.');
        return;
      }

      await handleCheckInUtil({
        appointment: target,
        businessCoordinates: getCoordinatesForAppointment(appointmentId),
        onCheckingInChange: (id, checking) => {
          setCheckingIn(prev => ({...prev, [id]: checking}));
        },
        hasPermission: true, // Already guarded above
      });
    },
    [
      getCoordinatesForAppointment,
      guardFeature,
      upcomingAppointments,
      handleCheckInUtil,
    ],
  );

  const renderAppointmentCard = (
    appointment: typeof nextUpcomingAppointment,
  ) => {
    if (!appointment) {
      return null;
    }

    const cardData = transformAppointmentCardData(
      appointment,
      businessMap,
      employeeMap,
      serviceMap,
      companions,
      businessFallbacks,
      Images,
    );

    const {cardTitle, cardSubtitle} = cardData;
    const businessName = cardData.businessName;
    const businessAddress = cardData.businessAddress;
    const avatarSource = cardData.avatarSource;
    const fallbackPhoto = cardData.fallbackPhoto;
    const googlePlacesId = cardData.googlePlacesId;
    const assignmentNote = cardData.assignmentNote;
    const {needsPayment, isRequested, statusAllowsActions, isInProgress, checkInLabel, checkInDisabled} =
      cardData;
    const isCheckInDisabled = checkInDisabled || checkingIn[appointment.id];
    const footer = needsPayment ? (
      <View style={styles.upcomingFooter}>
        <LiquidGlassButton
          title="Pay now"
          onPress={() =>
            navigation
              .getParent<NavigationProp<TabParamList>>()
              ?.navigate('Appointments', {
                screen: 'PaymentInvoice',
                params: {appointmentId: appointment.id, companionId: appointment.companionId},
              })
          }
          height={48}
          borderRadius={12}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          textStyle={styles.reviewButtonText}
          style={styles.reviewButtonCard}
        />
      </View>
    ) : undefined;

    const formattedDate = formatDateTime(appointment.date, appointment.time);
    const statusBadge = isRequested ? (
      <View style={styles.requestedBadge}>
        <Text style={styles.requestedBadgeText}>Requested</Text>
      </View>
    ) : null;

    return (
      <AppointmentCard
        key={appointment.id}
        doctorName={cardTitle}
        specialization={cardSubtitle}
        hospital={businessName}
        dateTime={formattedDate}
        note={assignmentNote}
        avatar={avatarSource}
        fallbackAvatar={fallbackPhoto ?? undefined}
        onAvatarError={() => handleAvatarError(googlePlacesId, appointment.businessId)}
        showActions={statusAllowsActions}
        onPress={() => handleViewAppointment(appointment.id)}
        onViewDetails={() => handleViewAppointment(appointment.id)}
        onGetDirections={() => {
          if (googlePlacesId) {
            openMapsToPlaceId(googlePlacesId, businessAddress);
          } else if (businessAddress) {
            openMapsToAddress(businessAddress);
          }
        }}
        onChat={() => handleChatAppointment(appointment.id)}
        onCheckIn={() => {
          if (!isCheckInDisabled) {
            handleCheckInAppointment(appointment.id);
          }
        }}
        checkInLabel={checkInLabel ?? (isInProgress ? 'In progress' : undefined)}
        checkInDisabled={isCheckInDisabled}
        testIDs={{
          container: 'appointment-card-container',
          directions: 'appointment-directions',
          chat: 'appointment-chat',
          checkIn: 'appointment-checkin',
        }}
        footer={
          statusBadge ? (
            <View style={styles.upcomingFooter}>
              {statusBadge}
              {footer}
            </View>
          ) : (
            footer
          )
        }
      />
    );
  };

  const renderUpcomingTasks = () => {
    if (!hasCompanions) {
      return renderEmptyStateTile(
        'No companions yet',
        'Add a companion to see upcoming tasks here.',
        'tasks',
      );
    }

    if (!canAccessFeature('tasks')) {
      return renderEmptyStateTile(
        'Tasks restricted',
        'Ask the primary parent to enable tasks access for you.',
        'tasks',
      );
    }

    if (!nextUpcomingTask) {
      return renderEmptyStateTile(
        'No upcoming tasks',
        'Create a task to stay on track.',
        'tasks',
        handleOpenTasks,
      );
    }

    const companion = companions.find(c => c.id === nextUpcomingTask.companionId);
    const selfId = authUser?.parentId ?? authUser?.id;
    const assignedToData =
      nextUpcomingTask.assignedTo === selfId
        ? {
            avatar: authUser?.profilePicture,
            name: authUser?.firstName || 'User',
          }
        : undefined;
    const isObservationalToolTask =
      nextUpcomingTask.category === 'health' &&
      nextUpcomingTask.details &&
      'taskType' in nextUpcomingTask.details &&
      nextUpcomingTask.details.taskType === 'take-observational-tool';
    const isPending = String(nextUpcomingTask.status).toUpperCase() === 'PENDING';

    return (
      <TaskCard
        title={nextUpcomingTask.title}
        categoryLabel={resolveCategoryLabel(nextUpcomingTask.category)}
        subcategoryLabel={nextUpcomingTask.subcategory ?? undefined}
        date={nextUpcomingTask.date}
        time={nextUpcomingTask.time}
        companionName={companion?.name ?? 'Companion'}
        companionAvatar={companion?.profileImage ?? undefined}
        assignedToName={assignedToData?.name}
        assignedToAvatar={assignedToData?.avatar}
        status={nextUpcomingTask.status}
        onPressView={() => handleViewTask(nextUpcomingTask.id)}
        onPressEdit={() => handleEditTask(nextUpcomingTask.id)}
        onPressComplete={() =>
          handleCompleteTask(nextUpcomingTask.id)
        }
        onPressTakeObservationalTool={
          isObservationalToolTask
            ? () => handleViewTask(nextUpcomingTask.id)
            : undefined
        }
        showEditAction
        showCompleteButton={isPending}
        category={nextUpcomingTask.category}
        details={nextUpcomingTask.details}
      />
    );
  };

  const renderUpcomingAppointments = () => {
    if (!hasCompanions) {
      return renderEmptyStateTile(
        'No companions yet',
        'Add a companion to see upcoming appointments here.',
        'appointments',
      );
    }
    if (!canAccessFeature('appointments')) {
      return renderEmptyStateTile(
        'Appointments restricted',
        'Ask the primary parent to enable appointment access for you.',
        'appointments',
      );
    }
    if (nextUpcomingAppointment) {
      return renderAppointmentCard(nextUpcomingAppointment);
    }

    const navigateToAppointments =
      companions.length > 0
        ? () =>
            navigation
              .getParent<NavigationProp<TabParamList>>()
              ?.navigate('Appointments', {screen: 'BrowseBusinesses'})
        : undefined;

    return renderEmptyStateTile(
      'No upcoming appointments',
      'Book an appointment to see it here.',
      'appointments',
      navigateToAppointments,
    );
  };

  const renderExpensesSection = () => {
    if (!hasCompanions) {
      return renderEmptyStateTile(
        'No companions yet',
        'Add a companion to start tracking expenses.',
        'expenses',
      );
    }

    if (!canAccessFeature('expenses')) {
      return renderEmptyStateTile(
        'Expenses restricted',
        'Ask the primary parent to enable expenses access for you.',
        'expenses',
      );
    }

    return (
      <YearlySpendCard
        amount={expenseSummary?.total ?? 0}
        currencyCode={expenseSummary?.currencyCode ?? userCurrencyCode}
        currencySymbol={resolveCurrencySymbol(
          expenseSummary?.currencyCode ?? userCurrencyCode,
          '$',
        )}
        onPressView={() =>
          navigation.navigate('ExpensesStack', {
            screen: 'ExpensesMain',
          })
        }
      />
    );
  };

  const actionIconSize = theme.spacing['10'];
  const insets = useSafeAreaInsets();
  const {headerProps, contentPaddingStyle} = useLiquidGlassHeaderLayout({
    contentPadding: theme.spacing['4.5'],
  });
  const headerInsetsTop = headerProps.insetsTop + theme.spacing['6'];
  const bottomScrollPadding =
    insets.bottom + theme.spacing['24'] + theme.spacing['12'];
  const dropdownTop =
    (headerProps.currentHeight || headerInsetsTop + theme.spacing['18']) +
    theme.spacing['1'];
  const showSearchResults =
    searchQuery.length >= 2 && searchResults.length > 0 && !searching;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <BusinessSearchDropdown
        visible={showSearchResults}
        top={dropdownTop}
        items={searchResults}
        onSelect={handleSelectBusiness}
        onDismiss={clearResults}
      />

      <LiquidGlassHeader
        {...headerProps}
        insetsTop={headerInsetsTop}
        cardStyle={[headerProps.cardStyle, styles.headerCard]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Account')}
            activeOpacity={0.85}>
            <View style={styles.avatar}>
              {headerAvatarUri && !headerAvatarError ? (
                <Image
                  source={{uri: headerAvatarUri}}
                  style={styles.avatarImage}
                  onError={() => setHeaderAvatarError(true)}
                />
              ) : (
                <Text style={styles.avatarInitials}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.greetingName}>Hello, {displayName}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <View style={styles.actionIconShadowWrapper}>
              <LiquidGlassIconButton
                onPress={handleEmergencyPress}
                size={actionIconSize}
                style={styles.actionIcon}>
                <Image source={Images.emergencyIcon} style={styles.actionImage} />
              </LiquidGlassIconButton>
            </View>
            <View style={styles.actionIconShadowWrapper}>
              <LiquidGlassIconButton
                onPress={() => navigation.navigate('Notifications')}
                size={actionIconSize}
                style={styles.actionIcon}>
                <View style={styles.notificationIconWrapper}>
                  <Image
                    source={Images.notificationIcon}
                    style={styles.actionImage}
                  />
                  {hasUnreadNotifications ? (
                    <View style={styles.notificationDot} />
                  ) : null}
                </View>
              </LiquidGlassIconButton>
            </View>
          </View>
        </View>

        <SearchBar
          placeholder="Search for nearby businesses"
          mode="input"
          value={searchQuery}
          onChangeText={text => {
            if (!ensureCompanionForSearch()) {
              return;
            }
            handleSearchChange(text);
          }}
          onSubmitEditing={e => handleSearchChange(e.nativeEvent.text)}
          onIconPress={() => {
            if (!ensureCompanionForSearch()) {
              return;
            }
            handleSearchChange(searchQuery.trim());
          }}
        />
      </LiquidGlassHeader>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          contentPaddingStyle,
          {paddingBottom: bottomScrollPadding},
        ]}
        showsVerticalScrollIndicator={false}>

        {companions.length === 0 ? (
          <View style={[styles.heroShadowWrapper, styles.heroTouchable]}>
            <LiquidGlassCard
              glassEffect="clear"
              interactive
              tintColor={theme.colors.primary}
              style={styles.heroCard}
              fallbackStyle={styles.heroFallback}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleAddCompanion}
                style={styles.heroContent}>
                <Image source={Images.paw} style={styles.heroPaw} />
                <Image source={Images.plusIcon} style={styles.heroIconImage} />
                <Text style={styles.heroTitle}>Add your first companion</Text>
              </TouchableOpacity>
            </LiquidGlassCard>
          </View>
        ) : (
          <CompanionSelector
            companions={companions}
            selectedCompanionId={selectedCompanionIdRedux}
            onSelect={handleSelectCompanion}
            onAddCompanion={handleAddCompanion}
            showAddButton={true}
          />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>

          {renderUpcomingTasks()}
          {renderUpcomingAppointments()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          {renderExpensesSection()}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            {companions.length > 0 && (
              <View style={styles.viewMoreShadowWrapper}>
                <LiquidGlassButton
                  onPress={() => {
                    if (!guardFeature('companionProfile', 'companion profile')) {
                      return;
                    }
                    // Pass the selected companion's ID to the ProfileOverview screen
                    const companionId =
                      selectedCompanionIdRedux ??
                      companions[0]?.id ??
                      (companions[0] as any)?._id ??
                      (companions[0] as any)?.identifier?.[0]?.value ??
                      null;

                    if (companionId) {
                      // Ensure state stays in sync with the navigation target
                      handleSelectCompanion(companionId);
                      navigation.navigate('ProfileOverview', {
                        companionId,
                      });
                    } else {
                      console.warn('No companion selected to view profile.');
                    }
                  }}
                  size="small"
                  compact
                  glassEffect="clear"
                  borderRadius="full"
                  style={styles.viewMoreButton}
                  textStyle={styles.viewMoreText}
                  shadowIntensity="none"
                  title="View more"
                />
              </View>
            )}
          </View>

          <View style={styles.tileShadowWrapper}>
            <LiquidGlassCard
              glassEffect="clear"
              interactive
              style={styles.quickActionsCard}
              fallbackStyle={styles.tileFallback}>
              <View style={styles.quickActionsRow}>
                {QUICK_ACTIONS.map(action => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.quickAction}
                    activeOpacity={0.88}
                    onPress={() => handleQuickActionPress(action.id)}>
                    <View style={styles.quickActionIconWrapper}>
                      <Image
                        source={action.icon}
                        style={styles.quickActionIcon}
                      />
                    </View>
                    <Text style={styles.quickActionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </LiquidGlassCard>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ... createStyles remains unchanged
const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerCard: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['4'],
      gap: theme.spacing['4'],
      overflow: 'hidden',
    },
    scrollContent: {
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['4'],
      gap: theme.spacing['4'],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    profileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3.5'],
    },
    avatar: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: theme.borderRadius.full,
      resizeMode: 'cover',
    },
    avatarInitials: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    greetingName: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    actionIconShadowWrapper: {
      borderRadius: theme.borderRadius.full,
      ...(Platform.OS === 'ios' ? theme.shadows.sm : null),
    },
    actionIcon: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionImage: {
      width: theme.spacing['6'] + 1,
      height: theme.spacing['6'] + 1,
      resizeMode: 'contain',
    },
    notificationIconWrapper: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationDot: {
      position: 'absolute',
      top: 2,
      right: 0,
      width: theme.spacing['2.5'],
      height: theme.spacing['2.5'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.error,
      borderWidth: 1,
      borderColor: theme.colors.cardBackground,
    },
    heroTouchable: {
      alignSelf: 'flex-start',
      width: '50%',
      minWidth: theme.spacing['40'],
      maxWidth: theme.spacing['40'],
    },
    heroShadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      ...(Platform.OS === 'ios' ? theme.shadows.sm : null),
    },
    heroCard: {
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['5'],
      minHeight: theme.spacing['40'],
      overflow: 'hidden',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    heroContent: {
      flex: 1,
      minHeight: theme.spacing['24'] + theme.spacing['1'],
      justifyContent: 'space-between',
      gap: theme.spacing['2'],
    },
    heroPaw: {
      position: 'absolute',
      right: theme.spacing['-11.25'],
      top: theme.spacing['-11.25'],
      width: theme.spacing['40'],
      height: theme.spacing['40'],
      tintColor: theme.colors.whiteOverlay70,
      resizeMode: 'contain',
    },
    heroIconImage: {
      marginTop: theme.spacing['9'],
      marginBottom: theme.spacing['1.25'],
      width: theme.spacing['9'],
      height: theme.spacing['9'],
      tintColor: theme.colors.onPrimary,
      resizeMode: 'contain',
    },
    heroTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.onPrimary,
    },
    heroFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.primary,
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    section: {
      gap: theme.spacing['4'],
    },
    sectionTitle: {
      ...theme.typography.sectionHeading,
      color: theme.colors.secondary,
    },
    infoTile: {
      ...baseTileContainer(theme),
      borderWidth: 0,
      borderColor: 'transparent',
      padding: theme.spacing['5'],
      gap: theme.spacing['2'],
      overflow: 'hidden',
    },
    tileFallback: {
      ...sharedTileStyles(theme).tileFallback,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    tileShadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
    },
    tileTitle: sharedTileStyles(theme).tileTitle,
    tileSubtitle: sharedTileStyles(theme).tileSubtitle,
    quickActionsCard: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      paddingVertical: theme.spacing['4.5'],
      paddingHorizontal: theme.spacing['4'],
      overflow: 'hidden',
    },
    quickActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
    },
    quickAction: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    quickActionIconWrapper: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadows.sm,
      shadowColor: theme.colors.black,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    viewMoreText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.primary,
    },
    viewMoreButton: {
      alignSelf: 'flex-start',
      flexGrow: 0,
      flexShrink: 0,
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['1'],
      minHeight: theme.spacing['7'],
      minWidth: 0,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    viewMoreShadowWrapper: {
      borderRadius: theme.borderRadius.full,
      ...theme.shadows.sm,
    },
    quickActionIcon: {
      width: theme.spacing['7'],
      height: theme.spacing['7'],
      resizeMode: 'contain',
      tintColor: theme.colors.white,
    },
    quickActionLabel: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    reviewButtonCard: {
      marginTop: theme.spacing['1'],
      borderWidth: 0,
      borderColor: 'transparent',
      ...theme.shadows.sm,
      shadowColor: theme.colors.neutralShadow,
    },
    reviewButtonText: {...theme.typography.paragraphBold, color: theme.colors.white},
    upcomingFooter: {
      gap: theme.spacing['2'],
    },
    requestedBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing['2.5'],
      paddingVertical: theme.spacing['2'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.primaryTint,
    },
    requestedBadgeText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.primary,
    },
  });
