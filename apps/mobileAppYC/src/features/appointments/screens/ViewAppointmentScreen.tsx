import React, {useEffect, useMemo} from 'react';
import {ScrollView, View, Text, StyleSheet, Alert, Platform, ToastAndroid} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {useNavigation, useRoute} from '@react-navigation/native';
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

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const useStatusDisplay = (theme: any) => {
  const getStatusDisplay = (statusValue: string) => {
    switch (statusValue) {
      case 'UPCOMING':
        return {text: 'Upcoming', textColor: theme.colors.secondary, backgroundColor: theme.colors.primaryTint};
      case 'CHECKED_IN':
        return {text: 'Checked in', textColor: '#0F5132', backgroundColor: 'rgba(16, 185, 129, 0.12)'};
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
    const isUpcoming = status === 'UPCOMING';
    const isCheckedIn = status === 'CHECKED_IN';
    const isTerminal = status === 'COMPLETED' || status === 'CANCELLED';
    return {
      isPaymentPending,
      isRequested,
      isUpcoming,
      isCheckedIn,
      isTerminal,
      showPayNow: isPaymentPending && !isRequested,
      showInvoice: true,
      showCancel: !isTerminal,
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

export const ViewAppointmentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const dispatch = useDispatch<AppDispatch>();
  const {appointmentId} = route.params as {appointmentId: string};
  const apt = useSelector((s: RootState) => s.appointments.items.find(a => a.id === appointmentId));
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === apt?.businessId));
  const service = useSelector((s: RootState) =>
    apt?.serviceId ? s.businesses.services.find(svc => svc.id === apt.serviceId) : null,
  );
  const employee = useSelector((s: RootState) => s.businesses.employees.find(e => e.id === (apt?.employeeId ?? '')));
  const companion = useSelector((s: RootState) => s.companion.companions.find(c => c.id === apt?.companionId));
  const cancelSheetRef = React.useRef<CancelAppointmentBottomSheetRef>(null);
  const rescheduledRef = React.useRef<any>(null);
  const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();
  const appointmentDocsSelector = React.useMemo(
    () =>
      createSelector(
        [(state: RootState) => state.documents.documents],
        docs => docs.filter(doc => doc.appointmentId === appointmentId),
      ),
    [appointmentId],
  );
  const appointmentDocuments = useSelector(appointmentDocsSelector);
  const [fallbackPhoto, setFallbackPhoto] = React.useState<string | null>(null);
  const CHECKIN_RADIUS_METERS = 200;
  const CHECKIN_BUFFER_MS = 5 * 60 * 1000;
  const [checkingIn, setCheckingIn] = React.useState(false);

  useEffect(() => {
    if (!apt) {
      dispatch(fetchAppointmentById({appointmentId}));
    }
  }, [apt, appointmentId, dispatch]);

  useEffect(() => {
    if (apt?.companionId) {
      dispatch(fetchDocuments({companionId: apt.companionId}));
    }
  }, [apt?.companionId, dispatch]);

  const googlePlacesId = business?.googlePlacesId ?? apt?.businessGooglePlacesId ?? null;
  const businessPhoto = business?.photo ?? apt?.businessPhoto ?? null;
  const isDummyPhoto = React.useCallback(
    (photo?: string | null) =>
      typeof photo === 'string' &&
      (photo.includes('example.com') || photo.includes('placeholder')),
    [],
  );

  useEffect(() => {
    if (!googlePlacesId || (!businessPhoto || isDummyPhoto(businessPhoto)) === false || fallbackPhoto) return;
    const fetchPhoto = async () => {
      try {
        const res = await dispatch(fetchBusinessDetails(googlePlacesId)).unwrap();
        if (res.photoUrl) setFallbackPhoto(res.photoUrl);
      } catch {
        try {
          const img = await dispatch(fetchGooglePlacesImage(googlePlacesId)).unwrap();
          if (img.photoUrl) setFallbackPhoto(img.photoUrl);
        } catch {}
      }
    };
    fetchPhoto();
  }, [businessPhoto, dispatch, fallbackPhoto, googlePlacesId, isDummyPhoto]);

  const businessCoords = React.useMemo(
    () => ({
      lat: business?.lat ?? apt?.businessLat ?? null,
      lng: business?.lng ?? apt?.businessLng ?? null,
    }),
    [apt?.businessLat, apt?.businessLng, business?.lat, business?.lng],
  );

  const isWithinCheckInWindow = React.useMemo(() => {
    if (!apt) return false;
    const normalizedTime =
      (apt.time ?? '00:00').length === 5 ? `${apt.time ?? '00:00'}:00` : apt.time ?? '00:00';
    const start = new Date(`${apt.date}T${normalizedTime}Z`).getTime();
    if (Number.isNaN(start)) {
      return true;
    }
    return Date.now() >= start - CHECKIN_BUFFER_MS;
  }, [apt, CHECKIN_BUFFER_MS]);

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

  const status = apt?.status ?? 'REQUESTED';
  const getStatusDisplay = useStatusDisplay(theme);
  const statusFlags = useStatusFlags(status);
  const {isRequested, isUpcoming, isCheckedIn, isTerminal, showPayNow, showInvoice, showCancel} =
    statusFlags;
  const statusInfo = getStatusDisplay(status);
  const displayData = useAppointmentDisplayData({apt, business, service, employee, isDummyPhoto, businessPhoto, fallbackPhoto, isRequested});
  const {cancellationNote, businessName, businessAddress, resolvedPhoto, department, statusHelpText} = displayData;

  if (!apt) {
    return (
      <SafeArea>
        <Header title="Appointment Details" showBackButton onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading appointment...</Text>
        </View>
      </SafeArea>
    );
  }

  const handleOpenDocument = (documentId: string) => {
    if (tabNavigation) {
      tabNavigation.navigate('Documents', {
        screen: 'DocumentPreview',
        params: {documentId},
      } as any);
    }
  };
  const businessSummary = {
    name: businessName,
    address: businessAddress,
    description: business?.description ?? undefined,
    photo: resolvedPhoto ?? undefined,
  };
  const employeeFallback =
    !employee && (apt.employeeName || apt.employeeTitle)
      ? {
          id: apt.employeeId ?? 'provider',
          businessId: apt.businessId,
          name: apt.employeeName ?? 'Assigned provider',
          title: apt.employeeTitle ?? '',
          specialization: apt.employeeTitle ?? department ?? '',
          avatar: undefined,
        }
      : null;
  const showCheckInButton = (isUpcoming || isCheckedIn) && !isTerminal;
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

  const renderActionButtons = () => (
    <View style={styles.actionsContainer}>
      {showCheckInButton && (
        <LiquidGlassButton
          title={isCheckedIn ? 'Checked in' : 'Check in'}
          onPress={handleCheckIn}
          height={56}
          borderRadius={16}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          textStyle={styles.confirmPrimaryButtonText}
          disabled={checkingIn || isCheckedIn}
        />
      )}

      {showPayNow && (
        <LiquidGlassButton
          title="Pay Now"
          onPress={() =>
            navigation.navigate('PaymentInvoice', {
              appointmentId,
              companionId: apt.companionId,
            })
          }
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
          onPress={async () => {
            try {
              await dispatch(fetchInvoiceForAppointment({appointmentId})).unwrap();
            } catch {
              // best-effort; still navigate
            }
            navigation.navigate('PaymentInvoice', {
              appointmentId,
              companionId: apt.companionId,
            });
          }}
          height={56}
          borderRadius={16}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          textStyle={styles.confirmPrimaryButtonText}
        />
      )}

      {isRequested && !isTerminal && (
        <LiquidGlassButton
          title="Edit Appointment"
          onPress={() => navigation.navigate('EditAppointment', {appointmentId})}
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
          onPress={() => cancelSheetRef.current?.open?.()}
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

  const handleCancelAppointment = async () => {
    try {
      await dispatch(cancelAppointment({appointmentId})).unwrap();
      if (apt?.companionId) {
        dispatch(fetchAppointmentsForCompanion({companionId: apt.companionId}));
      }
      navigation.goBack();
    } catch (error) {
      console.warn('[Appointment] Cancel failed', error);
    }
  };

  const validateCheckInTime = (): boolean => {
    if (isWithinCheckInWindow) return true;
    const startLabel = formatLocalStartTime();
    Alert.alert(
      'Too early to check in',
      `You can check in starting 5 minutes before your appointment at ${startLabel}.`,
    );
    return false;
  };

  const validateCheckInLocation = async (): Promise<boolean> => {
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
    if (distance > CHECKIN_RADIUS_METERS) {
      Alert.alert(
        'Too far to check in',
        `Move closer to the clinic to check in. You are ~${Math.round(distance)}m away.`,
      );
      return false;
    }
    return true;
  };

  const handleCheckIn = async () => {
    if (!validateCheckInTime()) return;
    if (!(await validateCheckInLocation())) return;

    setCheckingIn(true);
    try {
      await dispatch(checkInAppointment({appointmentId})).unwrap();
      await dispatch(fetchAppointmentById({appointmentId})).unwrap();
      if (apt?.companionId) {
        dispatch(fetchAppointmentsForCompanion({companionId: apt.companionId}));
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
  };

  return (
    <SafeArea>
      <Header title="Appointment Details" showBackButton onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status</Text>
          <View style={[styles.statusBadge, {backgroundColor: statusInfo.backgroundColor}]}>
            <Text style={[styles.statusText, {color: statusInfo.textColor}]}>{statusInfo.text}</Text>
          </View>
          {cancellationNote ? <Text style={styles.statusNote}>{cancellationNote}</Text> : null}
          {!cancellationNote && statusHelpText ? <Text style={styles.statusNote}>{statusHelpText}</Text> : null}
        </View>

        <SummaryCards
          business={business}
          businessSummary={businessSummary}
          service={service}
          serviceName={apt.serviceName}
          employee={employee ?? employeeFallback ?? null}
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
          <Text style={styles.sectionTitle}>Clinic documents</Text>
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

        {renderActionButtons()}
      </ScrollView>

      <CancelAppointmentBottomSheet
        ref={cancelSheetRef}
        onConfirm={handleCancelAppointment}
      />
      <RescheduledInfoSheet ref={rescheduledRef} onClose={() => rescheduledRef.current?.close?.()} />
    </SafeArea>
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
      alignItems: 'flex-start',
      gap: theme.spacing[2],
      paddingVertical: theme.spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + '40',
    },
    label: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
    },
    value: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
      fontWeight: '500',
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
  container: {
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[24],
    gap: theme.spacing[2],
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
    padding: theme.spacing[4],
    marginBottom: theme.spacing[3],
    gap: theme.spacing[2],
  },
  statusLabel: {
    ...theme.typography.paragraphBold,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing[2.5],
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    ...theme.typography.title,
  },
  summaryCard: {
    marginBottom: theme.spacing[3],
  },
  detailsCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
  sectionTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    marginBottom: theme.spacing[3],
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[2],
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
    marginLeft: theme.spacing[2],
  },
  attachmentPreview: {
    maxHeight: 220,
  },
  emptyDocsText: {
    ...theme.typography.body12,
    color: theme.colors.textSecondary,
  },
  actionsContainer: {
    gap: theme.spacing[3],
    marginTop: theme.spacing[2],
  },
  loadingContainer: {
    padding: theme.spacing[4],
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
