import React, {useMemo, useState, useEffect} from 'react';
import {ScrollView, View, Text, StyleSheet, Image, Alert} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {selectInvoiceForAppointment} from '@/features/appointments/selectors';
import {recordPayment} from '@/features/appointments/appointmentsSlice';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {Images} from '@/assets/images';
import type {InvoiceItem, Invoice, PaymentIntentInfo} from '@/features/appointments/types';
import {selectAuthUser} from '@/features/auth/selectors';
import {useStripe} from '@stripe/stripe-react-native';
import {STRIPE_CONFIG} from '@/config/variables';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const buildInvoiceItemKey = ({
  description,
  rate,
  lineTotal,
  qty,
}: InvoiceItem) => `${description}-${rate}-${lineTotal}-${qty ?? 0}`;

export const PaymentInvoiceScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const route = useRoute<any>();
  const navigation = useNavigation<Nav>();
  const dispatch = useDispatch<AppDispatch>();
  const routeParams = (route.params ?? {}) as {
    appointmentId?: string;
    companionId?: string;
    invoice?: Invoice | null;
    paymentIntent?: PaymentIntentInfo | null;
  };
  const appointmentId = routeParams.appointmentId ?? '';
  const companionId = routeParams.companionId;
  const routeInvoice = routeParams.invoice;
  const routeIntent = routeParams.paymentIntent;

  const invoiceFromStore = useSelector(
    appointmentId ? selectInvoiceForAppointment(appointmentId) : () => null,
  );
  const invoice = invoiceFromStore ?? routeInvoice ?? null;
  const fallbackPaymentIntent = routeIntent ?? routeInvoice?.paymentIntent ?? null;
  const apt = useSelector((s: RootState) =>
    appointmentId ? s.appointments.items.find(a => a.id === appointmentId) : undefined,
  );
  const business = useSelector((s: RootState) =>
    apt?.businessId ? s.businesses.businesses.find(b => b.id === apt.businessId) : undefined,
  );
  const service = useSelector((s: RootState) =>
    apt?.serviceId
      ? s.businesses.services.find(svc => svc.id === apt.serviceId)
      : null,
  );
  const companion = useSelector((s: RootState) =>
    companionId ?? apt?.companionId
      ? s.companion.companions.find(
          c => c.id === (companionId ?? apt?.companionId),
        )
      : null,
  );
  const authUser = useSelector(selectAuthUser);

  const guardianName =
    [authUser?.firstName, authUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    authUser?.email ||
    invoice?.billedToName ||
    'Pet guardian';
  const companionName = companion?.name ?? 'Companion';
  const guardianInitial = guardianName.trim().charAt(0).toUpperCase() || 'Y';
  const companionInitial = companionName.trim().charAt(0).toUpperCase() || 'C';
  const guardianAvatar = authUser?.profilePicture
    ? {uri: authUser.profilePicture}
    : null;
  const companionAvatar = companion?.profileImage
    ? {uri: companion.profileImage}
    : null;
  const guardianEmail = authUser?.email ?? invoice?.billedToEmail ?? '—';
  const guardianAddress = useMemo(() => {
    const addressParts = [
      authUser?.address?.addressLine,
      authUser?.address?.city,
      authUser?.address?.stateProvince,
      authUser?.address?.postalCode,
    ].filter(Boolean);
    if (addressParts.length > 0) {
      return addressParts.join(', ');
    }
    return business?.address ?? invoice?.billedToName ?? '—';
  }, [
    authUser?.address?.addressLine,
    authUser?.address?.city,
    authUser?.address?.stateProvince,
    authUser?.address?.postalCode,
    business?.address,
    invoice?.billedToName,
  ]);

  const {initPaymentSheet, presentPaymentSheet} = useStripe();
  const [presentingSheet, setPresentingSheet] = useState(false);
  const paymentIntent = invoice?.paymentIntent ?? fallbackPaymentIntent ?? null;
  const baseInvoice: Invoice | null =
    invoice ??
    (paymentIntent
      ? {
          id: paymentIntent.paymentIntentId ?? `pi-${appointmentId}`,
          appointmentId,
          items: [],
          subtotal: paymentIntent.amount ?? 0,
          total: paymentIntent.amount ?? 0,
          currency: paymentIntent.currency ?? 'USD',
          paymentIntent,
          invoiceNumber: paymentIntent.paymentIntentId,
          status: 'AWAITING_PAYMENT',
        }
      : null);
  const intentCreatedAt = (paymentIntent as any)?.createdAt;
  const intentDateISO =
    intentCreatedAt != null
      ? new Date(intentCreatedAt).toISOString()
      : new Date().toISOString();
  const invoiceDateISO = baseInvoice?.invoiceDate ?? intentDateISO;
  const dueDateISO =
    baseInvoice?.dueDate ??
    new Date(new Date(invoiceDateISO).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const effectiveInvoice: Invoice | null = baseInvoice
    ? {
        ...baseInvoice,
        invoiceDate: invoiceDateISO,
        dueDate: dueDateISO,
        invoiceNumber:
          baseInvoice.invoiceNumber ??
          paymentIntent?.paymentIntentId ??
          baseInvoice.id ??
          appointmentId,
      }
    : null;
  const hasPaymentData = effectiveInvoice || paymentIntent;

  useEffect(() => {
    if (!appointmentId) {
      Alert.alert('Missing data', 'Could not open payment screen without an appointment.');
      navigation.goBack();
      return;
    }
    if (!hasPaymentData) {
      Alert.alert(
        'Payment unavailable',
        'Booking succeeded but payment details are missing. Please retry booking.',
      );
      navigation.goBack();
    }
  }, [appointmentId, hasPaymentData, navigation]);

  if (!hasPaymentData) {
    return (
      <SafeArea>
        <Header title="Payment" showBackButton onBack={() => navigation.goBack()} />
        <View style={styles.missingContainer}>
          <Text style={styles.warningText}>
            Payment details are unavailable for this appointment. Please retry booking or contact support.
          </Text>
        </View>
      </SafeArea>
    );
  }
  const clientSecret = paymentIntent?.clientSecret;
  const currencySymbol = effectiveInvoice?.currency ? `${effectiveInvoice.currency} ` : '$';
  const formatMoney = (value: number) => `${currencySymbol}${value.toFixed(2)}`;
  const subtotal = effectiveInvoice?.subtotal ?? 0;
  const discountAmount =
    effectiveInvoice?.discountPercent != null ? (effectiveInvoice.discountPercent / 100) * subtotal : 0;
  const taxAmount = effectiveInvoice?.taxPercent != null ? (effectiveInvoice.taxPercent / 100) * subtotal : 0;
  const total = effectiveInvoice?.total ?? subtotal - discountAmount + taxAmount;
  const shouldShowPay = !!clientSecret;
  const invoiceNumberDisplay =
    effectiveInvoice?.invoiceNumber ??
    paymentIntent?.paymentIntentId ??
    effectiveInvoice?.id ??
    '—';
  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return '—';
    return new Date(ts).toLocaleString();
  };

  const buildSheetOptions = () => {
    const opts: any = {
      paymentIntentClientSecret: clientSecret as string,
      merchantDisplayName: business?.name ?? 'Yosemite Crew',
      defaultBillingDetails: {
        name: guardianName,
        email: guardianEmail !== '—' ? guardianEmail : undefined,
      },
      customFlow: false, // explicit to avoid native crash when key is missing
    };
    if (STRIPE_CONFIG.urlScheme) {
      opts.returnURL = `${STRIPE_CONFIG.urlScheme}://stripe-redirect`;
    }
    return opts;
  };

  const handlePayNow = async () => {
    if (!clientSecret) {
      Alert.alert('Payment unavailable', 'No payment intent found for this appointment.');
      return;
    }
    setPresentingSheet(true);
    const {error: initError} = await initPaymentSheet(buildSheetOptions());
    if (initError) {
      setPresentingSheet(false);
      Alert.alert('Payment unavailable', initError.message);
      return;
    }
    try {
      const {error} = await presentPaymentSheet();
      setPresentingSheet(false);

      if (error) {
        Alert.alert('Payment failed', error.message);
        return;
      }
    } catch (err) {
      setPresentingSheet(false);
      Alert.alert('Payment failed', 'Unable to present the payment sheet. Please try again.');
      return;
    }

    const recordAction = await dispatch(recordPayment({appointmentId}));
    if (recordPayment.rejected.match(recordAction)) {
      console.warn('[Payment] Failed to refresh appointment status after payment');
    }
    navigation.replace('PaymentSuccess', {
      appointmentId,
      companionId: companionId ?? apt?.companionId,
    });
  };

  return (
    <SafeArea>
      <Header
        title="Book an Appointment"
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {!effectiveInvoice && (
          <Text style={styles.warningText}>
            No invoice found for this booking. Please retry booking or contact support.
          </Text>
        )}
        <SummaryCards
          business={business}
          service={service}
          serviceName={apt?.serviceName}
          cardStyle={styles.summaryCard}
        />

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Invoice details</Text>
          <MetaRow
            label="Invoice number"
            value={invoiceNumberDisplay}
          />
          <MetaRow label="Appointment ID" value={apt?.id ?? '—'} />
          <MetaRow
            label="Invoice date"
            value={formatDateTime(effectiveInvoice?.invoiceDate)}
          />
          <MetaRow label="Due till" value={formatDateTime(effectiveInvoice?.dueDate)} />
        </View>

        <View style={styles.invoiceForCard}>
          <Text style={styles.metaTitle}>Invoice for</Text>
          <View style={styles.invoiceForRow}>
            <View style={styles.avatarStack}>
              <View style={[styles.avatarCircle, styles.avatarCompanion]}>
                {companionAvatar ? (
                  <Image source={companionAvatar} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{companionInitial}</Text>
                )}
              </View>
              <View style={[styles.avatarCircle, styles.avatarGuardian]}>
                {guardianAvatar ? (
                  <Image source={guardianAvatar} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitial}>{guardianInitial}</Text>
                )}
              </View>
            </View>
            <View style={styles.invoiceInfoColumn}>
              <View style={styles.invoiceInfoRow}>
                <Image source={Images.emailIcon} style={styles.infoIcon} />
                <Text style={styles.invoiceContactText}>{guardianEmail}</Text>
              </View>
              <View style={styles.invoiceInfoRow}>
                <Image source={Images.locationIcon} style={styles.infoIcon} />
                <Text style={styles.invoiceAddressText}>{guardianAddress}</Text>
              </View>
              <Text style={styles.appointmentForText}>
                Appointment for : {' '}
                <Text style={styles.appointmentForName}>{companionName}</Text>
              </Text>
            </View>
          </View>
        </View>

        <Image
          source={invoice?.image ?? Images.sampleInvoice}
          style={styles.invoiceImage}
        />

        <View style={styles.breakdownCard}>
          <Text style={styles.metaTitle}>Description</Text>
          {effectiveInvoice?.items?.map(item => (
            <BreakdownRow
              key={buildInvoiceItemKey(item)}
              label={item.description}
              value={formatMoney(item.lineTotal)}
            />
          ))}
          <BreakdownRow
            label="Sub Total"
            value={formatMoney(subtotal)}
            subtle
          />
          {!!discountAmount && (
            <BreakdownRow
              label="Discount"
              value={`-${formatMoney(discountAmount)}`}
              subtle
            />
          )}
          {!!taxAmount && (
            <BreakdownRow
              label="Tax"
              value={formatMoney(taxAmount)}
              subtle
            />
          )}
          <BreakdownRow
            label="Total"
            value={formatMoney(total)}
            highlight
          />
          <Text style={styles.breakdownNote}>
            Price calculated as: Sum of line-item (Qty × Unit Price) – Discounts
            + Taxes.
          </Text>
        </View>

        <View style={styles.termsCard}>
          <Text style={styles.metaTitle}>Payment Terms & Legal Disclaimer</Text>
          <Text style={styles.termsLine}>
            Payment Terms: Net 14 days (due 21 Jul 2025)
          </Text>
          <Text style={styles.termsLine}>
            Statutory Liability: You have the right to request correction or
            refund for any defective services.
          </Text>
          <Text style={styles.termsLine}>
            After-Sales Service & Guarantee: Free post-op consultation within 7
            days. 24×7 emergency hotline available.
          </Text>
          <Text style={styles.termsLine}>
            Complaints to: San Francisco Animal Medical Center, 456 Referral Rd,
            Suite 200, San Francisco CA 94103, (415) 555-0199,
            complaints@sfamc.com
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          {shouldShowPay ? (
            <LiquidGlassButton
              title="Pay now"
              onPress={handlePayNow}
              height={56}
              borderRadius={16}
              disabled={presentingSheet || !clientSecret}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
          ) : (
            <Text style={styles.warningText}>
              Payment details are unavailable for this appointment. Please retry booking or contact
              support.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const MetaRow = ({label, value}: {label: string; value: string}) => (
  <View style={metaStyles.row}>
    <Text style={metaStyles.label}>{label}</Text>
    <Text style={metaStyles.value}>{value}</Text>
  </View>
);

const BreakdownRow = ({
  label,
  value,
  highlight,
  subtle,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  subtle?: boolean;
}) => (
  <View
    style={[
      breakdownStyles.row,
      highlight && breakdownStyles.rowHighlight,
      subtle && breakdownStyles.rowSubtle,
    ]}>
    <Text
      style={[
        breakdownStyles.label,
        highlight && breakdownStyles.labelHighlight,
      ]}>
      {label}
    </Text>
    <Text
      style={[
        breakdownStyles.value,
        highlight && breakdownStyles.valueHighlight,
      ]}>
      {value}
    </Text>
  </View>
);

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing[4],
      paddingBottom: theme.spacing[24],
      gap: theme.spacing[2],
    },
    summaryCard: {
      marginBottom: theme.spacing[2],
    },
    metaCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[4],
      gap: theme.spacing[1],
      marginBottom: theme.spacing[2],
    },
    metaTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[1],
    },
    warningText: {
      ...theme.typography.body12,
      color: '#F59E0B',
      marginBottom: theme.spacing[2],
    },
    missingContainer: {
      padding: theme.spacing[4],
    },
    invoiceForCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[4],
      gap: theme.spacing[1],
    },
    invoiceForRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
  invoiceInfoColumn: {
    flex: 1,
    gap: theme.spacing[1],
  },
    invoiceInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
  infoIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: theme.colors.secondary,
    },
    invoiceContactText: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
    },
  invoiceAddressText: {
    ...theme.typography.body12,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  appointmentForText: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing[2],
  },
  appointmentForName: {
    ...theme.typography.titleSmall,
    color: theme.colors.secondary,
  },
    avatarStack: {
      width: 80,
      height: 104,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: theme.colors.surface,
      backgroundColor: theme.colors.lightBlueBackground,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    avatarGuardian: {
      top: 0,
    },
    avatarCompanion: {
      top: 44,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 28,
    },
    avatarInitial: {
      ...theme.typography.titleSmall,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    invoiceImage: {
      width: '100%',
      height: 200,
      resizeMode: 'cover',
      borderRadius: 16,
    },
    breakdownCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[4],
      gap: theme.spacing[1.5],
    },
    breakdownNote: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing[1],
    },
    termsCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[4],
      gap: theme.spacing[1],
    },
    termsLine: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    buttonContainer: {
      gap: theme.spacing[3],
      marginTop: theme.spacing[2],
    },
    confirmPrimaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
    },
  });

const metaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#595958',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#302F2E',
  },
});

const breakdownStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowHighlight: {
    backgroundColor: '#247AED',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowSubtle: {
    opacity: 0.8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#302F2E',
  },
  labelHighlight: {
    color: '#FFFFFF',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#302F2E',
  },
  valueHighlight: {
    color: '#FFFFFF',
  },
});

export default PaymentInvoiceScreen;
