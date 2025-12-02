import React, {useEffect, useMemo} from 'react';
import {ScrollView, View, Text, StyleSheet} from 'react-native';
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

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

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
    if (!googlePlacesId) return;
    const needsPhoto = (!businessPhoto || isDummyPhoto(businessPhoto)) && !fallbackPhoto;
    if (!needsPhoto) return;
    dispatch(fetchBusinessDetails(googlePlacesId))
      .unwrap()
      .then(res => {
        if (res.photoUrl) setFallbackPhoto(res.photoUrl);
      })
      .catch(() => {
        dispatch(fetchGooglePlacesImage(googlePlacesId))
          .unwrap()
          .then(img => {
            if (img.photoUrl) setFallbackPhoto(img.photoUrl);
          })
          .catch(() => {});
      });
  }, [businessPhoto, dispatch, fallbackPhoto, googlePlacesId, isDummyPhoto]);

  if (!apt) {
    return null;
  }

  const handleOpenDocument = (documentId: string) => {
    if (tabNavigation) {
      tabNavigation.navigate('Documents', {
        screen: 'DocumentPreview',
        params: {documentId},
      } as any);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
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
        return {text: status, textColor: theme.colors.textSecondary, backgroundColor: theme.colors.border + '40'};
    }
  };

  const statusInfo = getStatusDisplay(apt.status);
  const isPaymentPending =
    apt.status === 'NO_PAYMENT' ||
    apt.status === 'AWAITING_PAYMENT' ||
    apt.status === 'PAYMENT_FAILED';
  const isRequested = apt.status === 'REQUESTED';
  const hasAssignedEmployee = Boolean(employee);
  const isTerminal = apt.status === 'COMPLETED' || apt.status === 'CANCELLED';
  const cancellationNote =
    apt.status === 'CANCELLED'
      ? 'This appointment was cancelled. Refunds, if applicable, are processed per the clinic’s policy and card network timelines.'
      : null;
  const businessName = business?.name || apt.organisationName || 'Clinic';
  const businessAddress = business?.address || apt.organisationAddress || '';
  const resolvedPhoto = fallbackPhoto || (isDummyPhoto(businessPhoto) ? null : businessPhoto);
  const businessSummary = {
    name: businessName,
    address: businessAddress,
    description: business?.description ?? undefined,
    photo: resolvedPhoto ?? undefined,
  };
  const statusHelpText =
    !hasAssignedEmployee && isRequested
      ? 'Your request is pending review. The business will assign a provider once it’s approved.'
      : null;

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
          employee={employee}
          cardStyle={styles.summaryCard}
        />

        {/* Appointment Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Appointment Details</Text>
          <DetailRow label="Date & Time" value={`${new Date(apt.date).toLocaleDateString()} • ${apt.time}`} />
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

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {isPaymentPending && !isRequested && (
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

          {!isTerminal && (
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

          {!isTerminal && !isPaymentPending && !isRequested && (
            <LiquidGlassButton
              title="Request Reschedule"
              onPress={() =>
                navigation.navigate('EditAppointment', {
                  appointmentId,
                  mode: 'reschedule',
                })
              }
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

          {!isTerminal && !isPaymentPending && (
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

          {!isTerminal && (!isPaymentPending || isRequested) && (
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
