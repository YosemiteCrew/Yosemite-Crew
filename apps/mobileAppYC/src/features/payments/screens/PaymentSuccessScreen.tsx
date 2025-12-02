import React, {useMemo, useCallback, useEffect} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity, Linking} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
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

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const PaymentSuccessScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const {appointmentId, companionId} = route.params as {appointmentId: string; companionId?: string};
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
  const appointmentDate = (() => {
    if (appointment?.start) {
      return new Date(appointment.start);
    }
    if (appointment?.date) {
      return new Date(`${appointment.date}T${appointment.time}:00Z`);
    }
    return null;
  })();
  const formattedAppointmentDate = appointmentDate
    ? appointmentDate.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';
  const receiptUrl = invoice?.downloadUrl ?? invoice?.paymentIntent?.paymentLinkUrl ?? null;

  useEffect(() => {
    if (appointmentId) {
      dispatch(fetchInvoiceForAppointment({appointmentId}));
    }
  }, [appointmentId, dispatch]);
  const resetToMyAppointments = useCallback(() => {
    if (resolvedCompanionId) {
      dispatch(setSelectedCompanion(resolvedCompanionId));
    }
    const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();
    tabNavigation?.navigate('Appointments', {screen: 'MyAppointments'} as any);
    navigation.reset({
      index: 0,
      routes: [{name: 'MyAppointments'}],
    });
  }, [dispatch, navigation, resolvedCompanionId]);
  const handleViewInvoice = useCallback(() => {
    if (!receiptUrl) {
      return;
    }
    Linking.openURL(receiptUrl).catch(err =>
      console.warn('[PaymentSuccess] Failed to open invoice URL', err),
    );
  }, [receiptUrl]);

  return (
    <SafeArea>
      <Header title="Successful Payment" showBackButton={false} />
      <View style={styles.container}>
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
            <Text style={styles.detailValue}>{appointment?.time ?? '—'}</Text>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Dashboard"
            onPress={resetToMyAppointments}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            textStyle={styles.confirmPrimaryButtonText}
          />
        </View>
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing[4],
    padding: theme.spacing[4],
  },
  illustration: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: theme.spacing[3],
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
    gap: theme.spacing[2],
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: theme.spacing[4],
    backgroundColor: theme.colors.cardBackground,
    marginTop: theme.spacing[3],
  },
  detailsTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    marginBottom: theme.spacing[2],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[1],
  },
  detailLabel: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    ...theme.typography.body14,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  link: {
    color: theme.colors.primary,
  },
  downloadInvoiceTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadInvoiceIcon: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: theme.spacing[4],
  },
  confirmPrimaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    textAlign: 'center',
  },
});

export default PaymentSuccessScreen;
