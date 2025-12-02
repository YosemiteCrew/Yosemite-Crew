import React, {useEffect} from 'react';
import {
  SectionList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {AppointmentCard} from '@/shared/components/common/AppointmentCard/AppointmentCard';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {fetchAppointmentsForCompanion} from '@/features/appointments/appointmentsSlice';
import {setSelectedCompanion} from '@/features/companion';
import {createSelectUpcomingAppointments, createSelectPastAppointments} from '@/features/appointments/selectors';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {openMapsToAddress} from '@/shared/utils/openMaps';
import {RootState as RS} from '@/app/store';
import {isChatActive, getTimeUntilChatActivation, formatAppointmentTime} from '@/shared/services/mockStreamBackend';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;
type BusinessFilter = 'all' | 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder';

export const MyAppointmentsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const companions = useSelector((s: RootState) => s.companion.companions);
  const selectedCompanionId = useSelector((s: RootState) => s.companion.selectedCompanionId);
  const accessMap = useSelector((s: RootState) => s.coParent?.accessByCompanionId ?? {});
  const defaultAccess = useSelector((s: RootState) => s.coParent?.defaultAccess ?? null);
  const globalRole = useSelector((s: RootState) => s.coParent?.lastFetchedRole);
  const globalPermissions = useSelector((s: RootState) => s.coParent?.lastFetchedPermissions);
  const accessForCompanion = selectedCompanionId
    ? accessMap[selectedCompanionId] ?? defaultAccess ?? null
    : defaultAccess;
  const role = (accessForCompanion?.role ?? defaultAccess?.role ?? globalRole ?? '').toUpperCase();
  const permissions =
    accessForCompanion?.permissions ?? defaultAccess?.permissions ?? globalPermissions;
  const isPrimary = role.includes('PRIMARY');
  const canUseAppointments = isPrimary || Boolean(permissions?.appointments);
  const canUseChat = isPrimary || Boolean(permissions?.chatWithVet);

  const upcomingSelector = React.useMemo(() => createSelectUpcomingAppointments(), []);
  const pastSelector = React.useMemo(() => createSelectPastAppointments(), []);
  const upcoming = useSelector((state: RootState) => upcomingSelector(state, selectedCompanionId ?? null));
  const past = useSelector((state: RootState) => pastSelector(state, selectedCompanionId ?? null));
  const businesses = useSelector((s: RS) => s.businesses.businesses);
  const employees = useSelector((s: RS) => s.businesses.employees);
  const services = useSelector((s: RS) => s.businesses.services);
  const [filter, setFilter] = React.useState<BusinessFilter>('all');
  const [businessFallbacks, setBusinessFallbacks] = React.useState<Record<string, {photo?: string | null}>>({});
  const requestedPlacesRef = React.useRef<Set<string>>(new Set());
  const isDummyPhoto = React.useCallback(
    (photo?: string | null) =>
      typeof photo === 'string' &&
      (photo.includes('example.com') || photo.includes('placeholder')),
    [],
  );

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      const fallbackId =
        companions[0]?.id ??
        (companions[0] as any)?._id ??
        (companions[0] as any)?.identifier?.[0]?.value;
      if (fallbackId) {
        dispatch(setSelectedCompanion(fallbackId));
      }
    }
  }, [companions, selectedCompanionId, dispatch]);

  useFocusEffect(
    React.useCallback(() => {
      if (selectedCompanionId) {
        dispatch(fetchAppointmentsForCompanion({companionId: selectedCompanionId}));
      }
    }, [dispatch, selectedCompanionId]),
  );

  // Also refetch when selected companion changes (covers tab switches)
  useEffect(() => {
    const targetId =
      selectedCompanionId ??
      companions[0]?.id ??
      (companions[0] as any)?._id ??
      (companions[0] as any)?.identifier?.[0]?.value;
    if (targetId) {
      if (!selectedCompanionId) {
        dispatch(setSelectedCompanion(targetId));
      }
      dispatch(fetchAppointmentsForCompanion({companionId: targetId}));
    }
  }, [dispatch, selectedCompanionId, companions]);

  const businessMap = React.useMemo(() => new Map(businesses.map(b => [b.id, b])), [businesses]);
  const employeeMap = React.useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const serviceMap = React.useMemo(() => new Map(services.map(s => [s.id, s])), [services]);

  const formatDate = React.useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [],
  );

  const filteredUpcoming = React.useMemo(() => {
    const filtered = upcoming.filter(apt => {
      if (filter === 'all') return true;
      const biz = businessMap.get(apt.businessId);
      return biz?.category === filter;
    });
    return filtered.sort((a, b) => {
      const aTime = new Date(`${a.date}T${a.time ?? '00:00'}`).getTime();
      const bTime = new Date(`${b.date}T${b.time ?? '00:00'}`).getTime();
      return aTime - bTime;
    });
  }, [upcoming, filter, businessMap]);

  const filteredPast = React.useMemo(() => {
    return past.filter(apt => {
      if (filter === 'all') return true;
      const biz = businessMap.get(apt.businessId);
      return biz?.category === filter;
    });
  }, [past, filter, businessMap]);
  const appointmentsForFallback = React.useMemo(
    () => [...filteredUpcoming, ...filteredPast],
    [filteredPast, filteredUpcoming],
  );

  const showPermissionToast = React.useCallback((label: string) => {
    const message = `You don't have access to ${label}. Ask the primary parent to enable it.`;
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Permission needed', message);
    }
  }, []);

  React.useEffect(() => {
    if (selectedCompanionId && !canUseAppointments) {
      showPermissionToast('appointments');
    }
  }, [canUseAppointments, selectedCompanionId, showPermissionToast]);

  React.useEffect(() => {
    appointmentsForFallback.forEach(apt => {
      const biz = businessMap.get(apt.businessId);
      const googlePlacesId = biz?.googlePlacesId ?? apt.businessGooglePlacesId ?? null;
      const photoCandidate = (biz?.photo ?? apt.businessPhoto) as string | null | undefined;
      const needsPhoto = (!photoCandidate || isDummyPhoto(photoCandidate)) && googlePlacesId;
      if (needsPhoto && googlePlacesId && !requestedPlacesRef.current.has(googlePlacesId)) {
        requestedPlacesRef.current.add(googlePlacesId);
        dispatch(fetchBusinessDetails(googlePlacesId))
          .unwrap()
          .then(res => {
            if (res.photoUrl) {
              setBusinessFallbacks(prev => ({...prev, [apt.businessId]: {photo: res.photoUrl}}));
            }
          })
          .catch(() => {
            dispatch(fetchGooglePlacesImage(googlePlacesId))
              .unwrap()
              .then(img => {
                if (img.photoUrl) {
                  setBusinessFallbacks(prev => ({...prev, [apt.businessId]: {photo: img.photoUrl}}));
                }
              })
              .catch(() => {});
          });
      }
    });
  }, [appointmentsForFallback, businessMap, dispatch, isDummyPhoto]);

  type AppointmentItem = (typeof filteredUpcoming)[number];
  type EmployeeRecord = ReturnType<typeof employeeMap.get>;
  const formatStatus = (status: string) => {
    switch (status) {
      case 'NO_PAYMENT':
      case 'AWAITING_PAYMENT':
        return 'Payment pending';
      case 'PAID':
        return 'Paid';
      case 'CONFIRMED':
      case 'SCHEDULED':
        return 'Scheduled';
      case 'RESCHEDULED':
        return 'Rescheduled';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'PAYMENT_FAILED':
        return 'Payment failed';
      default:
        return status;
    }
  };

  const handleChatPress = React.useCallback(
    ({
      appointment,
      employee,
      doctorName,
      petName,
    }: {
      appointment: AppointmentItem;
      employee?: EmployeeRecord;
      doctorName: string;
      petName?: string;
    }) => {
      const appointmentDateTime = `${appointment.date}T${appointment.time}:00`;
      const activationMinutes = 5;
      const chatIsActive = isChatActive(appointmentDateTime, activationMinutes);

      const openChat = () => {
        navigation.navigate('ChatChannel', {
          appointmentId: appointment.id,
          vetId: employee?.id || 'vet-1',
          appointmentTime: appointmentDateTime,
          doctorName,
          petName,
        });
      };

      if (!chatIsActive) {
        const timeRemaining = getTimeUntilChatActivation(appointmentDateTime, activationMinutes);

        if (timeRemaining) {
          const {minutes, seconds} = timeRemaining;
          const formattedTime = formatAppointmentTime(appointmentDateTime);

          Alert.alert(
            'Chat Locked 🔒',
            `Chat will be available ${activationMinutes} minutes before your appointment.\n\n` +
              `Appointment: ${formattedTime}\n` +
              `Unlocks in: ${minutes}m ${seconds}s\n\n` +
              `(This restriction comes from your clinic's settings)`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Mock Chat (Testing)',
                style: 'default',
                onPress: () => {
                  console.log('[MOCK] Bypassing chat time restriction for testing');
                  openChat();
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

      openChat();
    },
    [navigation],
  );

  const renderEmptyCard = (title: string, subtitle: string) => (
    <LiquidGlassCard
      key={`${title}-empty`}
      glassEffect="clear"
      interactive
      shadow='none'
      style={styles.infoTile}
      fallbackStyle={styles.tileFallback}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>
    </LiquidGlassCard>
  );

  const handleAdd = () => navigation.navigate('BrowseBusinesses');

  const sections = React.useMemo(
    () => [
      {key: 'upcoming', title: 'Upcoming', data: filteredUpcoming},
      {key: 'past', title: 'Past', data: filteredPast},
    ],
    [filteredUpcoming, filteredPast],
  );

  const renderSectionHeader = ({section}: {section: {key: string; title: string; data: typeof filteredUpcoming}}) => (
    <View style={styles.sectionHeaderWrapper}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.data.length === 0 &&
        (section.key === 'upcoming'
          ? renderEmptyCard('No upcoming appointments', 'Book a new appointment to see it here.')
          : renderEmptyCard('No past appointments', 'Completed appointments will appear here.'))}
    </View>
  );

  const renderItem = ({item, section}: {item: (typeof filteredUpcoming)[number]; section: {key: string}}) => {
    if (!item) {
      return null;
    }
    if (!canUseAppointments) {
      return null;
    }
    const emp = employeeMap.get(item.employeeId ?? '');
    const service = serviceMap.get(item.serviceId ?? '');
    const biz = businessMap.get(item.businessId);
    const formattedDate = formatDate(item.date);
    const hasAssignedVet = Boolean(emp);
    const companionAvatar =
      companions.find(c => c.id === item.companionId)?.profileImage ?? null;
    const googlePlacesId = biz?.googlePlacesId ?? item.businessGooglePlacesId ?? null;
    const businessPhoto = biz?.photo ?? item.businessPhoto ?? null;
    const fallbackPhoto = businessFallbacks[item.businessId]?.photo ?? null;
    const avatarSource =
      businessPhoto ||
      fallbackPhoto ||
      (companionAvatar ? {uri: companionAvatar} : Images.cat);
    const cardTitle = hasAssignedVet
      ? emp?.name ?? 'Assigned vet'
      : service?.name ?? item.serviceName ?? 'Service request';
    const servicePriceText = service?.basePrice ? `$${service.basePrice}` : null;
    const serviceSubtitle = [service?.specialty ?? item.type ?? 'Awaiting vet assignment', servicePriceText]
      .filter(Boolean)
      .join(' • ');
    const cardSubtitle = hasAssignedVet ? emp?.specialization ?? '' : serviceSubtitle;
    const petName = companions.find(c => c.id === item.companionId)?.name;
    const businessName = biz?.name || item.organisationName || '';
    const businessAddress = biz?.address || item.organisationAddress || '';
    let assignmentNote: string | undefined;
    if (!hasAssignedVet) {
      assignmentNote = 'Your request is pending review. The business will assign a provider once it’s approved.';
    } else if (item.status === 'PAID') {
      assignmentNote = 'Note: Check in is only allowed if you arrive 5 minutes early at location.';
    }
    const needsPayment =
      item.status === 'NO_PAYMENT' ||
      item.status === 'AWAITING_PAYMENT' ||
      item.status === 'PAYMENT_FAILED';
    const isRequested = item.status === 'REQUESTED';
    if (section.key === 'upcoming') {
      let footer: React.ReactNode;

      if (needsPayment) {
        footer = (
          <View style={styles.upcomingFooter}>
            <LiquidGlassButton
              title="Pay now"
              onPress={() => navigation.navigate('PaymentInvoice', {appointmentId: item.id, companionId: item.companionId})}
              height={48}
              borderRadius={12}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.reviewButtonText}
              style={styles.reviewButtonCard}
            />
          </View>
        );
      }

      if (isRequested) {
        footer = (
          <View style={styles.upcomingFooter}>
            <View style={[styles.pastStatusBadge, styles.pastStatusBadgeRequested]}>
              <Text style={[styles.pastStatusBadgeText, styles.pastStatusBadgeTextRequested]}>Requested</Text>
            </View>
            {footer}
          </View>
        );
      }

      return (
        <View style={styles.cardWrapper}>
          <AppointmentCard
            doctorName={cardTitle}
            specialization={cardSubtitle}
            hospital={businessName}
            dateTime={`${formattedDate} - ${item.time}`}
            avatar={avatarSource || Images.cat}
            fallbackAvatar={fallbackPhoto ?? undefined}
            onAvatarError={() => {
              if (googlePlacesId && !requestedPlacesRef.current.has(googlePlacesId)) {
                requestedPlacesRef.current.add(googlePlacesId);
                dispatch(fetchGooglePlacesImage(googlePlacesId))
                  .unwrap()
                  .then(img => {
                    if (img.photoUrl) {
                      setBusinessFallbacks(prev => ({...prev, [item.businessId]: {photo: img.photoUrl}}));
                    }
                  })
                  .catch(() => {});
              }
            }}
            note={assignmentNote}
            showActions={false}
            onViewDetails={() => navigation.navigate('ViewAppointment', {appointmentId: item.id})}
            onPress={() => navigation.navigate('ViewAppointment', {appointmentId: item.id})}
            onGetDirections={() => {
              if (businessAddress) openMapsToAddress(businessAddress);
            }}
            canChat={canUseChat}
            onChat={() =>
              handleChatPress({
                appointment: item,
                employee: emp,
                doctorName: cardTitle,
                petName,
              })
            }
            onChatBlocked={() => showPermissionToast('chat with vet')}
            footer={footer}
          />
        </View>
      );
    }

    return (
      <View style={styles.cardWrapper}>
        <AppointmentCard
          doctorName={cardTitle}
          specialization={cardSubtitle}
          hospital={businessName}
          dateTime={`${formattedDate} - ${item.time}`}
          avatar={avatarSource || Images.cat}
          fallbackAvatar={fallbackPhoto ?? undefined}
          onAvatarError={() => {
            if (googlePlacesId && !requestedPlacesRef.current.has(googlePlacesId)) {
              requestedPlacesRef.current.add(googlePlacesId);
              dispatch(fetchGooglePlacesImage(googlePlacesId))
                .unwrap()
                .then(img => {
                  if (img.photoUrl) {
                    setBusinessFallbacks(prev => ({...prev, [item.businessId]: {photo: img.photoUrl}}));
                  }
                })
                .catch(() => {});
            }
          }}
          showActions={false}
          onViewDetails={() => navigation.navigate('ViewAppointment', {appointmentId: item.id})}
           onPress={() => navigation.navigate('ViewAppointment', {appointmentId: item.id})}
          footer={
            <View style={styles.pastFooter}>
              <View style={styles.pastStatusWrapper}>
                <View
                  style={[
                    styles.pastStatusBadge,
                    item.status === 'CANCELLED' && styles.pastStatusBadgeCanceled,
                    item.status === 'REQUESTED' && styles.pastStatusBadgeRequested,
                    item.status === 'PAYMENT_FAILED' && styles.pastStatusBadgeFailed,
                  ]}>
                  <Text
                    style={[
                      styles.pastStatusBadgeText,
                      item.status === 'CANCELLED' && styles.pastStatusBadgeTextCanceled,
                      item.status === 'REQUESTED' && styles.pastStatusBadgeTextRequested,
                      item.status === 'PAYMENT_FAILED' && styles.pastStatusBadgeTextFailed,
                    ]}>
                    {formatStatus(item.status)}
                  </Text>
                </View>
              </View>
              {item.status === 'COMPLETED' && (
                <LiquidGlassButton
                  title="Review"
                  onPress={() => navigation.navigate('Review', {appointmentId: item.id})}
                  height={48}
                  borderRadius={12}
                  tintColor={theme.colors.secondary}
                  shadowIntensity="medium"
                  textStyle={styles.reviewButtonText}
                  style={styles.reviewButtonCard}
                />
              )}
            </View>
          }
        />
      </View>
    );
  };

  const keyExtractor = (item: (typeof filteredUpcoming)[number]) => item.id;

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <CompanionSelector
        companions={companions}
        selectedCompanionId={selectedCompanionId}
        onSelect={id => dispatch(setSelectedCompanion(id))}
        showAddButton={false}
        containerStyle={styles.companionSelector}
        requiredPermission="appointments"
        permissionLabel="appointments"
      />

      <SectionListHorizontalPills filter={filter} setFilter={setFilter} />
    </View>
  );

  const handleEndReached = () => {
    // Placeholder for future pagination when backend is available
    // console.log('Reached end of past appointments');
  };

  return (
    <SafeArea>
      <Header title="My Appointments" showBackButton={false} rightIcon={Images.addIconDark} onRightPress={handleAdd} />
      <SectionList
        style={styles.sectionList}
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.container}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.6}
        ListFooterComponent={<View style={styles.bottomSpacer} />}
      />
    </SafeArea>
  );
};

const SectionListHorizontalPills = ({
  filter,
  setFilter,
}: {
  filter: BusinessFilter;
  setFilter: (value: BusinessFilter) => void;
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const filterOptions: Array<{id: BusinessFilter; label: string}> = [
    {id: 'all', label: 'All'},
    {id: 'hospital', label: 'Hospital'},
    {id: 'groomer', label: 'Groomer'},
    {id: 'breeder', label: 'Breeder'},
    {id: 'pet_center', label: 'Pet Center'},
    {id: 'boarder', label: 'Boarder'},
  ];

  return (
    <View style={styles.pillContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContent}>
        {filterOptions.map(option => (
          <TouchableOpacity
            key={option.id}
            onPress={() => setFilter(option.id)}
            activeOpacity={0.8}
            style={[styles.pill, filter === option.id && styles.pillActive]}
          >
            <Text style={[styles.pillText, filter === option.id && styles.pillTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    sectionList: {flex: 1},
    container: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[10],
    },
    listHeader: {gap: theme.spacing[3], marginBottom: theme.spacing[4]},
    companionSelector: {marginBottom: theme.spacing[2]},
    sectionHeaderWrapper: {marginTop: theme.spacing[4], marginBottom: theme.spacing[2], gap: theme.spacing[2]},
    sectionTitle: {...theme.typography.titleMedium, color: theme.colors.secondary},
    pillContainer: {marginBottom: theme.spacing[1]},
    pillsContent: {gap: 8, paddingRight: 8},
    pill: {
      minWidth: 80,
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#302F2E',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pillActive: {backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary},
    pillText: {...theme.typography.pillSubtitleBold15, color: '#302F2E'},
    pillTextActive: {color: theme.colors.primary},
    list: {gap: 16},
    cardWrapper: {marginBottom: theme.spacing[4]},
    statusBadgePending: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing[2],
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: theme.colors.primaryTint,
    },
    statusBadgeText: {
      ...theme.typography.title,
      color: theme.colors.secondary,
    },
    reviewButtonCard: {marginTop: theme.spacing[1]},
    reviewButtonText: {...theme.typography.paragraphBold, color: theme.colors.white},
    upcomingFooter: {
      gap: theme.spacing[2],
    },
    footerButton: {
      alignSelf: 'flex-start',
    },
    secondaryActionText: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    pastFooter: {
      gap: theme.spacing[3],
      marginTop: theme.spacing[1],
    },
    pastStatusWrapper: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    pastStatusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing[2.5],
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
    },
    pastStatusBadgeText: {
      ...theme.typography.title,
      color: '#0F5132',
    },
    pastStatusBadgeCanceled: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      color: '#991B1B',
    },
    pastStatusBadgeTextCanceled: {
      color: '#991B1B',
    },
    pastStatusBadgeRequested: {
      backgroundColor: theme.colors.primaryTint,
      color: theme.colors.primary,
    },
    pastStatusBadgeTextRequested: {
      color: theme.colors.primary,
    },
    pastStatusBadgeFailed: {
      backgroundColor: 'rgba(251, 191, 36, 0.16)',
      color: '#92400E',
    },
    pastStatusBadgeTextFailed: {
      color: '#92400E',
    },
    infoTile: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[5],
      gap: theme.spacing[2],
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
    bottomSpacer: {height: theme.spacing[16]},
  });

export default MyAppointmentsScreen;
