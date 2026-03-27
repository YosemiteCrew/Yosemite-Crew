import React, {useEffect, useMemo} from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  ToastAndroid,
  ActivityIndicator,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
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
import {
  CancelAppointmentBottomSheet,
  type CancelAppointmentBottomSheetRef,
} from '@/features/appointments/components/CancelAppointmentBottomSheet';
import {DocumentCard} from '@/shared/components/common/DocumentCard/DocumentCard';
import {fetchDocuments} from '@/features/documents/documentSlice';
import type {NavigationProp} from '@react-navigation/native';
import DocumentAttachmentViewer from '@/features/documents/components/DocumentAttachmentViewer';
import {createSelector} from '@reduxjs/toolkit';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';
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
import {
  hasInvoice,
  isExpensePaid,
  isExpensePaymentPending,
} from '@/features/expenses/utils/status';
import {useExpensePayment} from '@/features/expenses/hooks/useExpensePayment';
import {isDummyPhoto as isDummyPhotoUrl} from '@/features/appointments/utils/photoUtils';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {TaskCard} from '@/features/tasks/components/TaskCard/TaskCard';
import {fetchTasksForCompanion} from '@/features/tasks/thunks';
import {resolveCategoryLabel as resolveTaskCategoryLabel} from '@/features/tasks/utils/taskLabels';
import {
  DetailsCard,
  type DetailItem,
} from '@/shared/components/common/DetailsCard';
import {
  fetchAppointmentForms,
  selectFormsForAppointment,
  selectFormsLoading,
  type AppointmentFormEntry,
} from '@/features/forms';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import type {FormField} from '@yosemite-crew/types';
import {MerckSearchWidget} from '@/features/merck/components/MerckSearchWidget';
import {
  getAppointmentStatusLabel,
  isActionableUpcomingStatus,
  isAppointmentPaymentFailed,
  isAppointmentPaymentPending,
  isTerminalAppointmentStatus,
} from '@/features/appointments/utils/appointmentStatus';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const normalizeAvatarUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined') {
    return null;
  }
  return trimmed;
};

const toImageSource = (value: unknown): {uri: string} | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'object' && value !== null && 'uri' in value) {
    const uri = normalizeAvatarUrl((value as {uri?: unknown}).uri);
    return uri ? {uri} : undefined;
  }
  const uri = normalizeAvatarUrl(value);
  return uri ? {uri} : undefined;
};

const resolveEmployeeAvatar = (
  employee: any,
  apt: any,
  displayName?: string | null,
) => {
  const directSources = [
    employee?.avatar,
    employee?.profileUrl,
    employee?.profileImage,
    employee?.profileImageUrl,
    employee?.profilePicture,
    employee?.profilePictureUrl,
    employee?.imageUrl,
    employee?.imageURL,
    employee?.photo,
    apt?.employeeAvatar,
  ];

  for (const source of directSources) {
    const resolved = toImageSource(source);
    if (resolved) {
      return resolved;
    }
  }

  const safeName = String(displayName ?? '').trim();
  if (!safeName) {
    return undefined;
  }

  return {
    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}`,
  };
};

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
      expense =>
        expense.appointmentId === appointmentId ||
        (!!aptInvoiceId && expense.invoiceId === aptInvoiceId),
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
  const hasMultipleInvoices =
    (appointmentInvoices.length || (aptInvoiceId ? 1 : 0)) > 1;
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
  const resolvedEmployeeName =
    employee?.name ?? apt.employeeName ?? 'Assigned provider';
  const resolvedEmployeeAvatar = resolveEmployeeAvatar(
    employee,
    apt,
    resolvedEmployeeName,
  );
  const employeeFallback =
    !employee && (apt.employeeName || apt.employeeTitle)
      ? {
          id: apt.employeeId ?? 'provider',
          businessId: apt.businessId,
          name: resolvedEmployeeName,
          title: apt.employeeTitle ?? '',
          specialization: apt.employeeTitle ?? department ?? '',
          avatar: resolvedEmployeeAvatar,
        }
      : null;
  const employeeWithAvatar = employee
    ? {
        ...employee,
        specialization: apt.employeeTitle ?? employee.specialization,
        avatar: resolvedEmployeeAvatar,
      }
    : null;
  const shouldShowEmployee = statusFlags.isUpcoming;
  return shouldShowEmployee
    ? (employeeWithAvatar ?? employeeFallback ?? null)
    : null;
};

const formatAppointmentDateTime = (apt: any) => {
  const resolvedTime = apt.time ?? '00:00';
  const formattedTime =
    apt.time?.length === 5 ? `${resolvedTime}:00` : resolvedTime;
  const fallbackIso = `${apt.date}T${formattedTime}`;
  const localStartDate = apt?.start
    ? new Date(apt.start)
    : new Date(fallbackIso);
  const dateLabel = Number.isNaN(localStartDate.getTime())
    ? apt.date
    : localStartDate.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
  const timeLabel =
    apt.time && !Number.isNaN(localStartDate.getTime())
      ? localStartDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : (apt.time ?? '');
  const dateTimeLabel = timeLabel ? `${dateLabel} • ${timeLabel}` : dateLabel;
  return {dateTimeLabel};
};

const useAppointmentRelations = (
  appointmentId: string,
  tabNavigation?: NavigationProp<TabParamList>,
) => {
  const apt = useSelector((s: RootState) =>
    s.appointments.items.find(a => a.id === appointmentId),
  );
  const business = useSelector((s: RootState) =>
    s.businesses.businesses.find(b => b.id === apt?.businessId),
  );
  const service = useSelector((s: RootState) =>
    apt?.serviceId
      ? s.businesses.services.find(svc => svc.id === apt.serviceId)
      : null,
  );
  const employee = useSelector((s: RootState) =>
    s.businesses.employees.find(e => e.id === (apt?.employeeId ?? '')),
  );
  const companion = useSelector((s: RootState) =>
    s.companion.companions.find(c => c.id === apt?.companionId),
  );
  const appointmentDocsSelector = React.useMemo(
    () =>
      createSelector([(state: RootState) => state.documents.documents], docs =>
        docs.filter(doc => doc.appointmentId === appointmentId),
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

  return {
    apt,
    business,
    service,
    employee,
    companion,
    appointmentDocuments,
    handleOpenDocument,
  };
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
  const getStatusDisplay = (
    statusValue: string,
    paymentStatus?: string | null,
  ) => {
    const label = getAppointmentStatusLabel(statusValue, paymentStatus);
    const isPaymentFailed = isAppointmentPaymentFailed(
      statusValue,
      paymentStatus,
    );
    const isPaymentPending = isAppointmentPaymentPending(
      statusValue,
      paymentStatus,
    );
    if (isPaymentFailed) {
      return {
        text: label,
        textColor: theme.colors.error,
        backgroundColor: theme.colors.errorSurface,
      };
    }
    if (isPaymentPending) {
      return {
        text: label,
        textColor: theme.colors.warning,
        backgroundColor: theme.colors.warningSurface,
      };
    }
    switch (statusValue) {
      case 'UPCOMING':
        return {
          text: label,
          textColor: theme.colors.secondary,
          backgroundColor: theme.colors.primaryTint,
        };
      case 'CHECKED_IN':
        return {
          text: label,
          textColor: theme.colors.success,
          backgroundColor: theme.colors.successSurface,
        };
      case 'IN_PROGRESS':
        return {
          text: label,
          textColor: theme.colors.success,
          backgroundColor: theme.colors.successSurface,
        };
      case 'REQUESTED':
        return {
          text: label,
          textColor: theme.colors.primary,
          backgroundColor: theme.colors.primaryTint,
        };
      case 'NO_PAYMENT':
      case 'AWAITING_PAYMENT':
        return {
          text: label,
          textColor: theme.colors.warning,
          backgroundColor: theme.colors.warningSurface,
        };
      case 'PAYMENT_FAILED':
        return {
          text: label,
          textColor: theme.colors.warning,
          backgroundColor: theme.colors.warningSurface,
        };
      case 'PAID':
        return {
          text: label,
          textColor: theme.colors.success,
          backgroundColor: theme.colors.successSurface,
        };
      case 'CONFIRMED':
      case 'SCHEDULED':
        return {
          text: label,
          textColor: theme.colors.success,
          backgroundColor: theme.colors.successSurface,
        };
      case 'COMPLETED':
        return {
          text: label,
          textColor: theme.colors.success,
          backgroundColor: theme.colors.successSurface,
        };
      case 'CANCELLED':
      case 'NO_SHOW':
        return {
          text: label,
          textColor: theme.colors.error,
          backgroundColor: theme.colors.errorSurface,
        };
      case 'RESCHEDULED':
        return {
          text: label,
          textColor: theme.colors.warning,
          backgroundColor: theme.colors.warningSurface,
        };
      default:
        return {
          text: label,
          textColor: theme.colors.textSecondary,
          backgroundColor: theme.colors.borderMuted,
        };
    }
  };
  return getStatusDisplay;
};

const useStatusFlags = (status: string, paymentStatus?: string | null) => {
  return useMemo(() => {
    const isPaymentPending = isAppointmentPaymentPending(status, paymentStatus);
    const isPaymentFailed = isAppointmentPaymentFailed(status, paymentStatus);
    const requiresPayment = isPaymentPending || isPaymentFailed;
    const isRequested = status === 'REQUESTED';
    const isCheckedIn = status === 'CHECKED_IN';
    const isInProgress = status === 'IN_PROGRESS';
    const isUpcoming = isActionableUpcomingStatus(status);
    const isTerminal = isTerminalAppointmentStatus(status);
    return {
      isPaymentPending,
      isRequested,
      isUpcoming,
      isCheckedIn,
      isInProgress,
      isTerminal,
      showPayNow: requiresPayment,
      showInvoice: !requiresPayment,
      showCancel: !isTerminal && !requiresPayment,
    };
  }, [paymentStatus, status]);
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
  const {
    apt,
    business,
    service,
    employee,
    isDummyPhoto,
    businessPhoto,
    fallbackPhoto,
    isRequested,
  } = params;
  return useMemo(() => {
    const hasAssignedEmployee = Boolean(employee);
    const normalizedStatus = String(apt.status ?? '')
      .trim()
      .toUpperCase()
      .replaceAll(/[\s-]+/g, '_');
    const normalizedPaymentStatus = String(apt.paymentStatus ?? '')
      .trim()
      .toUpperCase()
      .replaceAll(/[\s-]+/g, '_');
    const isCancelledOrNoShow =
      normalizedStatus === 'CANCELLED' || normalizedStatus === 'NO_SHOW';
    const isCashPaid =
      normalizedPaymentStatus === 'PAID_CASH' ||
      normalizedPaymentStatus === 'CASH_PAID';
    const cancellationNote =
      isCancelledOrNoShow && isCashPaid
        ? 'This appointment was paid in cash. If a refund is needed after cancellation, please contact the service provider directly because cash refunds are handled by the provider organization.'
        : isCancelledOrNoShow
          ? "This appointment was cancelled. Refunds, if applicable, are processed per the provider organization's policy and card network timelines."
          : null;
    const businessName = business?.name || apt.organisationName || 'Provider';
    const businessAddress = business?.address || apt.organisationAddress || '';
    const resolvedPhoto =
      fallbackPhoto || (isDummyPhoto(businessPhoto) ? null : businessPhoto);
    const department =
      service?.specialty ??
      apt.type ??
      service?.name ??
      apt.serviceName ??
      null;
    const statusHelpText =
      !hasAssignedEmployee && isRequested
        ? "Your request is pending review. The business will assign a provider once it's approved."
        : null;
    return {
      cancellationNote,
      businessName,
      businessAddress,
      resolvedPhoto,
      department,
      statusHelpText,
    };
  }, [
    apt,
    business,
    service,
    employee,
    isDummyPhoto,
    businessPhoto,
    fallbackPhoto,
    isRequested,
  ]);
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
  }, [
    businessPhoto,
    dispatch,
    fallbackPhoto,
    googlePlacesId,
    isDummyPhoto,
    setFallbackPhoto,
  ]);
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
  const getStartDate = React.useCallback(() => {
    if (!apt) return null;
    if (apt.start) {
      const fromStart = new Date(apt.start);
      if (!Number.isNaN(fromStart.getTime())) {
        return fromStart;
      }
    }
    const normalizedTime =
      (apt.time ?? '00:00').length === 5
        ? `${apt.time ?? '00:00'}:00`
        : (apt.time ?? '00:00');
    const fromDateAndTime = new Date(`${apt.date}T${normalizedTime}`);
    if (!Number.isNaN(fromDateAndTime.getTime())) {
      return fromDateAndTime;
    }
    return null;
  }, [apt]);

  const formatLocalStartTime = React.useCallback(() => {
    const start = getStartDate();
    if (!start) {
      return apt.time ?? '';
    }
    return start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [apt, getStartDate]);

  const isWithinCheckInWindow = React.useMemo(() => {
    const startDate = getStartDate();
    if (!startDate) {
      return true;
    }
    return Date.now() >= startDate.getTime() - checkInBufferMs;
  }, [checkInBufferMs, getStartDate]);

  const validateCheckInTime = React.useCallback((): boolean => {
    if (isWithinCheckInWindow) return true;
    const startLabel = formatLocalStartTime();
    Alert.alert(
      'Too early to check in',
      `You can check in starting 5 minutes before your appointment at ${startLabel}.`,
    );
    return false;
  }, [formatLocalStartTime, isWithinCheckInWindow]);

  const validateCheckInLocation =
    React.useCallback(async (): Promise<boolean> => {
      if (!businessCoords.lat || !businessCoords.lng) {
        Alert.alert(
          'Location unavailable',
          'Provider location is missing. Please try again later.',
        );
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
        Alert.alert(
          'Location unavailable',
          'Unable to determine distance for check-in.',
        );
        return false;
      }
      if (distance > checkInRadiusMeters) {
        Alert.alert(
          'Too far to check in',
          `Move closer to the service location to check in. You are ~${Math.round(distance)}m away.`,
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
      Alert.alert(
        'Check-in failed',
        'Unable to check in right now. Please try again.',
      );
    } finally {
      setCheckingIn(false);
    }
  }, [
    appointmentId,
    companionId,
    dispatch,
    validateCheckInLocation,
    validateCheckInTime,
  ]);

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
  <View style={styles.statusShadowWrapper}>
    <LiquidGlassCard
      glassEffect="clear"
      padding="4"
      shadow="base"
      style={styles.statusCard}
      fallbackStyle={styles.statusCardFallback}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status</Text>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: statusInfo.backgroundColor},
          ]}>
          <Text style={[styles.statusText, {color: statusInfo.textColor}]}>
            {statusInfo.text}
          </Text>
        </View>
        {cancellationNote ? (
          <Text style={styles.statusNote}>{cancellationNote}</Text>
        ) : null}
        {!cancellationNote && statusHelpText ? (
          <Text style={styles.statusNote}>{statusHelpText}</Text>
        ) : null}
      </View>
    </LiquidGlassCard>
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
          height={theme.spacing['14']}
          borderRadius={theme.borderRadius.lg}
          glassEffect="clear"
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
          height={theme.spacing['14']}
          borderRadius={theme.borderRadius.lg}
          tintColor={theme.colors.errorSurface}
          forceBorder
          borderColor={theme.colors.error}
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
  const hasHydratedExpenses = useSelector(
    selectHasHydratedCompanion(companionId),
  );
  const expensesForCompanion = useSelector(
    selectExpensesByCompanion(companionId),
  );
  const tasks = useSelector((s: RootState) => s.tasks.items);
  const tasksHydrated = useSelector((s: RootState) =>
    companionId ? s.tasks.hydratedCompanions[companionId] : false,
  );
  const appointmentFormsSelector = React.useMemo(
    () => (state: RootState) => selectFormsForAppointment(state, appointmentId),
    [appointmentId],
  );
  const formsLoadingSelector = React.useMemo(
    () => (state: RootState) => selectFormsLoading(state, appointmentId),
    [appointmentId],
  );
  const appointmentForms = useSelector(appointmentFormsSelector);
  const formsLoading = useSelector(formsLoadingSelector);
  const appointmentTasks = useMemo(
    () => tasks.filter(task => task.appointmentId === appointmentId),
    [appointmentId, tasks],
  );
  const {appointmentInvoices, hasMultipleInvoices} = useAppointmentInvoicesData(
    {
      appointmentId,
      expensesForCompanion,
      aptInvoiceId: apt?.invoiceId,
    },
  );
  const cancelSheetRef = React.useRef<CancelAppointmentBottomSheetRef>(null);
  const rescheduledRef = React.useRef<any>(null);
  const [fallbackPhoto, setFallbackPhoto] = React.useState<string | null>(null);
  const CHECKIN_RADIUS_METERS = 200;
  const CHECKIN_BUFFER_MS = 5 * 60 * 1000;
  const formsFetchedRef = React.useRef(false);
  const lastFormsFetchTsRef = React.useRef(0);
  const lastTasksFetchTsRef = React.useRef(0);
  const lastDocumentsFetchTsRef = React.useRef(0);

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
  useEffect(() => {
    formsFetchedRef.current = false;
    lastFormsFetchTsRef.current = 0;
    lastTasksFetchTsRef.current = 0;
    lastDocumentsFetchTsRef.current = 0;
  }, [appointmentId]);

  useEffect(() => {
    if (apt && !formsFetchedRef.current) {
      formsFetchedRef.current = true;
      lastFormsFetchTsRef.current = Date.now();
      dispatch(
        fetchAppointmentForms({
          appointmentId,
          serviceId: apt.serviceId ?? null,
          organisationId: apt.businessId ?? null,
          species: apt.species ?? null,
        }),
      );
    }
  }, [apt, appointmentId, dispatch]);
  useFocusEffect(
    React.useCallback(() => {
      if (companionId) {
        dispatch(fetchExpensesForCompanion({companionId}));
      }
      if (apt) {
        const now = Date.now();
        const shouldFetch =
          !formsFetchedRef.current || now - lastFormsFetchTsRef.current > 3000;
        if (shouldFetch) {
          formsFetchedRef.current = true;
          lastFormsFetchTsRef.current = now;
          dispatch(
            fetchAppointmentForms({
              appointmentId,
              serviceId: apt.serviceId ?? null,
              organisationId: apt.businessId ?? null,
              species: apt.species ?? null,
            }),
          );
        }
        if (companionId) {
          const shouldFetchTasks =
            !lastTasksFetchTsRef.current ||
            now - lastTasksFetchTsRef.current > 3000;
          if (shouldFetchTasks) {
            lastTasksFetchTsRef.current = now;
            dispatch(fetchTasksForCompanion({companionId}));
          }
          const shouldFetchDocuments =
            !lastDocumentsFetchTsRef.current ||
            now - lastDocumentsFetchTsRef.current > 3000;
          if (shouldFetchDocuments) {
            lastDocumentsFetchTsRef.current = now;
            dispatch(fetchDocuments({companionId}));
          }
        }
      }
    }, [apt, appointmentId, companionId, dispatch]),
  );

  const googlePlacesId =
    business?.googlePlacesId ?? apt?.businessGooglePlacesId ?? null;
  const businessPhoto = business?.photo ?? apt?.businessPhoto ?? null;
  const isDummyPhoto = React.useCallback(
    (photo?: string | null) => isDummyPhotoUrl(photo),
    [],
  );

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
  const statusFlags = useStatusFlags(status, apt?.paymentStatus);
  const {
    isRequested,
    isCheckedIn,
    isInProgress,
    isTerminal,
    showPayNow,
    showInvoice,
    showCancel,
  } = statusFlags;
  const statusInfo = getStatusDisplay(status, apt?.paymentStatus);
  const displayData = useAppointmentDisplayData({
    apt,
    business,
    service,
    employee,
    isDummyPhoto,
    businessPhoto,
    fallbackPhoto,
    isRequested,
  });
  const {
    cancellationNote,
    businessName,
    businessAddress,
    resolvedPhoto,
    department,
    statusHelpText,
  } = displayData;
  const {handlePayNow, handleInvoice, handleCancelAppointment} =
    useAppointmentActions({
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

  const getFormStatusDisplay = React.useCallback(
    (entry: AppointmentFormEntry) => {
      switch (entry.status) {
        case 'signed':
          return {
            label: 'Signed',
            color: theme.colors.success,
            backgroundColor: theme.colors.successSurface,
          };
        case 'completed':
          return {
            label: 'Completed',
            color: theme.colors.success,
            backgroundColor: theme.colors.successSurface,
          };
        case 'signing':
          return {
            label: 'Signature pending',
            color: theme.colors.warning,
            backgroundColor: theme.colors.warningSurface,
          };
        case 'submitted':
          return {
            label: 'Submitted',
            color: theme.colors.secondary,
            backgroundColor: theme.colors.primaryTint,
          };
        default:
          return {
            label: 'Pending',
            color: theme.colors.warning,
            backgroundColor: theme.colors.warningSurface,
          };
      }
    },
    [
      theme.colors.primaryTint,
      theme.colors.secondary,
      theme.colors.success,
      theme.colors.successSurface,
      theme.colors.warning,
      theme.colors.warningSurface,
    ],
  );

  const handleOpenForm = React.useCallback(
    (
      entry: AppointmentFormEntry,
      mode: 'fill' | 'view',
      allowSign: boolean,
    ) => {
      navigation.navigate('AppointmentForm', {
        appointmentId,
        formId: entry.form._id,
        mode,
        allowSign,
      });
    },
    [appointmentId, navigation],
  );

  const formatFormValue = React.useCallback(
    (field: FormField, value: any): string => {
      if (value === undefined || value === null) {
        return '—';
      }
      if (field.type === 'date') {
        const dateObj = value instanceof Date ? value : new Date(value);
        return Number.isNaN(dateObj.getTime())
          ? '—'
          : dateObj.toLocaleDateString();
      }
      if (field.type === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      if (Array.isArray(value)) {
        return value.map(v => `${v}`).join(', ') || '—';
      }
      if (typeof value === 'object') {
        if ('url' in value && value.url) {
          return String(value.url);
        }
        return JSON.stringify(value);
      }
      return `${value}`;
    },
    [],
  );

  const getAnswerRows = React.useCallback(
    (entry: AppointmentFormEntry) => {
      if (!entry.submission) {
        return [];
      }
      const rows: Array<{id: string; label: string; value: string}> = [];
      const collect = (fields: FormField[]) => {
        fields.forEach(f => {
          if (f.type === 'group') {
            collect(f.fields);
            return;
          }
          rows.push({
            id: f.id,
            label: f.label ?? f.id,
            value: formatFormValue(f, entry.submission?.answers?.[f.id]),
          });
        });
      };
      if (entry.form.schema?.length) {
        collect(entry.form.schema);
      }
      const filtered = rows.filter(r => r.value !== '—' && r.value !== '');
      if (filtered.length) {
        return filtered;
      }
      // Fallback: show any answers even if schema was missing
      const rawAnswers = entry.submission.answers ?? {};
      const capitalize = (text: string) => {
        if (!text.length) return text;
        return text.charAt(0).toUpperCase() + text.slice(1);
      };
      return Object.entries(rawAnswers)
        .filter(
          ([, val]) =>
            val !== undefined && val !== null && `${val}`.trim() !== '',
        )
        .map(([key, val]) => ({
          id: key,
          label: capitalize(key.replaceAll('_', ' ')),
          value: `${val}`,
        }));
    },
    [formatFormValue],
  );

  const renderAnswerSummary = React.useCallback(
    (entry: AppointmentFormEntry) => {
      const filtered = getAnswerRows(entry);
      if (!filtered.length) {
        return (
          <Text style={styles.emptyDocsText}>No responses captured yet.</Text>
        );
      }

      return filtered.map(row => (
        <View key={`${entry.form._id}-${row.id}`} style={styles.answerRow}>
          <Text style={styles.answerLabel}>{row.label}</Text>
          <Text style={styles.answerValue}>{row.value}</Text>
        </View>
      ));
    },
    [
      getAnswerRows,
      styles.answerLabel,
      styles.answerRow,
      styles.answerValue,
      styles.emptyDocsText,
    ],
  );

  const renderFormCard = React.useCallback(
    (entry: AppointmentFormEntry) => {
      const formStatus = getFormStatusDisplay(entry);
      const isSigned = entry.status === 'signed';
      const showAnswers =
        entry.submission &&
        !entry.signingRequired &&
        entry.status !== 'signing' &&
        entry.status !== 'submitted';
      let action: {label: string; mode: 'view' | 'fill'; allowSign: boolean};
      if (isSigned) {
        action = {label: 'View form', mode: 'view' as const, allowSign: false};
      } else if (entry.submission && entry.signingRequired) {
        action = {label: 'View & Sign', mode: 'view' as const, allowSign: true};
      } else if (entry.submission) {
        action = {label: 'View form', mode: 'view' as const, allowSign: false};
      } else {
        action = {
          label: entry.signingRequired ? 'Fill & Sign' : 'Fill form',
          mode: 'fill' as const,
          allowSign: entry.signingRequired,
        };
      }

      return (
        <View
          key={`${entry.form._id}-${entry.submission?._id ?? 'new'}`}
          style={styles.formCardShadowWrapper}>
          <LiquidGlassCard
            glassEffect="clear"
            padding="4"
            colorScheme="light"
            shadow="base"
            style={styles.formCard}
            fallbackStyle={styles.formCardFallback}>
            <View style={styles.formCardContent}>
              <View style={styles.formHeader}>
                <View style={styles.formTitleContainer}>
                  <Text style={styles.formTitle}>{entry.form.name}</Text>
                </View>
                <View
                  style={[
                    styles.formStatusBadge,
                    {backgroundColor: formStatus.backgroundColor},
                  ]}>
                  <Text
                    style={[styles.formStatusText, {color: formStatus.color}]}>
                    {formStatus.label}
                  </Text>
                </View>
              </View>
              {entry.form.description ? (
                <Text style={styles.formDescription}>
                  {entry.form.description}
                </Text>
              ) : null}
              {showAnswers ? (
                <View style={styles.formAnswers}>
                  {renderAnswerSummary(entry)}
                </View>
              ) : null}
              <LiquidGlassButton
                title={action.label}
                onPress={() =>
                  handleOpenForm(entry, action.mode, action.allowSign)
                }
                height={48}
                borderRadius={theme.borderRadius.md}
                textStyle={styles.formButtonText}
                tintColor={theme.colors.secondary}
                shadowIntensity="medium"
              />
            </View>
          </LiquidGlassCard>
        </View>
      );
    },
    [getFormStatusDisplay, handleOpenForm, renderAnswerSummary, styles, theme],
  );

  if (!apt) {
    return (
      <SafeAreaView style={styles.root} edges={[]}>
        <Header
          title="Appointment Details"
          showBackButton
          onBack={() => navigation.goBack()}
        />
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
  const employeeToShow = buildEmployeeDisplay({
    employee,
    apt,
    department,
    statusFlags,
  });
  const showCheckInButton =
    (status === 'UPCOMING' ||
      status === 'CONFIRMED' ||
      status === 'SCHEDULED' ||
      status === 'RESCHEDULED') &&
    !isTerminal;
  const {dateTimeLabel} = formatAppointmentDateTime(apt);
  const merckOrganisationId = apt.businessId ?? null;

  const appointmentDetailItems: DetailItem[] = [
    {label: 'Date & Time', value: dateTimeLabel},
    {label: 'Type', value: apt.type},
    {label: 'Service', value: service?.name ?? apt.serviceName ?? '—'},
    {label: 'Business', value: businessName},
    {label: 'Address', value: businessAddress || '', hidden: !businessAddress},
    {label: 'Companion', value: companion?.name || '', hidden: !companion},
    {label: 'Species', value: apt.species || '', hidden: !apt.species},
    {label: 'Breed', value: apt.breed || '', hidden: !apt.breed},
    {label: 'Concern', value: apt.concern || '', hidden: !apt.concern},
  ];

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Appointment Details"
            showBackButton
            onBack={() => navigation.goBack()}
            glass={false}
          />
        }
        cardGap={theme.spacing['4']}
        contentPadding={theme.spacing['4']}>
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
              cardStyle={styles.glassCard}
              interactive={false}
            />

            <DetailsCard
              title="Appointment Details"
              items={appointmentDetailItems}
            />

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
                    businessName={
                      doc.businessName ?? business?.name ?? 'Provider'
                    }
                    visitType={doc.visitType ?? doc.category ?? ''}
                    issueDate={doc.issueDate ?? doc.createdAt ?? ''}
                    onPressView={() => handleOpenDocument(doc.id)}
                    onPress={() => handleOpenDocument(doc.id)}
                    showEditAction={false}
                  />
                ))
              ) : (
                <Text style={styles.emptyDocsText}>
                  No documents shared for this appointment yet.
                </Text>
              )}
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Forms / Prescription</Text>
              {(() => {
                if (formsLoading) {
                  return <ActivityIndicator />;
                }
                if (appointmentForms.length > 0) {
                  return appointmentForms.map(renderFormCard);
                }
                return (
                  <Text style={styles.emptyDocsText}>
                    No forms for this appointment yet.
                  </Text>
                );
              })()}
            </View>

            <MerckSearchWidget
              organisationId={merckOrganisationId}
              compact
              title="Merck Manuals"
              description="Search consumer Merck manuals while reviewing this appointment."
              onOpenFullSearch={
                merckOrganisationId
                  ? searchState =>
                      navigation.navigate('MerckManuals', {
                        organisationId: merckOrganisationId,
                        context: 'appointment',
                        initialQuery: searchState.query || undefined,
                        initialEntries: searchState.entries,
                        initialLanguage: searchState.language,
                        initialHasSearched: searchState.hasSearched,
                      })
                  : undefined
              }
            />

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
                <Text style={styles.emptyDocsText}>
                  No tasks linked to this appointment.
                </Text>
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
                      subcategoryLabel={resolveSubcategoryLabel(
                        expense.category,
                        expense.subcategory,
                      )}
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
                  <Text style={styles.emptyDocsText}>
                    No invoices found for this appointment.
                  </Text>
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
              showEdit={
                (isRequested || statusFlags.isPaymentPending) && !isTerminal
              }
              handleEdit={() =>
                navigation.navigate('EditAppointment', {appointmentId})
              }
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
      <RescheduledInfoSheet
        ref={rescheduledRef}
        onClose={() => rescheduledRef.current?.close?.()}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['4'],
    },
    statusShadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.lg,
      shadowColor: theme.colors.neutralShadow,
      overflow: 'visible',
    },
    statusCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: 0,
      gap: theme.spacing['2'],
    },
    statusCardFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    statusContainer: {
      gap: theme.spacing['3'],
      padding: theme.spacing['4'],
      backgroundColor: 'transparent',
    },
    statusNote: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    statusLabel: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing['2.5'],
      paddingVertical: 6,
      borderRadius: theme.borderRadius.lg,
    },
    statusText: {
      ...theme.typography.labelSmallBold,
    },
    summaryCard: {
      marginBottom: theme.spacing['1'],
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
      maxHeight: theme.spacing['56'],
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
      color: theme.colors.error,
      textAlign: 'center',
    },
    formCardShadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.lg,
      shadowColor: theme.colors.neutralShadow,
      overflow: 'visible',
      marginBottom: theme.spacing['3'],
    },
    formCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: 0,
      gap: theme.spacing['2'],
    },
    formCardFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    formCardContent: {
      gap: theme.spacing['2'],
      padding: theme.spacing['4'],
      backgroundColor: 'transparent',
    },
    glassCard: {
      backgroundColor: theme.colors.cardBackground,
      marginBottom: theme.spacing['2'],
    },
    cardFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
    },
    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['2'],
    },
    formTitleContainer: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    formTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    formMeta: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    formStatusBadge: {
      paddingHorizontal: theme.spacing['2.5'],
      paddingVertical: 6,
      borderRadius: theme.borderRadius.lg,
    },
    formStatusText: {
      ...theme.typography.labelXxsBold,
    },
    formDescription: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    formAnswers: {
      gap: theme.spacing['2'],
    },
    formButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
    },
    formAccordionContent: {
      gap: theme.spacing['2'],
    },
    answerRow: {
      gap: theme.spacing['1'],
    },
    answerLabel: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    answerValue: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
    },
  });

export default ViewAppointmentScreen;
