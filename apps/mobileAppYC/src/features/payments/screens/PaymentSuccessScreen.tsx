import React, {useMemo, useCallback, useEffect} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity, Linking, ScrollView} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
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
  const {appointmentId, companionId, expenseId} = route.params as {appointmentId: string; companionId?: string; expenseId?: string};
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const appointment = useSelector((state: RootState) => state.appointments.items.find(a => a.id === appointmentId));
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
        appointment.time.length === 5 ? `${appointment.time}:00` : appointment.time;
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
  const receiptUrl = invoice?.downloadUrl ?? invoice?.paymentIntent?.paymentLinkUrl ?? null;

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
      tabNavigation?.navigate('Appointments', {screen: 'MyAppointments'} as any);
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
      header={
        <Header
          title="Successful Payment"
          showBackButton={false}
          glass={false}
        />
      }
      edges={[]}
      contentPadding={20}>
      {contentPaddingStyle => (
        <ScrollView
          contentContainerStyle={[
            styles.container,
            contentPaddingStyle,
          ]}
          showsVerticalScrollIndicator={false}>
          <Image source={Images.successPayment} style={styles.illustration} />
          <Text style={styles.title}>Thank you</Text>
          <Text style={styles.subtitle}>You have Successfully made Payment</Text>
          <View style={styles.detailsBlock}>
            <Text style={styles.detailsTitle}>Invoice Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Invoice number</Text>
              <Text style={styles.detailValue}>{invoiceNumber}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Invoice date & time</Text>
              <Text style={styles.detailValue}>{invoiceDateTime}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Invoice ID</Text>
              <Text style={styles.detailValue}>{invoice?.id ?? '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Invoice</Text>
              <TouchableOpacity
                style={styles.downloadInvoiceTouchable}
                disabled={!receiptUrl}
                onPress={handleViewInvoice}>
                <Text style={[styles.detailValue, styles.link]}>
                  {receiptUrl ? 'View invoice' : 'Not available'}
                </Text>
                {receiptUrl ? (
                  <Image source={Images.downloadInvoice} style={styles.downloadInvoiceIcon} />
                ) : null}
              </TouchableOpacity>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Appointment date</Text>
              <Text style={styles.detailValue}>{formattedAppointmentDate}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Appointment time</Text>
              <Text style={styles.detailValue}>{formattedAppointmentTime}</Text>
            </View>
          </View>
          <View style={styles.buttonContainer}>
            <LiquidGlassButton
              title={expenseId ? 'Back to Expenses' : 'Dashboard'}
              onPress={resetToMyAppointments}
              height={theme.spacing['14']}
              borderRadius={theme.borderRadius.lg}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
          </View>
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing['4'],
    paddingHorizontal: theme.spacing['4'],
    paddingBottom: theme.spacing['24'],
  },
  illustration: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.secondary,
  },
  subtitle: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  detailsBlock: {
    gap: theme.spacing['2'],
    width: '100%',
    maxWidth: theme.spacing['100'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['4'],
    backgroundColor: theme.colors.cardBackground,
    marginTop: theme.spacing['3'],
  },
  detailsTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    marginBottom: theme.spacing['2'],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing['1'],
  },
  detailLabel: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    ...theme.typography.body14,
    color: theme.colors.secondary,
  },
  link: {
    color: theme.colors.primary,
  },
  downloadInvoiceTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadInvoiceIcon: {
    width: theme.spacing['4'],
    height: theme.spacing['4'],
    marginLeft: theme.spacing['1'],
  },
  buttonContainer: {
    width: '100%',
    maxWidth: theme.spacing['100'],
    marginTop: theme.spacing['4'],
  },
  confirmPrimaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    textAlign: 'center',
  },
});

export default PaymentSuccessScreen;
