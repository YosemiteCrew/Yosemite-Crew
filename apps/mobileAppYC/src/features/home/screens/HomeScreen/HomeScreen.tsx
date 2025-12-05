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
import {SafeAreaView} from 'react-native-safe-area-context';
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
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
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
  selectHasHydratedCompanion as selectExpensesHydrated,
} from '@/features/expenses';
import {
  fetchAppointmentsForCompanion,
} from '@/features/appointments/appointmentsSlice';
import {createSelectUpcomingAppointments} from '@/features/appointments/selectors';
import {useEmergency} from '@/features/home/context/EmergencyContext';
import {selectUnreadCount} from '@/features/notifications/selectors';
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
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {appointmentApi} from '@/features/appointments/services/appointmentsService';
import {fetchNotificationsForCompanion} from '@/features/notifications/thunks';
import {selectHasHydratedCompanion as selectNotificationsHydrated} from '@/features/notifications/selectors';

const EMPTY_ACCESS_MAP: Record<string, ParentCompanionAccess> = {};

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const QUICK_ACTIONS: Array<{
  id: 'health' | 'hygiene' | 'diet';
  label: string;
  icon: ImageSourcePropType;
}> = [
  {id: 'health', label: 'Manage health', icon: Images.healthIcon},
  {id: 'hygiene', label: 'Hygiene maintenance', icon: Images.hygeineIcon},
  {id: 'diet', label: 'Dietary plans', icon: Images.dietryIcon},
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

  const companions = useSelector(selectCompanions);
  const selectedCompanionIdRedux = useSelector(selectSelectedCompanionId);
  const expenseSummarySelector = React.useMemo(
    () => selectExpenseSummaryByCompanion(selectedCompanionIdRedux ?? null),
    [selectedCompanionIdRedux],
  );
  const expenseSummary = useSelector(expenseSummarySelector);
  const hasExpenseHydrated = useSelector(selectExpensesHydrated(selectedCompanionIdRedux ?? null));
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
  const userCurrencyCode = authUser?.currency ?? 'USD';
  const {businessMap, employeeMap, serviceMap} = useAppointmentDataMaps();
  const upcomingAppointmentsSelector = React.useMemo(() => createSelectUpcomingAppointments(), []);
  const upcomingAppointments = useSelector((state: RootState) =>
    upcomingAppointmentsSelector(state, selectedCompanionIdRedux ?? null),
  );
  const hasUnreadNotifications = unreadNotifications > 0;
  const [orgRatings, setOrgRatings] = React.useState<
    Record<string, {isRated: boolean; rating?: number | null; review?: string | null; loading?: boolean}>
  >({});
  const [businessSearch, setBusinessSearch] = React.useState('');
  const hasNotificationsHydrated = useSelector(
    selectNotificationsHydrated('default-companion'),
  );
  useFocusEffect(
    React.useCallback(() => {
      setBusinessSearch('');
    }, []),
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
      dispatch(
        fetchExpenseSummary({
          companionId: selectedCompanionIdRedux,
        }),
      );
    }
  }, [dispatch, selectedCompanionIdRedux, hasCompanions, hasExpenseHydrated, expenseSummary]);
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
  const handleServiceSearch = React.useCallback(
    (termOverride?: string) => {
      const term = (termOverride ?? businessSearch).trim();
      navigation
        .getParent<NavigationProp<TabParamList>>()
        ?.navigate('Appointments', {
          screen: 'BrowseBusinesses',
          params: {serviceName: term || undefined, autoFocusSearch: true},
        });
    },
    [businessSearch, navigation],
  );

  React.useEffect(() => {
    setHeaderAvatarError(false);
  }, [headerAvatarUri]);

  // Fetch companions on mount and set the first one as default
  React.useEffect(() => {
    const loadCompanionsAndSelectDefault = async () => {
      if (user?.parentId) {
        await dispatch(fetchCompanions(user.parentId));
        // Initialize mock linked business data for testing
        dispatch(initializeMockData());
      }
    };

    loadCompanionsAndSelectDefault();
  }, [dispatch, user?.parentId]);

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
    }
  }, [authUser?.parentId, companions, dispatch]);

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
    const targetId =
      selectedCompanionIdRedux ??
      companions[0]?.id ??
      (companions[0] as any)?._id ??
      (companions[0] as any)?.identifier?.[0]?.value;
    if (!targetId) {
      return;
    }
    if (!selectedCompanionIdRedux) {
      dispatch(setSelectedCompanion(targetId));
    }
    dispatch(fetchAppointmentsForCompanion({companionId: targetId}));
  }, [dispatch, selectedCompanionIdRedux, companions]);

  // Fetch linked hospitals for emergency feature
  React.useEffect(() => {
    if (selectedCompanionIdRedux) {
      dispatch(
        fetchLinkedBusinesses({companionId: selectedCompanionIdRedux, category: 'hospital'}),
      );
    }
  }, [dispatch, selectedCompanionIdRedux]);

  // Hydrate notifications after login to drive red dot state
  React.useEffect(() => {
    if (user && !hasNotificationsHydrated) {
      dispatch(fetchNotificationsForCompanion({companionId: 'default-companion'}));
    }
  }, [dispatch, hasNotificationsHydrated, user]);

  // Refresh notifications when returning to Home
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        dispatch(fetchNotificationsForCompanion({companionId: 'default-companion'}));
      }
    }, [dispatch, user]),
  );

  const previousCurrencyRef = React.useRef(userCurrencyCode);

  React.useEffect(() => {
    if (
      selectedCompanionIdRedux &&
      hasExpenseHydrated &&
      previousCurrencyRef.current !== userCurrencyCode
    ) {
      previousCurrencyRef.current = userCurrencyCode;
      dispatch(
        fetchExpenseSummary({companionId: selectedCompanionIdRedux}),
      );
    }
  }, [
    dispatch,
    selectedCompanionIdRedux,
    userCurrencyCode,
    hasExpenseHydrated,
  ]);

  // Always refresh expense summary when returning to Home
  useFocusEffect(
    React.useCallback(() => {
      if (selectedCompanionIdRedux) {
        dispatch(fetchExpenseSummary({companionId: selectedCompanionIdRedux}));
      }
    }, [dispatch, selectedCompanionIdRedux]),
  );

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
      <LiquidGlassCard
        key={key}
        glassEffect="clear"
        interactive
        style={styles.infoTile}
        fallbackStyle={styles.tileFallback}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </LiquidGlassCard>
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

  const showTasksComingSoon = React.useCallback(() => {
    const message = 'Tasks feature coming soon.';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Coming soon', message);
    }
  }, []);

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

  const fetchOrgRatingIfNeeded = React.useCallback(
    async (organisationId?: string | null) => {
      if (
        !organisationId ||
        orgRatings[organisationId]?.loading ||
        typeof orgRatings[organisationId]?.isRated === 'boolean'
      ) {
        return;
      }
      try {
        setOrgRatings(prev => ({...prev, [organisationId]: {...prev[organisationId], loading: true}}));
        const tokens = await getFreshStoredTokens();
        const accessToken = tokens?.accessToken;
        if (!accessToken || isTokenExpired(tokens?.expiresAt ?? undefined)) {
          setOrgRatings(prev => ({...prev, [organisationId]: {isRated: false, loading: false}}));
          return;
        }
        const res = await appointmentApi.getOrganisationRatingStatus({
          organisationId,
          accessToken,
        });
        setOrgRatings(prev => ({...prev, [organisationId]: {...res, loading: false}}));
      } catch (error) {
        console.warn('[Home] Failed to fetch rating status', error);
        setOrgRatings(prev => ({...prev, [organisationId]: {isRated: false, loading: false}}));
      }
    },
    [orgRatings],
  );

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

    const {
      cardTitle,
      cardSubtitle,
      businessName,
      businessAddress,
      avatarSource,
      fallbackPhoto,
      googlePlacesId,
      assignmentNote,
      needsPayment,
      isRequested,
      statusAllowsActions,
      isInProgress,
      checkInLabel,
      checkInDisabled,
    } = cardData;
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

  const renderUpcomingTasks = () =>
    renderEmptyStateTile(
      'Feature coming soon',
      'Task management will be available shortly.',
      'tasks-coming-soon',
      showTasksComingSoon,
    );

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

  return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
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
            <TouchableOpacity
              style={styles.actionIcon}
              activeOpacity={0.85}
              onPress={handleEmergencyPress}>
              <Image source={Images.emergencyIcon} style={styles.actionImage} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIcon}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Notifications')}>
              <View style={styles.notificationIconWrapper}>
                <Image
                  source={Images.notificationIcon}
                  style={styles.actionImage}
                />
                {hasUnreadNotifications ? (
                  <View style={styles.notificationDot} />
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <SearchBar
          placeholder="Search services"
          mode="input"
          value={businessSearch}
          onChangeText={text => {
            setBusinessSearch(text);
            if (text && text.trim().length > 0) {
              handleServiceSearch(text);
            }
          }}
          onSubmitEditing={e => handleServiceSearch(e.nativeEvent.text)}
          onIconPress={() => handleServiceSearch()}
        />

        {companions.length === 0 ? (
          <LiquidGlassCard
            glassEffect="clear"
            interactive
            tintColor={theme.colors.primary}
            style={[styles.heroTouchable, styles.heroCard]}
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
              <TouchableOpacity
                activeOpacity={0.8}
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
                }}>
                <Text style={styles.viewMoreText}>View more</Text>
              </TouchableOpacity>
            )}
          </View>

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
                  onPress={showTasksComingSoon}>
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
    scrollContent: {
      paddingHorizontal: theme.spacing[6],
      paddingTop: theme.spacing[6],
      paddingBottom: theme.spacing[30],
      gap: theme.spacing[6],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    profileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3.5],
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 24,
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
      gap: theme.spacing[3],
    },
    actionIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionImage: {
      width: 25,
      height: 25,
      resizeMode: 'contain',
    },
    notificationIconWrapper: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationDot: {
      position: 'absolute',
      top:2,
      right: 0,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.error,
      borderWidth: 1,
      borderColor: theme.colors.cardBackground,
    },
    heroTouchable: {
      alignSelf: 'flex-start',
      width: '50%',
      minWidth: 160,
      maxWidth: 160,
    },
    heroCard: {
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[5],
      minHeight: 160,
      overflow: 'hidden',
      ...theme.shadows.lg,
      shadowColor: theme.colors.neutralShadow,
    },
    heroContent: {
      flex: 1,
      minHeight: 100,
      justifyContent: 'space-between',
      gap: theme.spacing[2],
    },
    heroPaw: {
      position: 'absolute',
      right: -45,
      top: -45,
      width: 160,
      height: 160,
      tintColor: theme.colors.whiteOverlay70,
      resizeMode: 'contain',
    },
    heroIconImage: {
      marginTop: 35,
      marginBottom: theme.spacing[1.25],
      width: 35,
      height: 35,
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
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
    },
    section: {
      gap: theme.spacing[3.5],
    },
    sectionTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
    },
    infoTile: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[5],
      gap: theme.spacing[2],
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      overflow: 'hidden',
    },
    tileFallback: {
      borderRadius: theme.borderRadius.lg,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
    },
    tileTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    tileSubtitle: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    quickActionsCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      paddingVertical: theme.spacing[4.5],
      paddingHorizontal: theme.spacing[4],
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      overflow: 'hidden',
    },
    quickActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing[3],
    },
    quickAction: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    quickActionIconWrapper: {
      width: 50,
      height: 50,
      borderRadius: 12,
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
      ...theme.typography.labelXsBold,
      color: theme.colors.primary,
    },
    quickActionIcon: {
      width: 26,
      height: 26,
      resizeMode: 'contain',
      tintColor: theme.colors.white,
    },
    quickActionLabel: {
      ...theme.typography.labelXsBold,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    reviewButtonCard: {marginTop: theme.spacing[1]},
    reviewButtonText: {...theme.typography.paragraphBold, color: theme.colors.white},
  upcomingFooter: {
    gap: theme.spacing[2],
  },
  requestedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing[2.5],
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryTint,
  },
  requestedBadgeText: {
    ...theme.typography.title,
    color: theme.colors.primary,
  },
  });
