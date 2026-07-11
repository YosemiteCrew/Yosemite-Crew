import React, {useMemo, useCallback, useEffect} from 'react';
import {View, Text, StyleSheet, Linking, ScrollView} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {NavigationProp} from '@react-navigation/native';
import type {AppointmentStackParamList, TabParamList} from '@/navigation/types';
import type {RootState, AppDispatch} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {selectInvoiceForAppointment} from '@/features/appointments/selectors';
import {fetchInvoiceForAppointment} from '@/features/appointments/appointmentsSlice';
import {markInAppExpenseStatus} from '@/features/expenses';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const PaymentSuccessScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const {appointmentId, companionId, expenseId} = route.params as {
    appointmentId: string;
    companionId?: string;
    expenseId?: string;
  };
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const appointment = useSelector((state: RootState) =>
    state.appointments.items.find(a => a.id === appointmentId),
  );
  const invoice = useSelector(selectInvoiceForAppointment(appointmentId));
  const resolvedCompanionId = companionId ?? appointment?.companionId ?? null;
  const invoiceNumber = invoice?.invoiceNumber ?? invoice?.id ?? '—';
  const invoiceDateTime = invoice?.invoiceDate
    ? new Date(invoice.invoiceDate).toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '—';
  const appointmentDateTime = useMemo(() => {
    if (appointment?.start) {
      const parsed = new Date(appointment.start);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (appointment?.date && appointment?.time) {
      const normalizedTime =
        appointment.time.length === 5
          ? `${appointment.time}:00`
          : appointment.time;
      const parsed = new Date(`${appointment.date}T${normalizedTime}Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }, [appointment?.date, appointment?.start, appointment?.time]);
  const formattedAppointmentDate = appointmentDateTime
    ? appointmentDateTime.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: deviceTimeZone,
      })
    : '—';
  const formattedAppointmentTime = appointmentDateTime
    ? appointmentDateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: deviceTimeZone,
      })
    : '—';
  const receiptUrl =
    invoice?.downloadUrl ?? invoice?.paymentIntent?.paymentLinkUrl ?? null;

  useEffect(() => {
    if (appointmentId) {
      dispatch(fetchInvoiceForAppointment({appointmentId}));
    }
    // Update expense status if payment was initiated from an expense
    if (expenseId) {
      dispatch(markInAppExpenseStatus({expenseId, status: 'PAID'}));
    }
  }, [appointmentId, expenseId, dispatch]);
  const resetToMyAppointments = useCallback(() => {
    if (resolvedCompanionId) {
      dispatch(setSelectedCompanion(resolvedCompanionId));
    }
    const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();

    // If payment was initiated from an expense, navigate back to Expenses
    if (expenseId) {
      tabNavigation?.navigate('HomeStack', {
        screen: 'ExpensesStack',
        params: {screen: 'ExpensesMain'},
      } as any);
    } else {
      // Otherwise navigate to Appointments
      tabNavigation?.navigate('Appointments', {
        screen: 'MyAppointments',
      } as any);
    }
  }, [dispatch, navigation, resolvedCompanionId, expenseId]);
  const handleViewInvoice = useCallback(() => {
    if (!receiptUrl) {
      return;
    }
    Linking.openURL(receiptUrl).catch(err =>
      console.warn('[PaymentSuccess] Failed to open invoice URL', err),
    );
  }, [receiptUrl]);

  return (
    <LiquidGlassHeaderScreen
      showBottomFade={false}
      header={<Header showBackButton={false} glass={false} />}
      edges={[]}
      contentPadding={20}>
      {contentPaddingStyle => (
        <ScrollView
          contentContainerStyle={[styles.container, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.centerBlock}>
            <View style={styles.medallionWrap}>
              <View style={styles.halo} pointerEvents="none" />
              <View style={styles.medallion}>
                <Ionicons
                  name="checkmark"
                  size={52}
                  color={theme.colors.success}
                />
              </View>
            </View>
            <Text style={styles.title}>Paid. All settled.</Text>
            <Text style={styles.subtitle}>
              You have Successfully made Payment
            </Text>
            <View style={styles.summaryCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Invoice number</Text>
                <Text
                  style={styles.detailValue}
                  numberOfLines={1}
                  ellipsizeMode="middle">
                  {invoiceNumber}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Invoice date & time</Text>
                <Text style={styles.detailValue}>{invoiceDateTime}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Invoice ID</Text>
                <Text
                  style={styles.detailValue}
                  numberOfLines={1}
                  ellipsizeMode="middle">
                  {invoice?.id ?? '—'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Appointment date</Text>
                <Text style={styles.detailValue}>
                  {formattedAppointmentDate}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Appointment time</Text>
                <Text style={styles.detailValue}>
                  {formattedAppointmentTime}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.footer}>
            <LiquidGlassButton
              title="Done"
              onPress={resetToMyAppointments}
              height={theme.spacing['14']}
              borderRadius={theme.borderRadius.button}
              tintColor={theme.colors.cta}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
            <PressableOpacity
              style={styles.receiptButton}
              disabled={!receiptUrl}
              onPress={handleViewInvoice}>
              <Text
                style={[
                  styles.receiptButtonText,
                  !receiptUrl && styles.receiptButtonTextDisabled,
                ]}>
                {receiptUrl ? 'View receipt' : 'Receipt unavailable'}
              </Text>
            </PressableOpacity>
          </View>
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['8'],
    },
    centerBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing['8'],
      gap: theme.spacing['4'],
    },
    medallionWrap: {
      width: 108,
      height: 108,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing['2'],
    },
    halo: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blueSoft,
      opacity: 0.6,
    },
    medallion: {
      width: 108,
      height: 108,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.avatarGreenBg,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.card,
    },
    title: {
      ...theme.typography.serifTitle,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.body14,
      color: theme.colors.inkMuted,
      textAlign: 'center',
      maxWidth: theme.spacing['80'],
    },
    summaryCard: {
      width: '100%',
      maxWidth: theme.spacing['100'],
      borderRadius: theme.borderRadius.cardSmall,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.hairline,
      backgroundColor: theme.colors.screen,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['1'],
      marginTop: theme.spacing['3'],
      ...theme.shadows.card,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['4'],
    },
    detailLabel: {
      ...theme.typography.body14,
      color: theme.colors.inkFaint,
      flexShrink: 0,
    },
    detailValue: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.ink,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.hairline,
    },
    footer: {
      width: '100%',
      maxWidth: theme.spacing['100'],
      alignSelf: 'center',
      gap: theme.spacing['1'],
      marginTop: theme.spacing['4'],
    },
    confirmPrimaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.ctaText,
      textAlign: 'center',
    },
    receiptButton: {
      height: theme.spacing['12'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    receiptButtonText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.blueText,
    },
    receiptButtonTextDisabled: {
      color: theme.colors.inkFaint,
    },
  });

export default PaymentSuccessScreen;
