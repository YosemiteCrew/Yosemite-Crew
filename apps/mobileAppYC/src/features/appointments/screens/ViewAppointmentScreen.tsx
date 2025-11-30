import React, {useEffect, useMemo} from 'react';
import {ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity} from 'react-native';
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
} from '@/features/appointments/appointmentsSlice';
import RescheduledInfoSheet from '@/features/appointments/components/InfoBottomSheet/RescheduledInfoSheet';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {CancelAppointmentBottomSheet, type CancelAppointmentBottomSheetRef} from '@/features/appointments/components/CancelAppointmentBottomSheet';
import {DocumentCard} from '@/shared/components/common/DocumentCard/DocumentCard';
import {fetchDocuments} from '@/features/documents/documentSlice';
import type {NavigationProp} from '@react-navigation/native';
import DocumentAttachmentViewer from '@/features/documents/components/DocumentAttachmentViewer';
import {createSelector} from '@reduxjs/toolkit';

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

  const handleOpenAttachment = (url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(err => console.warn('Failed to open attachment', err));
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'NO_PAYMENT':
      case 'AWAITING_PAYMENT':
        return {text: 'Payment pending', color: '#F59E0B'};
      case 'PAYMENT_FAILED':
        return {text: 'Payment failed', color: '#F59E0B'};
      case 'PAID':
        return {text: 'Paid', color: '#3B82F6'};
      case 'CONFIRMED':
      case 'SCHEDULED':
        return {text: 'Scheduled', color: '#10B981'};
      case 'COMPLETED':
        return {text: 'Completed', color: '#10B981'};
      case 'CANCELLED':
        return {text: 'Cancelled', color: '#EF4444'};
      case 'RESCHEDULED':
        return {text: 'Rescheduled', color: '#F59E0B'};
      default:
        return {text: status, color: theme.colors.textSecondary};
    }
  };

  const statusInfo = getStatusDisplay(apt.status);

  return (
    <SafeArea>
      <Header title="Appointment Details" showBackButton onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status</Text>
          <View style={[styles.statusBadge, {backgroundColor: statusInfo.color + '20'}]}>
            <Text style={[styles.statusText, {color: statusInfo.color}]}>{statusInfo.text}</Text>
          </View>
        </View>

        <SummaryCards
          business={business}
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
          {(apt.status === 'NO_PAYMENT' ||
            apt.status === 'AWAITING_PAYMENT' ||
            apt.status === 'PAYMENT_FAILED') && (
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

          {apt.status !== 'COMPLETED' && apt.status !== 'CANCELLED' && (
            <>
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
            </>
          )}
        </View>
      </ScrollView>

      <CancelAppointmentBottomSheet
        ref={cancelSheetRef}
        onConfirm={() => {
          dispatch(cancelAppointment({appointmentId}));
          navigation.goBack();
        }}
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
    ...theme.typography.body12,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    ...theme.typography.titleSmall,
    fontWeight: '600',
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
