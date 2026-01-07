import React, {useEffect} from 'react';
import {
  SectionList,
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {AppointmentCard} from '@/shared/components/common/AppointmentCard/AppointmentCard';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {FilterPills, type FilterOption} from '@/shared/components/common/FilterPills';
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
import {baseTileContainer, sharedTileStyles} from '@/shared/styles/tileStyles';
import {useCheckInHandler} from '@/features/appointments/hooks/useCheckInHandler';
import {useAppointmentDataMaps} from '@/features/appointments/hooks/useAppointmentDataMaps';
import {useFetchPhotoFallbacks} from '@/features/appointments/hooks/useFetchPhotoFallbacks';
import {useFetchOrgRatingIfNeeded, type OrgRatingState} from '@/features/appointments/hooks/useOrganisationRating';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;
type BusinessFilter = 'all' | 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder';

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

  const FILTER_OPTIONS: FilterOption<BusinessFilter>[] = [
    {id: 'all', label: 'All'},
    {id: 'hospital', label: 'Hospital'},
    {id: 'groomer', label: 'Groomer'},
    {id: 'breeder', label: 'Breeder'},
    {id: 'boarder', label: 'Boarder'},
  ];

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

  const fetchOrgRatingIfNeeded = useFetchOrgRatingIfNeeded({
    orgRatings,
    setOrgRatings,
    logTag: 'Appointments',
  });

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
      colorScheme='light'
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
          height={theme.spacing['12']}
          borderRadius={theme.borderRadius.md}
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
    } = cardData;
    const {
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
            theme={theme}
          />
        );
  };

  const keyExtractor = (item: (typeof filteredUpcoming)[number]) => item.id;


  const handleEndReached = () => {
    // Placeholder for future pagination when backend is available
    // console.log('Reached end of past appointments');
  };

  return (
    <LiquidGlassHeaderScreen
      header={
        <>
          <Header
            title="My Appointments"
            showBackButton={false}
            rightIcon={Images.addIconDark}
            onRightPress={handleAdd}
            glass={false}
          />
          <View style={styles.pillContainer}>
            <FilterPills<BusinessFilter>
              options={FILTER_OPTIONS}
              selected={filter}
              onSelect={setFilter}
            />
          </View>
        </>
      }
      cardGap={theme.spacing['3']}
      contentPadding={theme.spacing['1']}>
      {contentPaddingStyle => (
        <SectionList
          style={styles.sectionList}
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={
            <CompanionSelector
              companions={companions}
              selectedCompanionId={selectedCompanionId}
              onSelect={id => dispatch(setSelectedCompanion(id))}
              showAddButton={false}
              containerStyle={styles.companionSelector}
              requiredPermission="appointments"
              permissionLabel="appointments"
            />
          }
          contentContainerStyle={[styles.container, contentPaddingStyle]}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={<View style={styles.bottomSpacer} />}
        />
      )}
    </LiquidGlassHeaderScreen>
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
  theme: any;
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
  theme,
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
          height={theme.spacing['12']}
          borderRadius={theme.borderRadius.md}
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    sectionList: {flex: 1},
    container: {
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['18'],
    },
    listHeader: {gap: theme.spacing['3'], marginBottom: theme.spacing['4']},
    companionSelector: {
      marginTop: theme.spacing['4'],
    },
    sectionHeaderWrapper: {marginTop: theme.spacing['4'], marginBottom: theme.spacing['2'], gap: theme.spacing['2']},
    sectionTitle: {...theme.typography.sectionHeading, color: theme.colors.secondary},
    pillContainer: {marginBottom: theme.spacing['3'], marginTop: 6},
    list: {gap: theme.spacing['4']},
    cardWrapper: {marginBottom: theme.spacing['4']},
    statusBadgePending: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['2'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.primaryTint,
    },
    statusBadgeText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.secondary,
    },
    reviewButtonCard: {marginTop: theme.spacing['1']},
    reviewButtonText: {...theme.typography.paragraphBold, color: theme.colors.white},
    upcomingFooter: {
      gap: theme.spacing['2'],
    },
    footerButton: {
      alignSelf: 'flex-start',
    },
    secondaryActionText: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    pastFooter: {
      gap: theme.spacing['3'],
      marginTop: theme.spacing['1'],
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
    },
    ratingIcon: {
      width: theme.spacing['4.5'],
      height: theme.spacing['4.5'],
      marginRight: theme.spacing['2'],
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
      paddingHorizontal: theme.spacing['2.5'],
      paddingVertical: theme.spacing['2'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.success,
    },
    pastStatusBadgeText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.text,
    },
    pastStatusBadgeCanceled: {
      backgroundColor: theme.colors.errorSurface,
      color: theme.colors.error,
    },
    pastStatusBadgeTextCanceled: {
      color: theme.colors.error,
    },
    pastStatusBadgeRequested: {
      backgroundColor: theme.colors.primaryTint,
      color: theme.colors.primary,
    },
    pastStatusBadgeTextRequested: {
      color: theme.colors.primary,
    },
    pastStatusBadgeFailed: {
      backgroundColor: theme.colors.warning,
      color: theme.colors.text,
    },
    pastStatusBadgeTextFailed: {
      color: theme.colors.text,
    },
    infoTile: {
      ...baseTileContainer(theme),
      padding: theme.spacing['5'],
      gap: theme.spacing['2'],
      overflow: 'hidden',
    },
    tileFallback: sharedTileStyles(theme).tileFallback,
    tileTitle: sharedTileStyles(theme).tileTitle,
    tileSubtitle: sharedTileStyles(theme).tileSubtitle,
    bottomSpacer: {height: theme.spacing['16']},
  });

export default MyAppointmentsScreen;
