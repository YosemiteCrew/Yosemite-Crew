import React, {useEffect} from 'react';
import {
  SectionList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
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
import {
  fetchAppointmentsForCompanion,
} from '@/features/appointments/appointmentsSlice';
import {setSelectedCompanion} from '@/features/companion';
import {createSelectUpcomingAppointments, createSelectPastAppointments} from '@/features/appointments/selectors';
import type {Appointment} from '@/features/appointments/types';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {openMapsToAddress, openMapsToPlaceId} from '@/shared/utils/openMaps';
import {formatDateLocale, formatTimeLocale} from '@/features/appointments/utils/timeFormatting';
import {useAutoSelectCompanion} from '@/shared/hooks/useAutoSelectCompanion';
import {useBusinessPhotoFallback} from '@/features/appointments/hooks/useBusinessPhotoFallback';
import {transformAppointmentCardData} from '@/features/appointments/utils/appointmentCardData';
import {handleChatActivation} from '@/features/appointments/utils/chatActivation';
import {getBusinessCoordinates as getBusinessCoordinatesUtil} from '@/features/appointments/utils/businessCoordinates';
import {usePermissions} from '@/shared/hooks/usePermissions';
import {showPermissionDeniedToast} from '@/shared/utils/permissionToast';
import {useCheckInHandler} from '@/features/appointments/hooks/useCheckInHandler';
import {useAppointmentDataMaps} from '@/features/appointments/hooks/useAppointmentDataMaps';
import {useFetchPhotoFallbacks} from '@/features/appointments/hooks/useFetchPhotoFallbacks';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {appointmentApi} from '@/features/appointments/services/appointmentsService';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;
type BusinessFilter = 'all' | 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder';
type OrgRatingState = {isRated: boolean; rating?: number | null; review?: string | null; loading?: boolean};

export const MyAppointmentsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const companions = useSelector((s: RootState) => s.companion.companions);
  const selectedCompanionId = useSelector((s: RootState) => s.companion.selectedCompanionId);
  const {canUseAppointments, canUseChat} = usePermissions(selectedCompanionId);

  const upcomingSelector = React.useMemo(() => createSelectUpcomingAppointments(), []);
  const pastSelector = React.useMemo(() => createSelectPastAppointments(), []);
  const upcoming = useSelector((state: RootState) => upcomingSelector(state, selectedCompanionId ?? null));
  const past = useSelector((state: RootState) => pastSelector(state, selectedCompanionId ?? null));
  const {businessMap, employeeMap, serviceMap} = useAppointmentDataMaps();
  const [filter, setFilter] = React.useState<BusinessFilter>('all');
  const {businessFallbacks, requestBusinessPhoto, handleAvatarError} = useBusinessPhotoFallback();
  const [checkingIn, setCheckingIn] = React.useState<Record<string, boolean>>({});
  const [orgRatings, setOrgRatings] = React.useState<Record<string, OrgRatingState>>({});
  const {handleCheckIn: handleCheckInUtil} = useCheckInHandler();
  const lastFetchedCompanionIdRef = React.useRef<string | null>(null);
  useAutoSelectCompanion(companions, selectedCompanionId);

  const fetchAppointmentsOnce = React.useCallback(
    (companionId?: string | null) => {
      if (!companionId) return;
      if (lastFetchedCompanionIdRef.current === companionId) return;
      lastFetchedCompanionIdRef.current = companionId;
      dispatch(fetchAppointmentsForCompanion({companionId}));
    },
    [dispatch],
  );

  useFocusEffect(
    React.useCallback(() => {
      if (selectedCompanionId) {
        fetchAppointmentsOnce(selectedCompanionId);
      }
      return () => {
        lastFetchedCompanionIdRef.current = null;
      };
    }, [fetchAppointmentsOnce, selectedCompanionId]),
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
      fetchAppointmentsOnce(targetId);
    }
  }, [dispatch, selectedCompanionId, companions, fetchAppointmentsOnce]);

  const filteredUpcoming = React.useMemo(() => {
    const filtered = upcoming.filter(apt => {
      if (filter === 'all') return true;
      const biz = businessMap.get(apt.businessId);
      return biz?.category === filter;
    });
    return filtered.sort((a, b) => {
      const aTime = new Date(`${a.date}T${a.time ?? '00:00'}Z`).getTime();
      const bTime = new Date(`${b.date}T${b.time ?? '00:00'}Z`).getTime();
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

  // Show permission toast when appointments access is denied
  React.useEffect(() => {
    if (selectedCompanionId && !canUseAppointments) {
      showPermissionDeniedToast('appointments');
    }
  }, [canUseAppointments, selectedCompanionId]);

  // Fetch business photo fallbacks when primary photos are missing or dummy
  useFetchPhotoFallbacks(appointmentsForFallback, businessMap, requestBusinessPhoto);

  type AppointmentItem = (typeof filteredUpcoming)[number];
  type EmployeeRecord = ReturnType<typeof employeeMap.get>;
  const getCoordinatesFromUtility = React.useCallback(
    (apt: AppointmentItem | null | undefined) => {
      if (!apt) return {lat: null, lng: null};
      return getBusinessCoordinatesUtil(apt, businessMap);
    },
    [businessMap],
  );
  const formatStatus = (status: string) => {
    switch (status) {
      case 'UPCOMING':
        return 'Upcoming';
      case 'CHECKED_IN':
        return 'Checked in';
      case 'NO_PAYMENT':
      case 'AWAITING_PAYMENT':
        return 'Payment pending';
      case 'PAID':
        return 'Paid';
      case 'CONFIRMED':
      case 'SCHEDULED':
        return 'Scheduled';
      case 'IN_PROGRESS':
        return 'In progress';
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
      const openChat = () => {
        // Backend sends appointment.date and appointment.time in UTC
        // Convert to ISO format with Z suffix for proper UTC handling
        const normalized = appointment.time.length === 5
          ? `${appointment.time}:00`
          : appointment.time;
        const appointmentDateTime = `${appointment.date}T${normalized}Z`;

        navigation.navigate('ChatChannel', {
          appointmentId: appointment.id,
          vetId: employee?.id ?? appointment.employeeId ?? 'unknown-vet',
          appointmentTime: appointmentDateTime,
          doctorName,
          petName,
        });
      };

      handleChatActivation({
        appointment,
        employee,
        companions,
        doctorName,
        petName,
        onOpenChat: openChat,
      });
    },
    [navigation, companions],
  );

  const handleCheckIn = React.useCallback(
    async (appointment: AppointmentItem) => {
      await handleCheckInUtil({
        appointment,
        businessCoordinates: getCoordinatesFromUtility(appointment),
        onCheckingInChange: (id, checking) => {
          setCheckingIn(prev => ({...prev, [id]: checking}));
        },
        hasPermission: canUseAppointments,
        onPermissionDenied: () => showPermissionDeniedToast('appointments'),
      });
    },
    [handleCheckInUtil, canUseAppointments, getCoordinatesFromUtility],
  );

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
        console.warn('[Appointments] Failed to fetch rating status', error);
        setOrgRatings(prev => ({...prev, [organisationId]: {isRated: false, loading: false}}));
      }
    },
    [orgRatings],
  );

  React.useEffect(() => {
    const targets = filteredPast.filter(apt => apt.status === 'COMPLETED');
    targets.forEach(apt => {
      fetchOrgRatingIfNeeded(apt.businessId);
    });
  }, [fetchOrgRatingIfNeeded, filteredPast]);

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

  const renderUpcomingCard = ({
    item,
    cardTitle,
    cardSubtitle,
    businessName,
    dateTimeLabel,
    avatarSource,
    fallbackPhoto,
    googlePlacesId,
    assignmentNote,
    businessAddress,
    petName,
    emp,
    needsPayment,
    isRequested,
    statusAllowsActions,
    isCheckedIn,
    isInProgress,
    checkInLabel,
    checkInDisabled,
    isCheckingIn,
  }: {
    item: (typeof filteredUpcoming)[number];
    cardTitle: string;
    cardSubtitle: string;
    businessName: string;
    dateTimeLabel: string;
    avatarSource: any;
    fallbackPhoto: string | null;
    googlePlacesId: string | null;
    assignmentNote?: string;
    businessAddress: string;
    petName?: string;
    emp?: EmployeeRecord;
    needsPayment: boolean;
    isRequested: boolean;
    statusAllowsActions: boolean;
    isCheckedIn: boolean;
    isInProgress: boolean;
    checkInLabel: string;
    checkInDisabled: boolean;
    isCheckingIn: boolean;
  }) => {
    const resolvedCheckInDisabled = isCheckingIn || checkInDisabled;
    let resolvedCheckInLabel = checkInLabel;
    if (!resolvedCheckInLabel) {
      if (isInProgress) {
        resolvedCheckInLabel = 'In progress';
      } else if (isCheckedIn) {
        resolvedCheckInLabel = 'Checked in';
      } else {
        resolvedCheckInLabel = 'Check in';
      }
    }
    const paymentFooter = needsPayment ? (
      <View style={styles.upcomingFooter}>
        <LiquidGlassButton
          title="Pay now"
          onPress={() =>
            navigation.navigate('PaymentInvoice', {
              appointmentId: item.id,
              companionId: item.companionId,
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
    ) : null;

    const requestedBadge = isRequested ? (
      <View style={[styles.pastStatusBadge, styles.pastStatusBadgeRequested]}>
        <Text style={[styles.pastStatusBadgeText, styles.pastStatusBadgeTextRequested]}>Requested</Text>
      </View>
    ) : null;

    const footer =
      paymentFooter || requestedBadge ? (
        <View style={styles.upcomingFooter}>
          {requestedBadge}
          {paymentFooter}
        </View>
      ) : undefined;

    return (
      <View style={styles.cardWrapper}>
        <AppointmentCard
          doctorName={cardTitle}
          specialization={cardSubtitle}
          hospital={businessName}
          dateTime={dateTimeLabel}
          avatar={avatarSource || Images.cat}
          fallbackAvatar={fallbackPhoto ?? undefined}
          onAvatarError={() => handleAvatarError(googlePlacesId, item.businessId)}
          note={assignmentNote}
          showActions={statusAllowsActions}
          onViewDetails={() => navigation.navigate('ViewAppointment', {appointmentId: item.id})}
          onPress={() => navigation.navigate('ViewAppointment', {appointmentId: item.id})}
          onGetDirections={() => {
            if (googlePlacesId) {
              openMapsToPlaceId(googlePlacesId, businessAddress);
            } else if (businessAddress) {
              openMapsToAddress(businessAddress);
            }
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
          onChatBlocked={() => showPermissionDeniedToast('chat with vet')}
          checkInLabel={resolvedCheckInLabel}
          checkInDisabled={resolvedCheckInDisabled}
          onCheckIn={() => {
            if (!resolvedCheckInDisabled) {
              handleCheckIn(item);
            }
          }}
          footer={footer}
        />
      </View>
    );
  };

  const renderItem = ({item, section}: {item: (typeof filteredUpcoming)[number]; section: {key: string}}) => {
    if (!item || !canUseAppointments) {
      return null;
    }
    const emp = employeeMap.get(item.employeeId ?? '');
    const formattedDate = formatDateLocale(item.date);
    const timeLabel = formatTimeLocale(item.date, item.time);
    const dateTimeLabel = timeLabel ? `${formattedDate} - ${timeLabel}` : formattedDate;
    const isCheckingIn = Boolean(checkingIn[item.id]);

    const cardData = transformAppointmentCardData(
      item,
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
      petName,
      avatarSource,
      fallbackPhoto,
      googlePlacesId,
      assignmentNote,
      needsPayment,
      isRequested,
      statusAllowsActions,
      isCheckedIn,
      isInProgress,
      checkInLabel,
      checkInDisabled,
    } = cardData;

    return section.key === 'upcoming'
      ? renderUpcomingCard({
          item,
          cardTitle,
          cardSubtitle,
          businessName,
          dateTimeLabel,
          avatarSource,
          fallbackPhoto,
          googlePlacesId,
          assignmentNote,
          businessAddress,
          petName,
          emp,
          needsPayment,
          isRequested,
          statusAllowsActions,
          isCheckedIn,
          isInProgress,
          checkInLabel,
          checkInDisabled,
          isCheckingIn,
        })
      : (
          <PastAppointmentCard
            item={item}
            cardTitle={cardTitle}
            cardSubtitle={cardSubtitle}
            businessName={businessName}
            dateTimeLabel={dateTimeLabel}
            avatarSource={avatarSource}
            fallbackPhoto={fallbackPhoto}
            googlePlacesId={googlePlacesId}
            onAvatarError={handleAvatarError}
            navigation={navigation}
            styles={styles}
            orgRating={orgRatings[item.businessId]}
            formatStatus={formatStatus}
            secondaryColor={theme.colors.secondary}
          />
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

type PastAppointmentCardProps = {
  item: Appointment;
  cardTitle: string;
  cardSubtitle: string;
  businessName: string;
  dateTimeLabel: string;
  avatarSource: any;
  fallbackPhoto: string | null;
  googlePlacesId: string | null;
  onAvatarError: (googlePlacesId: string | null, businessId: string) => void;
  navigation: Nav;
  styles: ReturnType<typeof createStyles>;
  orgRating?: OrgRatingState;
  formatStatus: (status: string) => string;
  secondaryColor: string;
};

const PastAppointmentCard: React.FC<PastAppointmentCardProps> = ({
  item,
  cardTitle,
  cardSubtitle,
  businessName,
  dateTimeLabel,
  avatarSource,
  fallbackPhoto,
  googlePlacesId,
  onAvatarError,
  navigation,
  styles,
  orgRating,
  formatStatus,
  secondaryColor,
}) => {
  let ratingContent: React.ReactNode = null;

  if (item.status === 'COMPLETED') {
    if (!orgRating || orgRating.loading) {
      ratingContent = <Text style={styles.ratingLoadingText}>Checking review status...</Text>;
    } else if (orgRating.isRated) {
      ratingContent = (
        <View style={styles.ratingRow}>
          <Image source={Images.starSolid} style={styles.ratingIcon} />
          <Text style={styles.ratingValueText}>
            {orgRating.rating ?? '-'}
            /5
          </Text>
        </View>
      );
    } else {
      ratingContent = (
        <LiquidGlassButton
          title="Review"
          onPress={() => navigation.navigate('Review', {appointmentId: item.id})}
          height={48}
          borderRadius={12}
          tintColor={secondaryColor}
          shadowIntensity="medium"
          textStyle={styles.reviewButtonText}
        />
      );
    }
  }

  return (
    <View style={styles.cardWrapper}>
      <AppointmentCard
        doctorName={cardTitle}
        specialization={cardSubtitle}
        hospital={businessName}
        dateTime={dateTimeLabel}
        avatar={avatarSource || Images.cat}
        fallbackAvatar={fallbackPhoto ?? undefined}
        onAvatarError={() => onAvatarError(googlePlacesId, item.businessId)}
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
            {ratingContent}
          </View>
        }
      />
    </View>
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
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1.5],
    },
    ratingIcon: {
      width: 18,
      height: 18,
      marginRight: 8,
    },
    ratingValueText: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
    },
    ratingLoadingText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
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
