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
import {HomeStackParamList, TabParamList, type TaskStackParamList} from '@/navigation/types';
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
import {TaskCard} from '@/features/tasks/components/TaskCard/TaskCard';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {
  fetchExpenseSummary,
  selectExpenseSummaryByCompanion,
  selectHasHydratedCompanion as selectExpensesHydrated,
} from '@/features/expenses';
import {
  fetchTasksForCompanion,
  selectNextUpcomingTask,
  selectHasHydratedCompanion as selectHasHydratedTasksCompanion,
  markTaskStatus,
} from '@/features/tasks';
import {
  fetchAppointmentsForCompanion,
} from '@/features/appointments/appointmentsSlice';
import {createSelectUpcomingAppointments} from '@/features/appointments/selectors';
import type {ObservationalToolTaskDetails} from '@/features/tasks/types';
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

const EMPTY_ACCESS_MAP: Record<string, ParentCompanionAccess> = {};

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const QUICK_ACTIONS: Array<{
  id: 'health' | 'hygiene' | 'diet';
  label: string;
  icon: ImageSourcePropType;
  category: TaskStackParamList['TasksList']['category'];
}> = [
  {id: 'health', label: 'Manage health', icon: Images.healthIcon, category: 'health'},
  {id: 'hygiene', label: 'Hygiene maintenance', icon: Images.hygeineIcon, category: 'hygiene'},
  {id: 'diet', label: 'Dietary plans', icon: Images.dietryIcon, category: 'dietary'},
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
  const hasTasksHydrated = useSelector(
    selectHasHydratedTasksCompanion(selectedCompanionIdRedux ?? null),
  );
  const nextUpcomingTask = useSelector(
    selectNextUpcomingTask(selectedCompanionIdRedux ?? null),
  );
  const unreadNotifications = useSelector(selectUnreadCount);
  const userCurrencyCode = authUser?.currency ?? 'USD';
  const {businessMap, employeeMap, serviceMap} = useAppointmentDataMaps();
  const upcomingAppointmentsSelector = React.useMemo(() => createSelectUpcomingAppointments(), []);
  const upcomingAppointments = useSelector((state: RootState) =>
    upcomingAppointmentsSelector(state, selectedCompanionIdRedux ?? null),
  );
  const hasUnreadNotifications = unreadNotifications > 0;

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

  // Fetch tasks for selected companion
  React.useEffect(() => {
    if (selectedCompanionIdRedux && !hasTasksHydrated) {
      dispatch(fetchTasksForCompanion({companionId: selectedCompanionIdRedux}));
    }
  }, [dispatch, hasTasksHydrated, selectedCompanionIdRedux]);

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

  const selectedCompanion = React.useMemo(() => {
    return companions.find(c => c.id === selectedCompanionIdRedux);
  }, [companions, selectedCompanionIdRedux]);

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

  const handleCompleteTask = React.useCallback(
    async (taskId: string) => {
      if (!guardFeature('tasks', 'tasks')) {
        return;
      }
      try {
        await dispatch(
          markTaskStatus({
            taskId,
            status: 'completed',
          }),
        ).unwrap();
      } catch (error) {
        console.error('Failed to complete task:', error);
      }
    },
    [dispatch, guardFeature],
  );

  const handleStartObservationalTool = React.useCallback(() => {
    if (!guardFeature('tasks', 'tasks')) {
      return;
    }
    if (!nextUpcomingTask) {
      return;
    }
    navigation
      .getParent<NavigationProp<TabParamList>>()
      ?.navigate('Tasks', {screen: 'ObservationalTool', params: {taskId: nextUpcomingTask.id}});
  }, [guardFeature, navigation, nextUpcomingTask]);

  const navigateToTasksCategory = React.useCallback(
    (category: TaskStackParamList['TasksList']['category']) => {
      if (!guardFeature('tasks', 'tasks')) {
        return;
      }
      if (!selectedCompanionIdRedux && companions.length > 0) {
        dispatch(setSelectedCompanion(companions[0].id));
      }
      navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Tasks', {
        screen: 'TasksList',
        params: {category},
      });
    },
    [companions, dispatch, guardFeature, navigation, selectedCompanionIdRedux],
  );

  const navigateToTaskView = React.useCallback(
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

  const handleEmergencyPress = React.useCallback(() => {
    if (!guardFeature('emergencyBasedPermissions', 'emergency actions')) {
      return;
    }
    openEmergencySheet();
  }, [guardFeature, openEmergencySheet]);


  const handleViewTask = React.useCallback(() => {
    if (nextUpcomingTask && selectedCompanionIdRedux) {
      navigateToTaskView(nextUpcomingTask.id);
    }
  }, [navigateToTaskView, nextUpcomingTask, selectedCompanionIdRedux]);

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

  const nextUpcomingAppointment = React.useMemo(() => {
    if (!upcomingAppointments.length) {
      return null;
    }
    const priority: Record<string, number> = {
      UPCOMING: 0,
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
        emp?.name ?? service?.name ?? appointment.serviceName ?? 'Assigned vet';
      const petName = companions.find(c => c.id === appointment.companionId)?.name;

      const openChat = () => {
        const timeComponent = appointment.time ?? '00:00';
        const normalizedTime = timeComponent.length === 5 ? `${timeComponent}:00` : timeComponent;
        const appointmentDateTime = `${appointment.date}T${normalizedTime}`;

        navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Appointments', {
          screen: 'ChatChannel',
          params: {
            appointmentId: appointment.id,
            vetId: emp?.id ?? 'vet-1',
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
      isCheckedIn,
    } = cardData;
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
          if (!isCheckedIn) {
            handleCheckInAppointment(appointment.id);
          }
        }}
        checkInLabel={isCheckedIn ? 'Checked in' : 'Check in'}
        checkInDisabled={isCheckedIn || checkingIn[appointment.id]}
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
        'Add a companion to start managing upcoming tasks.',
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
    if (nextUpcomingTask && selectedCompanion) {
      // Get assigned user's profile image and name
      const assignedToData = nextUpcomingTask?.assignedTo === authUser?.id ? {
        avatar: authUser?.profilePicture,
        name: authUser?.firstName || 'User',
      } : undefined;
      return (
        <TaskCard
          key={nextUpcomingTask.id}
          title={nextUpcomingTask.title}
          categoryLabel={nextUpcomingTask.category}
          subcategoryLabel={nextUpcomingTask.subcategory && nextUpcomingTask.subcategory !== 'none' ? nextUpcomingTask.subcategory : undefined}
          date={nextUpcomingTask.date}
          time={nextUpcomingTask.time}
          companionName={selectedCompanion.name}
          companionAvatar={
            normalizeImageUri(selectedCompanion.profileImage ?? undefined) ?? undefined
          }
          assignedToName={assignedToData?.name}
          assignedToAvatar={assignedToData?.avatar}
          status={nextUpcomingTask.status}
          category={nextUpcomingTask.category}
          details={nextUpcomingTask.details}
          showCompleteButton={true}
          completeButtonVariant="liquid-glass"
          completeButtonLabel="Complete"
          showEditAction={false}
          hideSwipeActions={false}
          onPressView={handleViewTask}
          onPressComplete={() => handleCompleteTask(nextUpcomingTask.id)}
          onPressTakeObservationalTool={
            nextUpcomingTask.category === 'health' &&
            isObservationalToolDetails(nextUpcomingTask.details)
              ? handleStartObservationalTool
              : undefined
          }
        />
      );
    }
    return renderEmptyStateTile('No upcoming tasks', 'You are all caught up for now.', 'tasks');
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
          placeholder="Search hospitals, groomers, boarders..."
          onPress={() => {}}
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
                  onPress={() => navigateToTasksCategory(action.category)}>
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

const isObservationalToolDetails = (
  details: unknown,
): details is ObservationalToolTaskDetails => {
  if (details && typeof details === 'object' && 'taskType' in details) {
    return (details as {taskType?: string}).taskType === 'take-observational-tool';
  }
  return false;
};
