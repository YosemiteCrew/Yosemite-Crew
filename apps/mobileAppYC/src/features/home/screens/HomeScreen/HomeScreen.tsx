import React from 'react';
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
import {NavigationProp} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {HomeStackParamList, TabParamList, type TaskStackParamList} from '@/navigation/types';
import {useAuth} from '@/features/auth/context/AuthContext';
import {Images} from '@/assets/images';
import {SearchBar, YearlySpendCard} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {
  selectCompanions,
  selectSelectedCompanionId,
  setSelectedCompanion,
  fetchCompanions,
} from '@/features/companion';
import {initializeMockData} from '@/features/linkedBusinesses';
import {selectAuthUser} from '@/features/auth/selectors';
import {AppointmentCard} from '@/shared/components/common/AppointmentCard/AppointmentCard';
import {TaskCard} from '@/features/tasks/components/TaskCard/TaskCard';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {
  fetchExpensesForCompanion,
  selectExpenseSummaryByCompanion,
  selectHasHydratedCompanion,
} from '@/features/expenses';
import {
  fetchTasksForCompanion,
  selectNextUpcomingTask,
  selectHasHydratedCompanion as selectHasHydratedTasksCompanion,
  markTaskStatus,
} from '@/features/tasks';
import {
  fetchAppointmentsForCompanion,
  updateAppointmentStatus,
} from '@/features/appointments/appointmentsSlice';
import {createSelectUpcomingAppointments} from '@/features/appointments/selectors';
import {
  isChatActive,
  getTimeUntilChatActivation,
  formatAppointmentTime,
} from '@/shared/services/mockStreamBackend';
import type {ObservationalToolTaskDetails} from '@/features/tasks/types';
import {useEmergency} from '@/features/home/context/EmergencyContext';
import {selectUnreadCount} from '@/features/notifications/selectors';
import {openMapsToAddress} from '@/shared/utils/openMaps';

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
  const expenseSummary = useSelector(
    selectExpenseSummaryByCompanion(selectedCompanionIdRedux ?? null),
  );
  const hasExpenseHydrated = useSelector(
    selectHasHydratedCompanion(selectedCompanionIdRedux ?? null),
  );
  const hasTasksHydrated = useSelector(
    selectHasHydratedTasksCompanion(selectedCompanionIdRedux ?? null),
  );
  const nextUpcomingTask = useSelector(
    selectNextUpcomingTask(selectedCompanionIdRedux ?? null),
  );
  const unreadNotifications = useSelector(selectUnreadCount);
  const userCurrencyCode = authUser?.currency ?? 'USD';

  const hasAppointmentsHydrated = useSelector((s: RootState) => {
    if (!selectedCompanionIdRedux) return false;
    return s.appointments?.hydratedCompanions?.[selectedCompanionIdRedux] ?? false;
  });
  const businesses = useSelector((s: RootState) => s.businesses?.businesses ?? []);
  const employees = useSelector((s: RootState) => s.businesses?.employees ?? []);
  const services = useSelector((s: RootState) => s.businesses?.services ?? []);
  const businessMap = React.useMemo(() => new Map(businesses.map(b => [b.id, b])), [businesses]);
  const employeeMap = React.useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const serviceMap = React.useMemo(() => new Map(services.map(s => [s.id, s])), [services]);
  const upcomingAppointmentsSelector = React.useMemo(() => createSelectUpcomingAppointments(), []);
  const upcomingAppointments = useSelector((state: RootState) =>
    upcomingAppointmentsSelector(state, selectedCompanionIdRedux ?? null),
  );
  const hasUnreadNotifications = unreadNotifications > 0;

  const {resolvedName: firstName, displayName} = deriveHomeGreetingName(
    authUser?.firstName,
  );
  const [headerAvatarError, setHeaderAvatarError] = React.useState(false);
  const headerAvatarUri = React.useMemo(
    () => normalizeImageUri(authUser?.profilePicture ?? authUser?.profileToken ?? null),
    [authUser?.profilePicture, authUser?.profileToken],
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

  React.useEffect(() => {
    if (selectedCompanionIdRedux && !hasExpenseHydrated) {
      dispatch(
        fetchExpensesForCompanion({companionId: selectedCompanionIdRedux}),
      );
    }
  }, [dispatch, hasExpenseHydrated, selectedCompanionIdRedux]);

  // Fetch tasks for selected companion
  React.useEffect(() => {
    if (selectedCompanionIdRedux && !hasTasksHydrated) {
      dispatch(fetchTasksForCompanion({companionId: selectedCompanionIdRedux}));
    }
  }, [dispatch, hasTasksHydrated, selectedCompanionIdRedux]);

  React.useEffect(() => {
    if (selectedCompanionIdRedux && !hasAppointmentsHydrated) {
      dispatch(fetchAppointmentsForCompanion({companionId: selectedCompanionIdRedux}));
    }
  }, [dispatch, hasAppointmentsHydrated, selectedCompanionIdRedux]);

  const previousCurrencyRef = React.useRef(userCurrencyCode);

  React.useEffect(() => {
    if (
      selectedCompanionIdRedux &&
      hasExpenseHydrated &&
      previousCurrencyRef.current !== userCurrencyCode
    ) {
      previousCurrencyRef.current = userCurrencyCode;
      dispatch(
        fetchExpensesForCompanion({companionId: selectedCompanionIdRedux}),
      );
    }
  }, [
    dispatch,
    selectedCompanionIdRedux,
    userCurrencyCode,
    hasExpenseHydrated,
  ]);

  const handleAddCompanion = () => {
    navigation.navigate('AddCompanion');
  };

  const handleSelectCompanion = (id: string) => {
    dispatch(setSelectedCompanion(id));
  };

  const selectedCompanion = React.useMemo(() => {
    return companions.find(c => c.id === selectedCompanionIdRedux);
  }, [companions, selectedCompanionIdRedux]);

  const computeMockTaskCount = React.useCallback((companionId: string) => {
    if (!companionId) {
      return 0;
    }
    const charSum = Array.from(companionId).reduce(
      (accumulator, character) => accumulator + (character.codePointAt(0) ?? 0),
      0,
    );
    return (charSum % 5) + 1;
  }, []);

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
    [dispatch],
  );

  const handleStartObservationalTool = React.useCallback(() => {
    if (!nextUpcomingTask) {
      return;
    }
    navigation
      .getParent<NavigationProp<TabParamList>>()
      ?.navigate('Tasks', {screen: 'ObservationalTool', params: {taskId: nextUpcomingTask.id}});
  }, [navigation, nextUpcomingTask]);

  const navigateToTasksCategory = React.useCallback(
    (category: TaskStackParamList['TasksList']['category']) => {
      if (!selectedCompanionIdRedux && companions.length > 0) {
        dispatch(setSelectedCompanion(companions[0].id));
      }
      navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Tasks', {
        screen: 'TasksList',
        params: {category},
      });
    },
    [companions, dispatch, navigation, selectedCompanionIdRedux],
  );

  const navigateToTaskView = React.useCallback(
    (taskId: string) => {
      navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Tasks', {
        screen: 'TaskView',
        params: {taskId, source: 'home'},
      });
    },
    [navigation],
  );

  const handleEmergencyPress = React.useCallback(() => {
    openEmergencySheet();
  }, [openEmergencySheet]);


  const handleViewTask = React.useCallback(() => {
    if (nextUpcomingTask && selectedCompanionIdRedux) {
      navigateToTaskView(nextUpcomingTask.id);
    }
  }, [navigateToTaskView, nextUpcomingTask, selectedCompanionIdRedux]);

  const formatAppointmentDateTime = React.useCallback((dateStr: string, timeStr?: string | null) => {
    const timeComponent = timeStr ?? '00:00';
    const date = new Date(`${dateStr}T${timeComponent}`);
    if (Number.isNaN(date.getTime())) {
      return timeStr ? `${dateStr} • ${timeStr}` : dateStr;
    }
    const formattedDate = date.toLocaleDateString('en-US', {day: 'numeric', month: 'short'});
    const formattedTime = timeStr
      ? new Date(`1970-01-01T${timeComponent}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;
    return formattedTime ? `${formattedDate} • ${formattedTime}` : formattedDate;
  }, []);

  const nextUpcomingAppointment = React.useMemo(() => {
    if (!upcomingAppointments.length) {
      return null;
    }
    const sorted = [...upcomingAppointments].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time ?? '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.time ?? '00:00'}`).getTime();
      return dateA - dateB;
    });
    return sorted[0] ?? null;
  }, [upcomingAppointments]);

  const handleViewAppointment = React.useCallback(
    (appointmentId: string) => {
      navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Appointments', {
        screen: 'ViewAppointment',
        params: {appointmentId},
      });
    },
    [navigation],
  );

  const handleChatAppointment = React.useCallback(
    (appointmentId: string) => {
      const appointment = upcomingAppointments.find(a => a.id === appointmentId);

      if (!appointment) {
        Alert.alert(
          'Chat unavailable',
          'Book an appointment with an assigned vet to access chat.',
          [{text: 'OK'}],
        );
        return;
      }

      const timeComponent = appointment.time ?? '00:00';
      const normalizedTime = timeComponent.length === 5 ? `${timeComponent}:00` : timeComponent;
      const appointmentDateTime = `${appointment.date}T${normalizedTime}`;
      const activationMinutes = 5;
      const emp = appointment.employeeId ? employeeMap.get(appointment.employeeId) : undefined;
      const service = appointment.serviceId ? serviceMap.get(appointment.serviceId) : undefined;
      const doctorName =
        emp?.name ?? service?.name ?? appointment.serviceName ?? 'Assigned vet';

      const navigateToChat = () => {
        navigation.getParent<NavigationProp<TabParamList>>()?.navigate('Appointments', {
          screen: 'ChatChannel',
          params: {
            appointmentId: appointment.id,
            vetId: emp?.id ?? 'vet-1',
            appointmentTime: appointmentDateTime,
            doctorName,
            petName: companions.find(c => c.id === appointment.companionId)?.name,
          },
        });
      };

      if (!isChatActive(appointmentDateTime, activationMinutes)) {
        const timeRemaining = getTimeUntilChatActivation(appointmentDateTime, activationMinutes);

        if (timeRemaining) {
          const formattedTime = formatAppointmentTime(appointmentDateTime);
          Alert.alert(
            'Chat Locked 🔒',
            `Chat will be available ${activationMinutes} minutes before your appointment.\n\n` +
              `Appointment: ${formattedTime}\n` +
              `Unlocks in: ${timeRemaining.minutes}m ${timeRemaining.seconds}s\n\n` +
              `(This restriction comes from your clinic's settings)`,
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Mock Chat (Testing)',
                style: 'default',
                onPress: () => {
                  console.log('[MOCK] Bypassing chat time restriction for testing');
                  navigateToChat();
                },
              },
            ],
            {cancelable: true},
          );
        } else {
          Alert.alert(
            'Chat Unavailable',
            'This appointment has ended and chat is no longer available.',
            [{text: 'OK'}],
          );
        }
        return;
      }

      navigateToChat();
    },
    [companions, employeeMap, navigation, serviceMap, upcomingAppointments],
  );

  const handleCheckInAppointment = React.useCallback(
    (appointmentId: string) => {
      dispatch(updateAppointmentStatus({appointmentId, status: 'completed'}));
    },
    [dispatch],
  );

  const renderUpcomingTasks = () => {
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
    return renderEmptyStateTile(
      'No upcoming tasks',
      'Add a companion to start managing their tasks',
      'tasks',
    );
  };

  const renderUpcomingAppointments = () => {
    if (nextUpcomingAppointment) {
      const biz = businessMap.get(nextUpcomingAppointment.businessId);
      const service = serviceMap.get(nextUpcomingAppointment.serviceId ?? '');
      const emp = employeeMap.get(nextUpcomingAppointment.employeeId ?? '');
      const hasAssignedVet = Boolean(emp);
      const avatarSource = hasAssignedVet ? emp?.avatar : Images.cat;
      const cardTitle = hasAssignedVet
        ? emp?.name ?? 'Assigned vet'
        : service?.name ?? nextUpcomingAppointment.serviceName ?? 'Service request';
      const servicePriceText = service?.basePrice ? `$${service.basePrice}` : null;
      const serviceSubtitle = [
        service?.specialty ?? nextUpcomingAppointment.type ?? 'Awaiting vet assignment',
        servicePriceText,
      ]
        .filter(Boolean)
        .join(' • ');
      const cardSubtitle = hasAssignedVet ? emp?.specialization ?? '' : serviceSubtitle;
      let assignmentNote: string | undefined;
      if (!hasAssignedVet) {
        assignmentNote = 'A vet will be assigned once the clinic approves your request.';
      } else if (nextUpcomingAppointment.status === 'paid') {
        assignmentNote = 'Note: Check in is only allowed if you arrive 5 minutes early at location.';
      }
      const formattedDate = formatAppointmentDateTime(nextUpcomingAppointment.date, nextUpcomingAppointment.time);
      const canCheckIn = nextUpcomingAppointment.status === 'paid' && hasAssignedVet;

      return (
        <AppointmentCard
          key={nextUpcomingAppointment.id}
          doctorName={cardTitle}
          specialization={cardSubtitle}
          hospital={biz?.name || ''}
          dateTime={formattedDate}
          note={assignmentNote}
          avatar={avatarSource}
          showActions={canCheckIn}
          onPress={() => handleViewAppointment(nextUpcomingAppointment.id)}
          onViewDetails={() => handleViewAppointment(nextUpcomingAppointment.id)}
          onGetDirections={() => {
            if (biz?.address) {
              openMapsToAddress(biz.address);
            }
          }}
          onChat={() => handleChatAppointment(nextUpcomingAppointment.id)}
          onCheckIn={() => {
            if (canCheckIn) {
              handleCheckInAppointment(nextUpcomingAppointment.id);
            }
          }}
          testIDs={{
            container: 'appointment-card-container',
            directions: 'appointment-directions',
            chat: 'appointment-chat',
            checkIn: 'appointment-checkin',
          }}
        />
      );
    }

    return renderEmptyStateTile(
      'No upcoming appointments',
      'Book an appointment to see it here.',
      'appointments',
      companions.length > 0
        ? () =>
            navigation
              .getParent<NavigationProp<TabParamList>>()
              ?.navigate('Appointments', {screen: 'BrowseBusinesses'})
        : undefined,
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
            getBadgeText={companion =>
              `${computeMockTaskCount(companion.id)} Tasks`
            }
          />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>

          {renderUpcomingTasks()}
          {renderUpcomingAppointments()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <YearlySpendCard
            amount={expenseSummary?.total ?? 0}
            currencyCode={userCurrencyCode}
            currencySymbol={resolveCurrencySymbol(userCurrencyCode, '$')}
            onPressView={() =>
              navigation.navigate('ExpensesStack', {
                screen: 'ExpensesMain',
              })
            }
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            {companions.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
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
  });
const isObservationalToolDetails = (
  details: unknown,
): details is ObservationalToolTaskDetails => {
  if (details && typeof details === 'object' && 'taskType' in details) {
    return (details as {taskType?: string}).taskType === 'take-observational-tool';
  }
  return false;
};
