import React, {useEffect, useMemo} from 'react';
import {ScrollView, View, Text, StyleSheet, Alert, Platform, ToastAndroid} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList, TabParamList} from '@/navigation/types';
import {
  cancelAppointment,
  fetchAppointmentById,
  fetchAppointmentsForCompanion,
  checkInAppointment,
  fetchInvoiceForAppointment,
} from '@/features/appointments/appointmentsSlice';
import RescheduledInfoSheet from '@/features/appointments/components/InfoBottomSheet/RescheduledInfoSheet';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {CancelAppointmentBottomSheet, type CancelAppointmentBottomSheetRef} from '@/features/appointments/components/CancelAppointmentBottomSheet';
import {DocumentCard} from '@/shared/components/common/DocumentCard/DocumentCard';
import {fetchDocuments} from '@/features/documents/documentSlice';
import type {NavigationProp} from '@react-navigation/native';
import DocumentAttachmentViewer from '@/features/documents/components/DocumentAttachmentViewer';
import {createSelector} from '@reduxjs/toolkit';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';
import LocationService from '@/shared/services/LocationService';
import {distanceBetweenCoordsMeters} from '@/shared/utils/geoDistance';
import {ExpenseCard} from '@/features/expenses/components';
import {
  fetchExpensesForCompanion,
  selectExpensesByCompanion,
  selectHasHydratedCompanion,
} from '@/features/expenses';
import {
  resolveCategoryLabel,
  resolveSubcategoryLabel,
  resolveVisitTypeLabel,
} from '@/features/expenses/utils/expenseLabels';
import {hasInvoice, isExpensePaid, isExpensePaymentPending} from '@/features/expenses/utils/status';
import {useExpensePayment} from '@/features/expenses/hooks/useExpensePayment';
import {isDummyPhoto as isDummyPhotoUrl} from '@/features/appointments/utils/photoUtils';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {TaskCard} from '@/features/tasks/components/TaskCard/TaskCard';
import {fetchTasksForCompanion} from '@/features/tasks/thunks';
import {resolveCategoryLabel as resolveTaskCategoryLabel} from '@/features/tasks/utils/taskLabels';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const useAppointmentInvoicesData = ({
  appointmentId,
  expensesForCompanion,
  aptInvoiceId,
}: {
  appointmentId: string;
  expensesForCompanion: any[];
  aptInvoiceId?: string | null;
}) => {
  const appointmentInvoices = useMemo(() => {
    const related = expensesForCompanion.filter(
      expense => expense.appointmentId === appointmentId || (!!aptInvoiceId && expense.invoiceId === aptInvoiceId),
    );
    const deduped: typeof related = [];
    const seen = new Set<string>();
    related.forEach(exp => {
      const key = exp.invoiceId ?? exp.id;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(exp);
    });
    return deduped;
  }, [aptInvoiceId, appointmentId, expensesForCompanion]);
  const hasMultipleInvoices = (appointmentInvoices.length || (aptInvoiceId ? 1 : 0)) > 1;
  return {appointmentInvoices, hasMultipleInvoices};
};

const buildEmployeeDisplay = ({
  employee,
  apt,
  department,
  statusFlags,
}: {
  employee: any;
  apt: any;
  department: string | null;
  statusFlags: any;
}) => {
  const employeeFallback =
    !employee && (apt.employeeName || apt.employeeTitle)
      ? {
          id: apt.employeeId ?? 'provider',
          businessId: apt.businessId,
          name: apt.employeeName ?? 'Assigned provider',
          title: apt.employeeTitle ?? '',
          specialization: apt.employeeTitle ?? department ?? '',
          avatar: apt.employeeAvatar ? {uri: apt.employeeAvatar} : undefined,
        }
      : null;
  const employeeWithAvatar = employee
    ? {
        ...employee,
        specialization: apt.employeeTitle ?? employee.specialization,
        avatar: employee.avatar ?? (apt.employeeAvatar ? {uri: apt.employeeAvatar} : undefined),
      }
    : null;
  const shouldShowEmployee = !statusFlags.isPaymentPending && statusFlags.isUpcoming;
  return shouldShowEmployee ? employeeWithAvatar ?? employeeFallback ?? null : null;
};

const formatAppointmentDateTime = (apt: any) => {
  const normalizedStartTime =
    (apt.time?.length === 5 ? `${apt.time}:00` : apt.time ?? '00:00') ?? '00:00';
  const localStartDate = new Date(`${apt.date}T${normalizedStartTime}Z`);
  const dateLabel = Number.isNaN(localStartDate.getTime())
    ? apt.date
    : localStartDate.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
  const timeLabel =
    apt.time && !Number.isNaN(localStartDate.getTime())
      ? localStartDate.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})
      : apt.time ?? '';
  const dateTimeLabel = timeLabel ? `${dateLabel} • ${timeLabel}` : dateLabel;
  return {dateTimeLabel};
};

const useAppointmentRelations = (
  appointmentId: string,
  tabNavigation?: NavigationProp<TabParamList>,
) => {
  const apt = useSelector((s: RootState) => s.appointments.items.find(a => a.id === appointmentId));
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === apt?.businessId));
  const service = useSelector((s: RootState) =>
    apt?.serviceId ? s.businesses.services.find(svc => svc.id === apt.serviceId) : null,
  );
  const employee = useSelector((s: RootState) => s.businesses.employees.find(e => e.id === (apt?.employeeId ?? '')));
  const companion = useSelector((s: RootState) => s.companion.companions.find(c => c.id === apt?.companionId));
  const appointmentDocsSelector = React.useMemo(
    () =>
      createSelector(
        [(state: RootState) => state.documents.documents],
        docs => docs.filter(doc => doc.appointmentId === appointmentId),
      ),
    [appointmentId],
  );
  const appointmentDocuments = useSelector(appointmentDocsSelector);

  const handleOpenDocument = React.useCallback(
    (documentId: string) => {
      if (!tabNavigation) return;
      tabNavigation.navigate('Documents', {
        screen: 'DocumentPreview',
        params: {documentId},
      } as any);
    },
    [tabNavigation],
  );

  return {apt, business, service, employee, companion, appointmentDocuments, handleOpenDocument};
};

const useAppointmentActions = ({
  appointmentId,
  companionId,
  navigation,
  dispatch,
}: {
  appointmentId: string;
  companionId?: string;
  navigation: any;
  dispatch: AppDispatch;
}) => {
  const handlePayNow = React.useCallback(() => {
    navigation.navigate('PaymentInvoice', {
      appointmentId,
      companionId,
    });
  }, [appointmentId, companionId, navigation]);

  const handleInvoice = React.useCallback(async () => {
    try {
      await dispatch(fetchInvoiceForAppointment({appointmentId})).unwrap();
    } catch {
      // best-effort; still navigate
    }
    navigation.navigate('PaymentInvoice', {
      appointmentId,
      companionId,
    });
  }, [appointmentId, companionId, dispatch, navigation]);

  const handleCancelAppointment = React.useCallback(async () => {
    try {
      await dispatch(cancelAppointment({appointmentId})).unwrap();
      if (companionId) {
        dispatch(fetchAppointmentsForCompanion({companionId}));
      }
      navigation.goBack();
    } catch (error) {
      console.warn('[Appointment] Cancel failed', error);
    }
  }, [appointmentId, companionId, dispatch, navigation]);

  return {handlePayNow, handleInvoice, handleCancelAppointment};
};

const useStatusDisplay = (theme: any) => {
  const getStatusDisplay = (statusValue: string) => {
    switch (statusValue) {
      case 'UPCOMING':
        return {text: 'Upcoming', textColor: theme.colors.secondary, backgroundColor: theme.colors.primaryTint};
      case 'CHECKED_IN':
        return {text: 'Checked in', textColor: '#0F5132', backgroundColor: 'rgba(16, 185, 129, 0.12)'};
      case 'IN_PROGRESS':
        return {text: 'In progress', textColor: '#0F5132', backgroundColor: 'rgba(16, 185, 129, 0.12)'};
      case 'REQUESTED':
        return {text: 'Requested', textColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint};
      case 'NO_PAYMENT':
      case 'AWAITING_PAYMENT':
        return {text: 'Payment pending', textColor: '#92400E', backgroundColor: 'rgba(251, 191, 36, 0.16)'};
      case 'PAYMENT_FAILED':
        return {text: 'Payment failed', textColor: '#92400E', backgroundColor: 'rgba(251, 191, 36, 0.16)'};
      case 'PAID':
        return {text: 'Paid', textColor: '#0F5132', backgroundColor: 'rgba(16, 185, 129, 0.12)'};
      case 'CONFIRMED':
      case 'SCHEDULED':
        return {text: 'Scheduled', textColor: '#0F5132', backgroundColor: 'rgba(16, 185, 129, 0.12)'};
      case 'COMPLETED':
        return {text: 'Completed', textColor: '#0F5132', backgroundColor: 'rgba(16, 185, 129, 0.12)'};
      case 'CANCELLED':
        return {text: 'Cancelled', textColor: '#991B1B', backgroundColor: 'rgba(239, 68, 68, 0.12)'};
      case 'RESCHEDULED':
        return {text: 'Rescheduled', textColor: '#92400E', backgroundColor: 'rgba(251, 191, 36, 0.16)'};
      default:
        return {text: statusValue, textColor: theme.colors.textSecondary, backgroundColor: theme.colors.border + '40'};
    }
  };
  return getStatusDisplay;
};

const useStatusFlags = (status: string) => {
  return useMemo(() => {
    const isPaymentPending = status === 'NO_PAYMENT' || status === 'AWAITING_PAYMENT' || status === 'PAYMENT_FAILED';
    const isRequested = status === 'REQUESTED';
    const isCheckedIn = status === 'CHECKED_IN';
    const isInProgress = status === 'IN_PROGRESS';
    const isUpcoming = status === 'UPCOMING' || isCheckedIn || isInProgress;
    const isTerminal = status === 'COMPLETED' || status === 'CANCELLED';
    return {
      isPaymentPending,
      isRequested,
      isUpcoming,
      isCheckedIn,
      isInProgress,
      isTerminal,
      showPayNow: isPaymentPending && !isRequested,
      showInvoice: !isPaymentPending,
      showCancel: !isTerminal && !isPaymentPending,
    };
  }, [status]);
};

const useAppointmentDisplayData = (params: {
  apt: any;
  business: any;
  service: any;
  employee: any;
  isDummyPhoto: (photo?: string | null) => boolean;
  businessPhoto: any;
  fallbackPhoto: any;
  isRequested: boolean;
}) => {
  const {apt, business, service, employee, isDummyPhoto, businessPhoto, fallbackPhoto, isRequested} = params;
  return useMemo(() => {
    const hasAssignedEmployee = Boolean(employee);
    const cancellationNote = apt.status === 'CANCELLED'
      ? 'This appointment was cancelled. Refunds, if applicable, are processed per the clinic\'s policy and card network timelines.'
      : null;
    const businessName = business?.name || apt.organisationName || 'Clinic';
    const businessAddress = business?.address || apt.organisationAddress || '';
    const resolvedPhoto = fallbackPhoto || (isDummyPhoto(businessPhoto) ? null : businessPhoto);
    const department = service?.specialty ?? apt.type ?? service?.name ?? apt.serviceName ?? null;
    const statusHelpText = !hasAssignedEmployee && isRequested
      ? 'Your request is pending review. The business will assign a provider once it\'s approved.'
      : null;
    return {
      cancellationNote,
      businessName,
      businessAddress,
      resolvedPhoto,
      department,
      statusHelpText,
    };
  }, [apt, business, service, employee, isDummyPhoto, businessPhoto, fallbackPhoto, isRequested]);
};

const useEnsureAppointmentLoaded = ({
  apt,
  appointmentId,
  dispatch,
}: {
  apt: any;
  appointmentId: string;
  dispatch: AppDispatch;
}) => {
  useEffect(() => {
    if (!apt) {
      dispatch(fetchAppointmentById({appointmentId}));
    }
  }, [apt, appointmentId, dispatch]);
};

const useAppointmentDocumentsEffect = ({
  companionId,
  dispatch,
}: {
  companionId?: string;
  dispatch: AppDispatch;
}) => {
  useEffect(() => {
    if (companionId) {
      dispatch(fetchDocuments({companionId}));
    }
  }, [companionId, dispatch]);
};

const useBusinessPhotoEffect = ({
  googlePlacesId,
  businessPhoto,
  isDummyPhoto,
  fallbackPhoto,
  setFallbackPhoto,
  dispatch,
}: {
  googlePlacesId: string | null;
  businessPhoto: string | null;
  isDummyPhoto: (photo?: string | null) => boolean;
  fallbackPhoto: string | null;
  setFallbackPhoto: (val: string | null) => void;
  dispatch: AppDispatch;
}) => {
  useEffect(() => {
    const shouldFetch =
      !!googlePlacesId &&
      (!businessPhoto || isDummyPhoto(businessPhoto)) &&
      !fallbackPhoto;
    if (!shouldFetch) return;
    const placeId = googlePlacesId;

    const fetchPhoto = async () => {
      try {
        const res = await dispatch(fetchBusinessDetails(placeId)).unwrap();
        if (res.photoUrl) {
          setFallbackPhoto(res.photoUrl);
          return;
        }
      } catch {
        // try secondary fetch
      }
      try {
        const img = await dispatch(fetchGooglePlacesImage(placeId)).unwrap();
        if (img.photoUrl) setFallbackPhoto(img.photoUrl);
      } catch {
        // swallow
      }
    };
    fetchPhoto();
  }, [businessPhoto, dispatch, fallbackPhoto, googlePlacesId, isDummyPhoto, setFallbackPhoto]);
};

const useCheckInFlow = ({
  apt,
  appointmentId,
  companionId,
  businessCoords,
  checkInRadiusMeters,
  checkInBufferMs,
  dispatch,
}: {
  apt: any;
  appointmentId: string;
  companionId?: string;
  businessCoords: {lat: number | null; lng: number | null};
  checkInRadiusMeters: number;
  checkInBufferMs: number;
  dispatch: AppDispatch;
}) => {
  const [checkingIn, setCheckingIn] = React.useState(false);

  const formatLocalStartTime = React.useCallback(() => {
    if (!apt) return '';
    const normalizedTime =
      (apt.time ?? '00:00').length === 5 ? `${apt.time ?? '00:00'}:00` : apt.time ?? '00:00';
    const start = new Date(`${apt.date}T${normalizedTime}Z`);
    if (Number.isNaN(start.getTime())) {
      return apt.time ?? '';
    }
    return start.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
  }, [apt]);

  const isWithinCheckInWindow = React.useMemo(() => {
    if (!apt) return false;
    const normalizedTime =
      (apt.time ?? '00:00').length === 5 ? `${apt.time ?? '00:00'}:00` : apt.time ?? '00:00';
    const start = new Date(`${apt.date}T${normalizedTime}Z`).getTime();
    if (Number.isNaN(start)) {
      return true;
    }
    return Date.now() >= start - checkInBufferMs;
  }, [apt, checkInBufferMs]);

  const validateCheckInTime = React.useCallback((): boolean => {
    if (isWithinCheckInWindow) return true;
    const startLabel = formatLocalStartTime();
    Alert.alert(
      'Too early to check in',
      `You can check in starting 5 minutes before your appointment at ${startLabel}.`,
    );
    return false;
  }, [formatLocalStartTime, isWithinCheckInWindow]);

  const validateCheckInLocation = React.useCallback(async (): Promise<boolean> => {
    if (!businessCoords.lat || !businessCoords.lng) {
      Alert.alert('Location unavailable', 'Clinic location is missing. Please try again later.');
      return false;
    }
    const userCoords = await LocationService.getLocationWithRetry(2);
    if (!userCoords) return false;

    const distance = distanceBetweenCoordsMeters(
      userCoords.latitude,
      userCoords.longitude,
      businessCoords.lat,
      businessCoords.lng,
    );
    if (distance === null) {
      Alert.alert('Location unavailable', 'Unable to determine distance for check-in.');
      return false;
    }
    if (distance > checkInRadiusMeters) {
      Alert.alert(
        'Too far to check in',
        `Move closer to the clinic to check in. You are ~${Math.round(distance)}m away.`,
      );
      return false;
    }
    return true;
  }, [businessCoords.lat, businessCoords.lng, checkInRadiusMeters]);

  const handleCheckIn = React.useCallback(async () => {
    if (!validateCheckInTime()) return;
    if (!(await validateCheckInLocation())) return;

    setCheckingIn(true);
    try {
      await dispatch(checkInAppointment({appointmentId})).unwrap();
      await dispatch(fetchAppointmentById({appointmentId})).unwrap();
      if (companionId) {
        dispatch(fetchAppointmentsForCompanion({companionId}));
      }
      if (Platform.OS === 'android') {
        ToastAndroid.show('Checked in', ToastAndroid.SHORT);
      }
    } catch (error) {
      console.warn('[Appointment] Check-in failed', error);
      Alert.alert('Check-in failed', 'Unable to check in right now. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  }, [appointmentId, companionId, dispatch, validateCheckInLocation, validateCheckInTime]);

  return {checkingIn, handleCheckIn};
};

const StatusCard = ({
  styles,
  statusInfo,
  cancellationNote,
  statusHelpText,
}: {
  styles: any;
  statusInfo: any;
  cancellationNote: string | null;
  statusHelpText: string | null;
}) => (
  <View style={styles.statusCard}>
    <Text style={styles.statusLabel}>Status</Text>
    <View style={[styles.statusBadge, {backgroundColor: statusInfo.backgroundColor}]}>
      <Text style={[styles.statusText, {color: statusInfo.textColor}]}>{statusInfo.text}</Text>
    </View>
    {cancellationNote ? <Text style={styles.statusNote}>{cancellationNote}</Text> : null}
    {!cancellationNote && statusHelpText ? <Text style={styles.statusNote}>{statusHelpText}</Text> : null}
  </View>
);

const ActionButtons = ({
  styles,
  showCheckInButton,
  isCheckedIn,
  isInProgress,
  checkingIn,
  handleCheckIn,
  showPayNow,
  handlePayNow,
  showInvoice,
  handleInvoice,
  showEdit,
  handleEdit,
  showCancel,
  handleCancel,
  theme,
}: {
  styles: any;
  showCheckInButton: boolean;
  isCheckedIn: boolean;
  isInProgress: boolean;
  checkingIn: boolean;
  handleCheckIn: () => void;
  showPayNow: boolean;
  handlePayNow: () => void;
  showInvoice: boolean;
  handleInvoice: () => void;
  showEdit: boolean;
  handleEdit: () => void;
  showCancel: boolean;
  handleCancel: () => void;
  theme: any;
}) => {
  let checkInTitle = 'Check in';
  if (isInProgress) {
    checkInTitle = 'In progress';
  } else if (isCheckedIn) {
    checkInTitle = 'Checked in';
  }
  const checkInDisabled = checkingIn || isCheckedIn || isInProgress;
  return (
    <View style={styles.actionsContainer}>
      {showCheckInButton && (
        <LiquidGlassButton
          title={checkInTitle}
          onPress={handleCheckIn}
          height={56}
          borderRadius={16}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          textStyle={styles.confirmPrimaryButtonText}
          disabled={checkInDisabled}
        />
      )}

      {showPayNow && (
        <LiquidGlassButton
          title="Pay Now"
          onPress={handlePayNow}
          height={56}
          borderRadius={16}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          textStyle={styles.confirmPrimaryButtonText}
        />
      )}

      {showInvoice && (
        <LiquidGlassButton
          title="View Invoice"
          onPress={handleInvoice}
          height={56}
          borderRadius={16}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          textStyle={styles.confirmPrimaryButtonText}
        />
      )}

      {showEdit && (
        <LiquidGlassButton
          title="Edit Appointment"
          onPress={handleEdit}
          height={56}
          borderRadius={16}
          glassEffect="clear"
          tintColor={theme.colors.surface}
          forceBorder
          borderColor={theme.colors.secondary}
          textStyle={styles.secondaryButtonText}
          shadowIntensity="medium"
          interactive
        />
      )}

      {showCancel && (
        <LiquidGlassButton
          title="Cancel Appointment"
          onPress={handleCancel}
          height={56}
          borderRadius={16}
          tintColor="#FEE2E2"
          forceBorder
          borderColor="#EF4444"
          textStyle={styles.alertButtonText}
          shadowIntensity="none"
        />
      )}
    </View>
  );
};

export const ViewAppointmentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const dispatch = useDispatch<AppDispatch>();
  const {appointmentId} = route.params as {appointmentId: string};
  const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();
  const {openPaymentScreen, processingPayment} = useExpensePayment();
  const {
    apt,
    business,
    service,
    employee,
    companion,
    appointmentDocuments,
    handleOpenDocument,
  } = useAppointmentRelations(appointmentId, tabNavigation);
  const companionId = apt?.companionId ?? null;
  const hasHydratedExpenses = useSelector(selectHasHydratedCompanion(companionId));
  const expensesForCompanion = useSelector(selectExpensesByCompanion(companionId));
  const tasks = useSelector((s: RootState) => s.tasks.items);
  const tasksHydrated = useSelector(
    (s: RootState) => (companionId ? s.tasks.hydratedCompanions[companionId] : false),
  );
  const appointmentTasks = useMemo(
    () => tasks.filter(task => task.appointmentId === appointmentId),
    [appointmentId, tasks],
  );
  const {appointmentInvoices, hasMultipleInvoices} = useAppointmentInvoicesData({
    appointmentId,
    expensesForCompanion,
    aptInvoiceId: apt?.invoiceId,
  });
  const cancelSheetRef = React.useRef<CancelAppointmentBottomSheetRef>(null);
  const rescheduledRef = React.useRef<any>(null);
  const [fallbackPhoto, setFallbackPhoto] = React.useState<string | null>(null);
  const CHECKIN_RADIUS_METERS = 200;
  const CHECKIN_BUFFER_MS = 5 * 60 * 1000;

  useEnsureAppointmentLoaded({apt, appointmentId, dispatch});
  useAppointmentDocumentsEffect({companionId: apt?.companionId, dispatch});
  useEffect(() => {
    if (companionId && !hasHydratedExpenses) {
      dispatch(fetchExpensesForCompanion({companionId}));
    }
  }, [companionId, dispatch, hasHydratedExpenses]);
  useEffect(() => {
    if (companionId && !tasksHydrated) {
      dispatch(fetchTasksForCompanion({companionId}));
    }
  }, [companionId, dispatch, tasksHydrated]);
  useFocusEffect(
    React.useCallback(() => {
      if (companionId) {
        dispatch(fetchExpensesForCompanion({companionId}));
      }
    }, [companionId, dispatch]),
  );

  const googlePlacesId = business?.googlePlacesId ?? apt?.businessGooglePlacesId ?? null;
  const businessPhoto = business?.photo ?? apt?.businessPhoto ?? null;
  const isDummyPhoto = React.useCallback((photo?: string | null) => isDummyPhotoUrl(photo), []);

  useBusinessPhotoEffect({
    googlePlacesId,
    businessPhoto,
    isDummyPhoto,
    fallbackPhoto,
    setFallbackPhoto,
    dispatch,
  });

  const businessCoords = React.useMemo(
    () => ({
      lat: business?.lat ?? apt?.businessLat ?? null,
      lng: business?.lng ?? apt?.businessLng ?? null,
    }),
    [apt?.businessLat, apt?.businessLng, business?.lat, business?.lng],
  );

  const status = apt?.status ?? 'REQUESTED';
  const getStatusDisplay = useStatusDisplay(theme);
  const statusFlags = useStatusFlags(status);
  const {
    isRequested,
    isUpcoming,
    isCheckedIn,
    isInProgress,
    isTerminal,
    showPayNow,
    showInvoice,
    showCancel,
  } = statusFlags;
  const statusInfo = getStatusDisplay(status);
  const displayData = useAppointmentDisplayData({apt, business, service, employee, isDummyPhoto, businessPhoto, fallbackPhoto, isRequested});
  const {cancellationNote, businessName, businessAddress, resolvedPhoto, department, statusHelpText} = displayData;
  const {handlePayNow, handleInvoice, handleCancelAppointment} = useAppointmentActions({
    appointmentId,
    companionId: apt?.companionId,
    navigation,
    dispatch,
  });
  const {checkingIn, handleCheckIn} = useCheckInFlow({
    apt,
    appointmentId,
    companionId: apt?.companionId,
    businessCoords,
    checkInRadiusMeters: CHECKIN_RADIUS_METERS,
    checkInBufferMs: CHECKIN_BUFFER_MS,
    dispatch,
  });
  const handleViewTask = React.useCallback(
    (taskId: string) => {
      const params = {screen: 'TaskView', params: {taskId}};
      if (tabNavigation) {
        tabNavigation.navigate('Tasks', params as any);
        return;
      }
      navigation.navigate('Tasks' as any, params as any);
    },
    [navigation, tabNavigation],
  );

  if (!apt) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <Header title="Appointment Details" showBackButton onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading appointment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const businessSummary = {
    name: businessName,
    address: businessAddress,
    description: business?.description ?? undefined,
    photo: resolvedPhoto ?? undefined,
  };
  const employeeToShow = buildEmployeeDisplay({employee, apt, department, statusFlags});
  const showCheckInButton = (isUpcoming || isCheckedIn || isInProgress) && !isTerminal;
  const {dateTimeLabel} = formatAppointmentDateTime(apt);

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header title="Appointment Details" showBackButton onBack={() => navigation.goBack()} glass={false} />
        }
        cardGap={theme.spacing['3']}
        contentPadding={theme.spacing['6']}>
        {contentPaddingStyle => (
          <ScrollView
            contentContainerStyle={[styles.container, contentPaddingStyle]}
            showsVerticalScrollIndicator={false}>

        <StatusCard
          styles={styles}
          statusInfo={statusInfo}
          cancellationNote={cancellationNote}
          statusHelpText={statusHelpText}
        />

        <SummaryCards
          business={business}
          businessSummary={businessSummary}
          service={service}
          serviceName={apt.serviceName}
          employee={employeeToShow}
          employeeDepartment={department}
          cardStyle={styles.summaryCard}
        />

        {/* Appointment Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Appointment Details</Text>
          <DetailRow label="Date & Time" value={dateTimeLabel} />
          <DetailRow label="Type" value={apt.type} />
          <DetailRow label="Service" value={service?.name ?? apt.serviceName ?? '—'} />
          <DetailRow label="Business" value={businessName} />
          {businessAddress ? <DetailRow label="Address" value={businessAddress} multiline /> : null}
          {companion && <DetailRow label="Companion" value={companion.name} />}
          {apt.species && <DetailRow label="Species" value={apt.species} />}
          {apt.breed && <DetailRow label="Breed" value={apt.breed} />}
          {apt.concern && <DetailRow label="Concern" value={apt.concern} multiline />}
        </View>

        {apt.uploadedFiles?.length ? (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Your uploaded documents</Text>
            <DocumentAttachmentViewer
              attachments={
                apt.uploadedFiles.map(f => ({
                  id: f.id ?? f.key ?? f.name ?? 'attachment',
                  name: f.name ?? f.key ?? 'Attachment',
                  viewUrl: f.url ?? undefined,
                  downloadUrl: f.url ?? undefined,
                  uri: f.url ?? undefined,
                  type: f.type ?? undefined,
                })) as any
              }
              documentTitle="Appointment attachments"
            />
          </View>
        ) : null}

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Additional documents</Text>
          {appointmentDocuments.length ? (
            appointmentDocuments.map(doc => (
              <DocumentCard
                key={doc.id}
                title={doc.title}
                businessName={doc.businessName ?? business?.name ?? 'Clinic'}
                visitType={doc.visitType ?? doc.category ?? ''}
                issueDate={doc.issueDate ?? doc.createdAt ?? ''}
                onPressView={() => handleOpenDocument(doc.id)}
                onPress={() => handleOpenDocument(doc.id)}
                showEditAction={false}
              />
            ))
          ) : (
            <Text style={styles.emptyDocsText}>No documents shared for this appointment yet.</Text>
          )}
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Tasks</Text>
          {appointmentTasks.length ? (
            appointmentTasks.map(taskItem => (
              <TaskCard
                key={taskItem.id}
                title={taskItem.title}
                categoryLabel={resolveTaskCategoryLabel(taskItem.category)}
                date={taskItem.date}
                time={taskItem.time}
                companionName={companion?.name ?? 'Companion'}
                status={taskItem.status}
                onPressView={() => handleViewTask(taskItem.id)}
                showEditAction={false}
                hideSwipeActions
                category={taskItem.category}
                details={taskItem.details}
              />
            ))
          ) : (
            <Text style={styles.emptyDocsText}>No tasks linked to this appointment.</Text>
          )}
        </View>

        {hasMultipleInvoices ? (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Invoices</Text>
            {appointmentInvoices.length ? (
              appointmentInvoices.map(expense => (
                <ExpenseCard
                  key={expense.id}
                  title={expense.title}
                  categoryLabel={resolveCategoryLabel(expense.category)}
                  subcategoryLabel={resolveSubcategoryLabel(expense.category, expense.subcategory)}
                  visitTypeLabel={resolveVisitTypeLabel(expense.visitType)}
                  date={expense.date}
                  amount={expense.amount}
                  currencyCode={expense.currencyCode}
                  onPressView={
                    expense.source === 'inApp' && hasInvoice(expense)
                      ? () => {
                          if (!processingPayment) {
                            openPaymentScreen(expense);
                          }
                        }
                      : undefined
                  }
                  showEditAction={false}
                  showPayButton={
                    expense.source === 'inApp' &&
                    isExpensePaymentPending(expense) &&
                    hasInvoice(expense)
                  }
                  onPressPay={
                    expense.source === 'inApp' && hasInvoice(expense)
                      ? () => {
                          if (!processingPayment) {
                            openPaymentScreen(expense);
                          }
                        }
                      : undefined
                  }
                  isPaid={isExpensePaid(expense)}
                  hideSwipeActions
                />
              ))
            ) : (
              <Text style={styles.emptyDocsText}>No invoices found for this appointment.</Text>
            )}
          </View>
        ) : null}

        <ActionButtons
          styles={styles}
          showCheckInButton={showCheckInButton}
          isCheckedIn={isCheckedIn}
          isInProgress={isInProgress}
          checkingIn={checkingIn}
          handleCheckIn={handleCheckIn}
          showPayNow={!hasMultipleInvoices && showPayNow}
          handlePayNow={handlePayNow}
          showInvoice={!hasMultipleInvoices && showInvoice}
          handleInvoice={handleInvoice}
          showEdit={(isRequested || statusFlags.isPaymentPending) && !isTerminal}
          handleEdit={() => navigation.navigate('EditAppointment', {appointmentId})}
          showCancel={showCancel}
          handleCancel={() => cancelSheetRef.current?.open?.()}
          theme={theme}
        />
          </ScrollView>
        )}
      </LiquidGlassHeaderScreen>

      <CancelAppointmentBottomSheet
        ref={cancelSheetRef}
        onConfirm={handleCancelAppointment}
      />
      <RescheduledInfoSheet ref={rescheduledRef} onClose={() => rescheduledRef.current?.close?.()} />
    </>
  );
};

const DetailRow = ({label, value, multiline = false}: {label: string; value: string; multiline?: boolean}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createDetailStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, multiline && styles.multiline]} numberOfLines={multiline ? 0 : 1}>
        {value}
      </Text>
    </View>
  );
};

const createDetailStyles = (theme: any) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing['2'],
      paddingVertical: theme.spacing['2'],
    },
    label: {
      ...theme.typography.body14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    value: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
      fontWeight: '600',
      flexShrink: 1,
      flexGrow: 1,
      textAlign: 'right',
    },
    multiline: {
      textAlign: 'right',
      flexWrap: 'wrap',
    },
  });

const createStyles = (theme: any) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing['4'],
    paddingBottom: theme.spacing['24'],
    gap: theme.spacing['2'],
  },
  statusNote: {
    ...theme.typography.body12,
    color: theme.colors.textSecondary,
  },
  statusCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    padding: theme.spacing['4'],
    marginBottom: theme.spacing['3'],
    gap: theme.spacing['2'],
  },
  statusLabel: {
    ...theme.typography.paragraphBold,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing['2.5'],
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    ...theme.typography.title,
  },
  summaryCard: {
    marginBottom: theme.spacing['3'],
  },
  detailsCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    padding: theme.spacing['4'],
    gap: theme.spacing['2'],
  },
  sectionTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    marginBottom: theme.spacing['3'],
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing['2'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '40',
  },
  attachmentName: {
    ...theme.typography.body14,
    color: theme.colors.secondary,
    flex: 1,
  },
  attachmentLink: {
    ...theme.typography.body14,
    color: theme.colors.primary,
    marginLeft: theme.spacing['2'],
  },
  attachmentPreview: {
    maxHeight: 220,
  },
  emptyDocsText: {
    ...theme.typography.body12,
    color: theme.colors.textSecondary,
  },
  actionsContainer: {
    gap: theme.spacing['3'],
    marginTop: theme.spacing['2'],
  },
  loadingContainer: {
    padding: theme.spacing['4'],
  },
  loadingText: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
  },
  confirmPrimaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    textAlign: 'center',
  },
  secondaryButtonText: {
    ...theme.typography.titleSmall,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
  alertButtonText: {
    ...theme.typography.titleSmall,
    color: '#EF4444',
    textAlign: 'center',
  },
});

export default ViewAppointmentScreen;
