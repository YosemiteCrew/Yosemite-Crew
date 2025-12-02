import React, {useMemo, useState, useEffect, useRef} from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  Platform,
  Linking,
} from 'react-native';
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
import {
  recordPayment,
  fetchInvoiceForAppointment,
  fetchAppointmentById,
} from '@/features/appointments/appointmentsSlice';
import {fetchPaymentIntentForAppointment} from '@/features/appointments/appointmentsSlice';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {Images} from '@/assets/images';
import type {
  InvoiceItem,
  Invoice,
  PaymentIntentInfo,
} from '@/features/appointments/types';
import {selectAuthUser} from '@/features/auth/selectors';
import {useStripe} from '@stripe/stripe-react-native';
import {STRIPE_CONFIG} from '@/config/variables';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';

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
  const invoiceRequestedRef = useRef(false);

  const invoiceFromStore = useSelector(
    appointmentId ? selectInvoiceForAppointment(appointmentId) : () => null,
  );
  const invoice = invoiceFromStore ?? routeInvoice ?? null;
  const fallbackPaymentIntent =
    routeIntent ?? routeInvoice?.paymentIntent ?? null;
  const apt = useSelector((s: RootState) =>
    appointmentId
      ? s.appointments.items.find(a => a.id === appointmentId)
      : undefined,
  );
  const business = useSelector((s: RootState) =>
    apt?.businessId
      ? s.businesses.businesses.find(b => b.id === apt.businessId)
      : undefined,
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
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);
  const businessName = business?.name ?? apt?.organisationName ?? 'Your clinic';
  const businessAddress = business?.address ?? apt?.organisationAddress ?? undefined;

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
  const paymentIntent =
    invoice?.paymentIntent ??
    routeIntent ??
    apt?.paymentIntent ??
    fallbackPaymentIntent ??
    null;
  const googlePlacesId = business?.googlePlacesId ?? apt?.businessGooglePlacesId ?? null;
  const isDummyPhoto = React.useCallback(
    (photo?: string | null) =>
      typeof photo === 'string' &&
      (photo.includes('example.com') || photo.includes('placeholder')),
    [],
  );
  const businessPhoto = business?.photo ?? apt?.businessPhoto ?? null;
  const resolvedBusinessPhoto = fallbackPhoto || (isDummyPhoto(businessPhoto) ? null : businessPhoto);
  const summaryBusiness = {
    name: businessName,
    address: businessAddress,
    description: undefined,
    photo: (resolvedBusinessPhoto as any) ?? null,
  };

  const buildEffectiveInvoice = (): Invoice | null => {
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
    if (!baseInvoice) return null;

    const intentCreatedAt = (paymentIntent as any)?.createdAt;
    const intentDateISO = intentCreatedAt
      ? new Date(intentCreatedAt).toISOString()
      : new Date().toISOString();
    const invoiceDateISO = baseInvoice.invoiceDate ?? intentDateISO;
    const dueDateISO =
      baseInvoice.dueDate ??
      new Date(
        new Date(invoiceDateISO).getTime() + 24 * 60 * 60 * 1000,
      ).toISOString();

    return {
      ...baseInvoice,
      invoiceDate: invoiceDateISO,
      dueDate: dueDateISO,
      invoiceNumber:
        baseInvoice.invoiceNumber ??
        paymentIntent?.paymentIntentId ??
        baseInvoice.id ??
        appointmentId,
      status: baseInvoice.status ?? apt?.status ?? 'PAID',
    };
  };

  const effectiveInvoice = buildEffectiveInvoice();
  const isPaymentPendingStatus =
    apt?.status === 'NO_PAYMENT' ||
    apt?.status === 'AWAITING_PAYMENT' ||
    apt?.status === 'PAYMENT_FAILED';
  useEffect(() => {
    if (!apt && appointmentId) {
      dispatch(fetchAppointmentById({appointmentId}));
    }
  }, [apt, appointmentId, dispatch]);
  useEffect(() => {
    if (!googlePlacesId) return;
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
  }, [dispatch, googlePlacesId]);

  useEffect(() => {
    if (!appointmentId) {
      Alert.alert(
        'Missing data',
        'Could not open payment screen without an appointment.',
      );
      navigation.goBack();
      return;
    }
    const isPaymentPendingNow =
      apt?.status === 'NO_PAYMENT' ||
      apt?.status === 'AWAITING_PAYMENT' ||
      apt?.status === 'PAYMENT_FAILED';
    if (
      appointmentId &&
      (!paymentIntent?.clientSecret || !paymentIntent?.paymentIntentId) &&
      isPaymentPendingNow
    ) {
      dispatch(fetchPaymentIntentForAppointment({appointmentId}));
    }
    const needsInvoice = !invoiceFromStore && !routeInvoice;
    if (
      appointmentId &&
      needsInvoice &&
      !isPaymentPendingNow &&
      !invoiceRequestedRef.current
    ) {
      invoiceRequestedRef.current = true;
      dispatch(fetchInvoiceForAppointment({appointmentId}));
    }
  }, [
    appointmentId,
    apt?.status,
    dispatch,
    invoiceFromStore,
    navigation,
    paymentIntent?.clientSecret,
    paymentIntent?.paymentIntentId,
    routeInvoice,
  ]);

  const clientSecret = paymentIntent?.clientSecret;
  const currencySymbol = effectiveInvoice?.currency
    ? `${effectiveInvoice.currency} `
    : '$';
  const formatMoney = (value: number) => `${currencySymbol}${value.toFixed(2)}`;
  const subtotal = effectiveInvoice?.subtotal ?? 0;
  const getDiscountAmount = (): number => {
    if (effectiveInvoice?.discountPercent) {
      return (effectiveInvoice.discountPercent / 100) * subtotal;
    }
    return 0;
  };

  const getTaxAmount = (): number => {
    if (effectiveInvoice?.taxPercent) {
      return (effectiveInvoice.taxPercent / 100) * subtotal;
    }
    return 0;
  };

  const discountAmount = getDiscountAmount();
  const taxAmount = getTaxAmount();
  const total =
    effectiveInvoice?.total ?? subtotal - discountAmount + taxAmount;
  const shouldShowPay = isPaymentPendingStatus && !!clientSecret;
  const headerTitle = isPaymentPendingStatus ? 'Book appointment' : 'Invoice details';
  const invoiceNumberDisplay =
    effectiveInvoice?.invoiceNumber ??
    paymentIntent?.paymentIntentId ??
    effectiveInvoice?.id ??
    '—';
  const receiptUrl =
    effectiveInvoice?.downloadUrl ??
    effectiveInvoice?.paymentIntent?.paymentLinkUrl ??
    paymentIntent?.paymentLinkUrl ??
    null;
  const isInvoiceLoaded = Boolean(effectiveInvoice);
  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return '—';
    return new Date(ts).toLocaleString();
  };
  const formatDateOnly = (iso?: string | null) => {
    if (!iso) return 'the stated due date';
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return 'the stated due date';
    return new Date(ts).toLocaleDateString();
  };
  const paymentDueLabel = formatDateOnly(effectiveInvoice?.dueDate ?? apt?.date ?? null);

  const buildSheetOptions = () => {
    const opts: any = {
      paymentIntentClientSecret: clientSecret as string,
      merchantDisplayName: business?.name ?? 'Yosemite Crew',
      defaultBillingDetails: {
        name: guardianName,
        email: guardianEmail === '—' ? undefined : guardianEmail,
      },
      customFlow: false, // explicit to avoid native crash when key is missing
    };
    if (STRIPE_CONFIG.urlScheme) {
      opts.returnURL = `${STRIPE_CONFIG.urlScheme}://stripe-redirect`;
    }
    if (Platform.OS === 'ios' && STRIPE_CONFIG.merchantIdentifier) {
      opts.applePay = {
        merchantCountryCode: 'US',
      };
    }
    return opts;
  };

  const handlePayNow = async () => {
    if (!clientSecret) {
      Alert.alert(
        'Payment unavailable',
        'No payment intent found for this appointment.',
      );
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
      console.warn('[Payment] Error presenting payment sheet:', err);
      Alert.alert(
        'Payment failed',
        'Unable to present the payment sheet. Please try again.',
      );
      return;
    }

    const recordAction = await dispatch(recordPayment({appointmentId}));
    if (recordPayment.rejected.match(recordAction)) {
      console.warn(
        '[Payment] Failed to refresh appointment status after payment',
      );
    }
    navigation.replace('PaymentSuccess', {
      appointmentId,
      companionId: companionId ?? apt?.companionId,
    });
  };

  return (
    <SafeArea>
      <Header
        title={headerTitle}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {!isInvoiceLoaded && !isPaymentPendingStatus && (
          <Text style={styles.warningText}>Loading invoice details…</Text>
        )}
        {!effectiveInvoice && (
          <Text style={styles.warningText}>
            No invoice found for this booking. Please retry booking or contact
            support.
          </Text>
        )}
        <SummaryCards
          businessSummary={summaryBusiness as any}
          service={service}
          serviceName={apt?.serviceName}
          cardStyle={styles.summaryCard}
        />

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Invoice details</Text>
          <MetaRow label="Invoice number" value={invoiceNumberDisplay} />
          <MetaRow label="Appointment ID" value={apt?.id ?? '—'} />
          <MetaRow
            label="Invoice date"
            value={formatDateTime(effectiveInvoice?.invoiceDate)}
          />
          <MetaRow
            label="Due till"
            value={formatDateTime(effectiveInvoice?.dueDate)}
          />
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
                Appointment for :{' '}
                <Text style={styles.appointmentForName}>{companionName}</Text>
              </Text>
            </View>
          </View>
        </View>

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
            <BreakdownRow label="Tax" value={formatMoney(taxAmount)} subtle />
          )}
          <BreakdownRow label="Total" value={formatMoney(total)} highlight />
          <Text style={styles.breakdownNote}>
            Price calculated as: Sum of line-item (Qty × Unit Price) – Discounts
            + Taxes.
          </Text>
        </View>
        {receiptUrl && (
          <View style={styles.previewCard}>
            <Text style={styles.metaTitle}>Invoice & receipt</Text>
            <LiquidGlassButton
              title="View invoice"
              onPress={() => {
                Linking.canOpenURL(receiptUrl)
                  .then(canOpen => {
                    if (canOpen) {
                      return Linking.openURL(receiptUrl);
                    }
                    throw new Error('cannot-open');
                  })
                  .catch(() =>
                    Alert.alert(
                      'Unable to open invoice',
                      'Please try again or copy the link from your receipt.',
                    ),
                  );
              }}
              height={48}
              borderRadius={12}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
            <Text style={styles.missingSubtitle}>
              You will be redirected to the secure Stripe receipt in your
              browser.
            </Text>
          </View>
        )}

        <View style={styles.termsCard}>
          <Text style={styles.metaTitle}>Payment terms & legal</Text>
          <Text style={styles.termsLine}>
            Payment is due by {paymentDueLabel}. Late or failed payments may result in rescheduling or cancellation; card transactions are processed securely via Stripe.
          </Text>
          <Text style={styles.termsLine}>
            Services are provided by {businessName}
            {businessAddress && businessAddress !== '—' ? ` (${businessAddress})` : ''}. Charges reflect veterinary/professional services rendered and may include taxes or approved follow-up care.
          </Text>
          <Text style={styles.termsLine}>
            Refunds or billing disputes are handled by the clinic in line with applicable consumer laws. Keep your receipt and contact the clinic directly for questions or adjustments.
          </Text>
          <Text style={styles.termsLine}>
            This invoice is not emergency advice. If your pet needs urgent care, contact the clinic or local emergency services immediately.
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          {shouldShowPay && (
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
      flex: 1,
      padding: theme.spacing[4],
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing[2.5],
    },
    missingBadge: {
      paddingHorizontal: theme.spacing[2.5],
      paddingVertical: theme.spacing[1],
      borderRadius: 999,
      backgroundColor: theme.colors.primaryTint,
    },
    missingBadgeText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.primary,
    },
    missingTitle: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
    },
    missingSubtitle: {
      ...theme.typography.body14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    invoiceForCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[4],
      gap: theme.spacing[1],
    },
    previewCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[4],
      gap: theme.spacing[2],
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
