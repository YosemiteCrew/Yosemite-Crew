import React, {useMemo} from 'react';
import {ScrollView, View, Text, StyleSheet} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {updateAppointmentStatus} from '@/features/appointments/appointmentsSlice';
import RescheduledInfoSheet from '@/features/appointments/components/InfoBottomSheet/RescheduledInfoSheet';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {CancelAppointmentBottomSheet, type CancelAppointmentBottomSheetRef} from '@/features/appointments/components/CancelAppointmentBottomSheet';

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
  const employees = useSelector((s: RootState) => s.businesses.employees);
  const employee = useSelector((s: RootState) => s.businesses.employees.find(e => e.id === (apt?.employeeId ?? '')));
  const companion = useSelector((s: RootState) => s.companion.companions.find(c => c.id === apt?.companionId));
  const cancelSheetRef = React.useRef<CancelAppointmentBottomSheetRef>(null);
  const rescheduledRef = React.useRef<any>(null);

  if (!apt) {
    return null;
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'requested': return {text: 'Pending Confirmation', color: '#F59E0B'};
      case 'approved': return {text: 'Approved - Payment Required', color: '#10B981'};
      case 'paid': return {text: 'Paid - Ready for Check-in', color: '#3B82F6'};
      case 'completed': return {text: 'Completed', color: '#10B981'};
      case 'canceled': return {text: 'Canceled', color: '#EF4444'};
      case 'rescheduled': return {text: 'Rescheduled', color: '#F59E0B'};
      default: return {text: status, color: theme.colors.textSecondary};
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
          {apt.concern && <DetailRow label="Concern" value={apt.concern} multiline />}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {apt.status === 'requested' && (
            <LiquidGlassButton
              title="Approve (Mock)"
              onPress={() => {
                const assignedEmployeeId =
                  service?.defaultEmployeeId ??
                  apt.employeeId ??
                  employees.find(e => e.businessId === apt.businessId)?.id ??
                  null;
                dispatch(updateAppointmentStatus({
                  appointmentId,
                  status: 'approved',
                  employeeId: assignedEmployeeId ?? undefined,
                }));
                navigation.navigate('PaymentInvoice', {appointmentId, companionId: apt.companionId});
              }}
              height={56}
              borderRadius={16}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
          )}
          {apt.status === 'approved' && (
            <LiquidGlassButton
              title="Pay Now"
              onPress={() => navigation.navigate('PaymentInvoice', {appointmentId, companionId: apt.companionId})}
              height={56}
              borderRadius={16}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
          )}
          {apt.status === 'paid' && (
            <LiquidGlassButton
              title="Check In"
              onPress={() => dispatch(updateAppointmentStatus({appointmentId, status: 'completed'}))}
              height={56}
              borderRadius={16}
              glassEffect="clear"
              interactive
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
          )}

          {apt.status !== 'completed' && apt.status !== 'canceled' && (
            <>
              {apt.status !== 'paid' && (
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
              <LiquidGlassButton
                title="Request Reschedule"
                onPress={() => navigation.navigate('EditAppointment', {appointmentId, mode: 'reschedule'})}
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
          dispatch(updateAppointmentStatus({appointmentId, status: 'canceled'}));
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
