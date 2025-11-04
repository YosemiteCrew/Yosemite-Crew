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
import {BookingSummaryCard} from '@/features/appointments/components/BookingSummaryCard';
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
  const employee = useSelector((s: RootState) => s.businesses.employees.find(e => e.id === apt?.employeeId));
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

        {/* Business & Employee Cards */}
        {business && (
          <BookingSummaryCard
            title={business.name}
            subtitlePrimary={business.address}
            subtitleSecondary={business.description}
            image={business.photo}
            interactive={false}
            style={styles.summaryCard}
          />
        )}

        {employee && (
          <BookingSummaryCard
            title={employee.name}
            subtitlePrimary={employee.specialization}
            subtitleSecondary={employee.title}
            image={employee.avatar}
            interactive={false}
            style={styles.summaryCard}
          />
        )}

        {/* Appointment Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Appointment Details</Text>
          <DetailRow label="Date & Time" value={`${new Date(apt.date).toLocaleDateString()} • ${apt.time}`} />
          <DetailRow label="Type" value={apt.type} />
          {companion && <DetailRow label="Companion" value={companion.name} />}
          {apt.concern && <DetailRow label="Concern" value={apt.concern} multiline />}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {apt.status === 'requested' && (
            <LiquidGlassButton
              title="Approve (Mock)"
              onPress={() => {
                dispatch(updateAppointmentStatus({appointmentId, status: 'approved'}));
                navigation.navigate('PaymentInvoice', {appointmentId, companionId: apt.companionId});
              }}
              height={56}
              borderRadius={16}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
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
            />
          )}
          {apt.status === 'paid' && (
            <LiquidGlassButton
              title="Check In"
              onPress={() => dispatch(updateAppointmentStatus({appointmentId, status: 'completed'}))}
              height={56}
              borderRadius={16}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
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
                  tintColor="rgba(255,255,255,0.95)"
                  forceBorder
                  borderColor={theme.colors.border}
                  textStyle={styles.secondaryButtonText}
                  shadowIntensity="none"
                />
              )}
              <LiquidGlassButton
                title="Request Reschedule"
                onPress={() => navigation.navigate('EditAppointment', {appointmentId, mode: 'reschedule'})}
                height={56}
                borderRadius={16}
                tintColor="rgba(255,255,255,0.95)"
                forceBorder
                borderColor={theme.colors.border}
                textStyle={styles.secondaryButtonText}
                shadowIntensity="none"
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
    gap: theme.spacing[4],
  },
  statusCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    padding: theme.spacing[4],
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
  secondaryButtonText: {
    ...theme.typography.titleSmall,
    color: theme.colors.secondary,
  },
  alertButtonText: {
    ...theme.typography.titleSmall,
    color: '#EF4444',
  },
});

export default ViewAppointmentScreen;
