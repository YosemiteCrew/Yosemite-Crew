import React, {useMemo, useState, useEffect, useRef, useCallback} from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
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
  fetchInvoiceForAppointment,
  fetchAppointmentById,
  fetchPaymentIntentForAppointment,
} from '@/features/appointments/appointmentsSlice';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {Images} from '@/assets/images';
import type {
  InvoiceItem,
  Invoice,
  PaymentIntentInfo,
} from '@/features/appointments/types';
import {selectAuthUser} from '@/features/auth/selectors';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';
import {usePaymentHandler} from '@/features/payments/hooks/usePaymentHandler';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {resolveCurrencyForBusiness, normalizeCurrencyCode} from '@/shared/utils/currencyResolver';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const useGuardianInfo = (authUser: any, invoice: any) => {
  return useMemo(() => {
    const guardianName = [authUser?.firstName, authUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || authUser?.email || invoice?.billedToName || 'Pet guardian';
    const guardianInitial = guardianName.trim().charAt(0).toUpperCase() || 'Y';
    const guardianAvatar = authUser?.profilePicture ? {uri: authUser.profilePicture} : null;
    const guardianEmail = authUser?.email ?? invoice?.billedToEmail ?? '—';
    return {guardianName, guardianInitial, guardianAvatar, guardianEmail};
  }, [authUser?.firstName, authUser?.lastName, authUser?.email, authUser?.profilePicture, invoice?.billedToName, invoice?.billedToEmail]);
};

const useCompanionInfo = (companion: any) => {
  return useMemo(() => {
    const companionName = companion?.name ?? 'Companion';
    const companionInitial = companionName.trim().charAt(0).toUpperCase() || 'C';
    const companionAvatar = companion?.profileImage ? {uri: companion.profileImage} : null;
    return {companionName, companionInitial, companionAvatar};
  }, [companion?.name, companion?.profileImage]);
};

const useInvoiceCalculations = (effectiveInvoice: any) => {
  return useMemo(() => {
    const subtotal = effectiveInvoice?.subtotal ?? 0;
    const discountAmount = effectiveInvoice?.discountPercent ? (effectiveInvoice.discountPercent / 100) * subtotal : 0;
    const taxAmount = effectiveInvoice?.taxPercent ? (effectiveInvoice.taxPercent / 100) * subtotal : 0;
    const total = effectiveInvoice?.total ?? subtotal - discountAmount + taxAmount;
    return {subtotal, discountAmount, taxAmount, total};
  }, [effectiveInvoice?.subtotal, effectiveInvoice?.total, effectiveInvoice?.discountPercent, effectiveInvoice?.taxPercent]);
};

const useAppointmentSelectors = (appointmentId: string, companionId?: string) => {
  const apt = useSelector((s: RootState) =>
    appointmentId ? s.appointments.items.find(a => a.id === appointmentId) : undefined,
  );
  const business = useSelector((s: RootState) =>
    apt?.businessId ? s.businesses.businesses.find(b => b.id === apt.businessId) : undefined,
  );
  const service = useSelector((s: RootState) =>
    apt?.serviceId ? s.businesses.services.find(svc => svc.id === apt.serviceId) : null,
  );
  const companion = useSelector((s: RootState) =>
    companionId ?? apt?.companionId
      ? s.companion.companions.find(c => c.id === (companionId ?? apt?.companionId))
      : null,
  );
  return {apt, business, service, companion};
};

const usePaymentStatus = (aptStatus?: string) => {
  return useMemo(() => {
    const isPaymentPendingStatus = aptStatus === 'NO_PAYMENT' || aptStatus === 'AWAITING_PAYMENT' || aptStatus === 'PAYMENT_FAILED';
    return {isPaymentPendingStatus};
  }, [aptStatus]);
};

const isInvoicePending = (status?: string | null) => {
  const normalized = (status ?? '').toString().toUpperCase();
  return normalized !== 'PAID' && normalized !== 'REFUNDED' && normalized !== 'CANCELLED';
};

const isInvoiceMissingTotals = (invoice: any): boolean => {
  const comps = invoice?.totalPriceComponent;
  if (!Array.isArray(comps) || comps.length === 0) return true;
  const hasBase = comps.some(pc => (pc?.type ?? '').toString().toLowerCase() === 'base');
  const hasDiscount = comps.some(pc => (pc?.type ?? '').toString().toLowerCase() === 'discount');
  const hasTax = comps.some(pc => (pc?.type ?? '').toString().toLowerCase() === 'tax');
  return !(hasBase && hasDiscount && hasTax);
};

const buildInvoices = (invoice: any, paymentIntent: any, appointmentId: string) => {
  const buildBaseInvoice = (): Invoice | null => {
    if (invoice) return invoice;
    if (!paymentIntent) return null;
    return {
      id: paymentIntent.paymentIntentId ?? `pi-${appointmentId}`,
      appointmentId,
      items: [],
      subtotal: paymentIntent.amount ?? 0,
      total: paymentIntent.amount ?? 0,
      currency: paymentIntent.currency ?? 'USD',
      paymentIntent,
      invoiceNumber: paymentIntent.paymentIntentId,
      status: 'AWAITING_PAYMENT',
    };
  };

  const buildEffectiveInvoice = (): Invoice | null => {
    const baseInvoice = buildBaseInvoice();
    if (!baseInvoice) return null;
    const intentCreatedAt = paymentIntent?.createdAt;
    const intentDateISO = intentCreatedAt ? new Date(intentCreatedAt).toISOString() : new Date().toISOString();
    const invoiceDateISO = baseInvoice.invoiceDate ?? intentDateISO;
    const dueDateISO = baseInvoice.dueDate ?? new Date(new Date(invoiceDateISO).getTime() + 24 * 60 * 60 * 1000).toISOString();
    return {...baseInvoice, invoiceDate: invoiceDateISO, dueDate: dueDateISO, invoiceNumber: baseInvoice.invoiceNumber ?? paymentIntent?.paymentIntentId ?? baseInvoice.id ?? appointmentId, status: baseInvoice.status ?? 'PAID'};
  };

  return buildEffectiveInvoice();
};

  const useInvoiceDisplayData = (effectiveInvoice: any, paymentIntent: any, businessAddress?: string) => {
    return useMemo(() => {
      const clientSecret = paymentIntent?.clientSecret;
      // Normalize and resolve currency: prefer explicit currency from API, fall back to business location
      const rawCurrency = effectiveInvoice?.currency ?? paymentIntent?.currency;
      const currencyCode = rawCurrency
        ? normalizeCurrencyCode(rawCurrency)
        : resolveCurrencyForBusiness(businessAddress);
      const currencySymbol = resolveCurrencySymbol(currencyCode, '$');
      const invoiceNumberDisplay =
        effectiveInvoice?.invoiceNumber ??
        effectiveInvoice?.id ??
        paymentIntent?.paymentIntentId ??
        '—';
      const receiptUrl = effectiveInvoice?.downloadUrl ?? effectiveInvoice?.paymentIntent?.paymentLinkUrl ?? paymentIntent?.paymentLinkUrl ?? null;
      const checkRefundStatus = (status?: string | null) => status?.toUpperCase?.().includes?.('REFUND') ?? false;
      const hasRefund = effectiveInvoice?.refundId || checkRefundStatus(effectiveInvoice?.refundStatus) || checkRefundStatus(effectiveInvoice?.status);
      const refundAmountDisplay = effectiveInvoice?.refundAmount == null ? '—' : `${currencySymbol}${effectiveInvoice?.refundAmount.toFixed(2)}`;
      return {clientSecret, currencySymbol, invoiceNumberDisplay, receiptUrl, hasRefund, refundAmountDisplay};
  }, [effectiveInvoice, paymentIntent, businessAddress]);
};

const buildInvoiceItemKey = ({
  description,
  rate,
  lineTotal,
  qty,
}: InvoiceItem) => `${description}-${rate}-${lineTotal}-${qty ?? 0}`;

const formatDateTimeDisplay = (iso?: string) => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isFinite(ts) === false) return '—';
  return new Date(ts).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDateOnlyDisplay = (iso?: string | null) => {
  if (!iso) return 'the stated due date';
  const ts = Date.parse(iso);
  if (Number.isFinite(ts) === false) return 'the stated due date';
  return new Date(ts).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const InvoiceDetailsCard = ({
  invoiceNumberDisplay,
  effectiveInvoice,
  apt,
  styles,
}: {
  invoiceNumberDisplay: string;
  effectiveInvoice: any;
  apt: any;
  styles: any;
}) => (
  <View style={styles.metaCard}>
    <Text style={styles.metaTitle}>Invoice details</Text>
    <MetaRow label="Invoice number" value={invoiceNumberDisplay} />
    <MetaRow
      label="Appointment ID"
      value={effectiveInvoice?.appointmentId ?? apt?.id ?? '—'}
    />
    <MetaRow
      label="Invoice date"
      value={formatDateTimeDisplay(effectiveInvoice?.invoiceDate)}
    />
    <MetaRow
      label="Due till"
      value={formatDateTimeDisplay(effectiveInvoice?.dueDate)}
    />
  </View>
);

const RefundSection = ({
  effectiveInvoice,
  refundAmountDisplay,
  theme,
  styles,
}: {
  effectiveInvoice: any;
  refundAmountDisplay: string;
  theme: any;
  styles: any;
}) => (
  <>
    <Text style={styles.metaTitle}>Refund</Text>
    <MetaRow label="Refund ID" value={effectiveInvoice?.refundId ?? '—'} />
    <MetaRow
      label="Refund status"
      value={effectiveInvoice?.refundStatus ?? effectiveInvoice?.status ?? '—'}
    />
    <MetaRow label="Refund amount" value={refundAmountDisplay} />
    <MetaRow
      label="Refund date"
      value={formatDateTimeDisplay(effectiveInvoice?.refundDate ?? undefined)}
    />
    {effectiveInvoice?.refundReceiptUrl || effectiveInvoice?.downloadUrl ? (
      <View style={styles.refundLinkRow}>
        <LiquidGlassButton
          title="View refund receipt"
          onPress={() => {
            const url = effectiveInvoice?.refundReceiptUrl ?? effectiveInvoice?.downloadUrl;
            if (url) {
              Linking.openURL(url);
            }
          }}
          height={48}
          borderRadius={12}
          tintColor={theme.colors.secondary}
          shadowIntensity="light"
          textStyle={styles.confirmPrimaryButtonText}
        />
      </View>
    ) : null}
  </>
);

const InvoiceForCard = ({
  companionAvatar,
  companionInitial,
  guardianAvatar,
  guardianInitial,
  guardianEmail,
  guardianAddress,
  companionName,
  styles,
}: {
  companionAvatar: any;
  companionInitial: string;
  guardianAvatar: any;
  guardianInitial: string;
  guardianEmail: string;
  guardianAddress: string;
  companionName: string;
  styles: any;
}) => (
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
);

const BreakdownCard = ({
  effectiveInvoice,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  formatMoney,
  currency,
  styles,
}: {
  effectiveInvoice: any;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  formatMoney: (value: number) => string;
  currency: string;
  styles: any;
}) => (
  <View style={styles.breakdownCard}>
    <Text style={styles.metaTitle}>Description</Text>
    {effectiveInvoice?.items?.map((item: InvoiceItem) => (
      <BreakdownRow
        key={buildInvoiceItemKey(item)}
        label={item.description}
        value={formatMoney(item.lineTotal)}
      />
    ))}
    {Array.isArray(effectiveInvoice?.totalPriceComponent) &&
    effectiveInvoice.totalPriceComponent.length > 0 ? (
      effectiveInvoice.totalPriceComponent
        .filter((pc: any) => {
          const codeText = (pc?.code?.text ?? '').toLowerCase();
          const typeText = (pc?.type ?? '').toString().toLowerCase();
          return codeText !== 'grand-total' && typeText !== 'informational';
        })
        .map((pc: any, idx: number) => {
        const rawLabel =
          pc.code?.text ??
          pc.type?.toString().replaceAll('_', ' ').replaceAll('-', ' ') ??
          `Line ${idx + 1}`;
        const label =
          rawLabel.length > 0 ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : rawLabel;
        const value =
          typeof pc.amount?.value === 'number'
            ? `${resolveCurrencySymbol(pc.amount?.currency ?? currency ?? 'USD')}${pc.amount.value.toFixed(2)}`
            : '—';
        return (
          <BreakdownRow
            key={`${label}-${idx}`}
            label={label}
            value={value}
            subtle={label.toLowerCase().includes('discount')}
          />
        );
      })
    ) : (
      <>
        <BreakdownRow label="Sub Total" value={formatMoney(subtotal)} subtle />
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
      </>
    )}
    <BreakdownRow label="Total" value={formatMoney(total)} highlight />
    <Text style={styles.breakdownNote}>
      Price calculated as: Sum of line-item (Qty × Unit Price) – Discounts +
      Taxes.
    </Text>
  </View>
);

const ReceiptCard = ({
  receiptUrl,
  theme,
  styles,
}: {
  receiptUrl: string | null;
  theme: any;
  styles: any;
}) => {
  if (!receiptUrl) return null;
  return (
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
        You will be redirected to the secure Stripe receipt in your browser.
      </Text>
    </View>
  );
};

const TermsCard = ({
  paymentDueLabel,
  businessName,
  businessAddress,
  styles,
}: {
  paymentDueLabel: string;
  businessName: string;
  businessAddress?: string;
  styles: any;
}) => (
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
);

const PayButton = ({
  shouldShowPay,
  presentingSheet,
  clientSecret,
  theme,
  handlePayNow,
  styles,
}: {
  shouldShowPay: boolean;
  presentingSheet: boolean;
  clientSecret: string | null;
  theme: any;
  handlePayNow: () => void;
  styles: any;
}) => {
  if (!shouldShowPay) return null;
  return (
    <View style={styles.buttonContainer}>
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
    </View>
  );
};

const useFetchAppointmentById = ({
  appointmentId,
  apt,
  dispatch,
}: {
  appointmentId: string;
  apt?: any;
  dispatch: AppDispatch;
}) => {
  useEffect(() => {
    if (!apt && appointmentId) {
      dispatch(fetchAppointmentById({appointmentId}));
    }
  }, [apt, appointmentId, dispatch]);
};

const useBusinessPhoto = ({
  googlePlacesId,
  dispatch,
  setFallbackPhoto,
}: {
  googlePlacesId: string | null;
  dispatch: AppDispatch;
  setFallbackPhoto: (value: string | null) => void;
}) => {
  useEffect(() => {
    if (!googlePlacesId) return;
    const fetchPhoto = async () => {
      try {
        const res = await dispatch(fetchBusinessDetails(googlePlacesId)).unwrap();
        if (res.photoUrl) {
          setFallbackPhoto(res.photoUrl);
          return;
        }
      } catch {
        // Ignore and try image fallback
      }
      try {
        const img = await dispatch(fetchGooglePlacesImage(googlePlacesId)).unwrap();
        if (img.photoUrl) setFallbackPhoto(img.photoUrl);
      } catch {
        // Swallow errors; UI can continue without extra photo
      }
    };
    fetchPhoto();
  }, [dispatch, googlePlacesId, setFallbackPhoto]);
};

const useEnsurePaymentData = ({
  appointmentId,
  aptStatus,
  dispatch,
  invoiceFromStore,
  routeInvoice,
  navigation,
  invoiceRequestedRef,
  isInvoiceIncomplete,
  isInvoiceBasedFlow,
}: {
  appointmentId: string;
  aptStatus?: string;
  dispatch: AppDispatch;
  invoiceFromStore: Invoice | null;
  routeInvoice: Invoice | null | undefined;
  navigation: any;
  invoiceRequestedRef: React.RefObject<boolean>;
  isInvoiceIncomplete: boolean;
  isInvoiceBasedFlow: boolean;
}) => {
  useEffect(() => {
    if (isInvoiceBasedFlow) {
      return;
    }
    const hasInvoiceFromRoute = Boolean(routeInvoice);
    if (!appointmentId && !hasInvoiceFromRoute) {
      Alert.alert(
        'Missing data',
        'Could not open payment screen without appointment or invoice.',
      );
      navigation.goBack();
      return;
    }

    if (!hasInvoiceFromRoute && appointmentId) {
      const needsInvoice = !invoiceFromStore && !routeInvoice;
      const isPaymentPending =
        aptStatus === 'NO_PAYMENT' ||
        aptStatus === 'AWAITING_PAYMENT' ||
        aptStatus === 'PAYMENT_FAILED';
      const shouldFetchInvoice =
        !isPaymentPending && !invoiceRequestedRef.current && (needsInvoice || isInvoiceIncomplete);

      if (shouldFetchInvoice) {
        invoiceRequestedRef.current = true;
        dispatch(fetchInvoiceForAppointment({appointmentId}));
      }
    }
  }, [
    appointmentId,
    aptStatus,
    dispatch,
    invoiceFromStore,
    navigation,
    routeInvoice,
    invoiceRequestedRef,
    isInvoiceIncomplete,
    isInvoiceBasedFlow,
  ]);
};

const getHeaderTitle = (isInvoiceBasedFlow: boolean, isPaymentPendingStatus: boolean) => {
  if (isInvoiceBasedFlow) return 'Invoice payment';
  if (isPaymentPendingStatus) return 'Book appointment';
  return 'Invoice details';
};

const useInvoiceLoadingState = ({
  effectiveInvoice,
  isPaymentPendingStatus,
  invoiceRequestedRef,
  paymentIntentRequestedRef,
  paymentIntent,
}: {
  effectiveInvoice: Invoice | null;
  isPaymentPendingStatus: boolean;
  invoiceRequestedRef: React.RefObject<boolean>;
  paymentIntentRequestedRef: React.RefObject<boolean>;
  paymentIntent: PaymentIntentInfo | null;
}) => {
  const invoiceRequested = invoiceRequestedRef.current;
  const paymentIntentRequested = paymentIntentRequestedRef.current;

  return useMemo(() => {
    const isInvoiceLoaded = Boolean(effectiveInvoice);
    const isPaymentIntentLoading =
      paymentIntentRequested &&
      (!paymentIntent?.clientSecret || !paymentIntent?.paymentIntentId);
    const isInvoiceLoading =
      (!isInvoiceLoaded && (isPaymentPendingStatus || invoiceRequested)) ||
      (!isInvoiceLoaded && isPaymentIntentLoading);
    const shouldShowLoadingNotice =
      isInvoiceLoading || isPaymentIntentLoading || (!isInvoiceLoaded && isPaymentPendingStatus);

    return {isInvoiceLoaded, isPaymentIntentLoading, shouldShowLoadingNotice};
  }, [
    effectiveInvoice,
    invoiceRequested,
    isPaymentPendingStatus,
    paymentIntent?.clientSecret,
    paymentIntent?.paymentIntentId,
    paymentIntentRequested,
  ]);
};

const buildInvoiceContent = ({
  shouldShowLoadingNotice,
  effectiveInvoice,
  invoiceNumberDisplay,
  apt,
  styles,
  hasRefund,
  refundAmountDisplay,
  theme,
  isInvoiceBasedFlow,
  companionAvatar,
  companionInitial,
  guardianAvatar,
  guardianInitial,
  guardianEmail,
  guardianAddress,
  companionName,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  formatMoney,
  paymentIntent,
  receiptUrl,
  paymentDueLabel,
  businessName,
  businessAddress,
  shouldShowPay,
  presentingSheet,
  clientSecret,
  handlePayNow,
}: any) => {
  if (shouldShowLoadingNotice) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Preparing payment details…</Text>
      </View>
    );
  }

  if (effectiveInvoice) {
    return (
      <>
      <InvoiceDetailsCard
        invoiceNumberDisplay={invoiceNumberDisplay}
        effectiveInvoice={effectiveInvoice}
        apt={apt}
        styles={styles}
      />

      {hasRefund ? (
        <View style={styles.metaCard}>
          <RefundSection
            effectiveInvoice={effectiveInvoice}
            refundAmountDisplay={refundAmountDisplay}
            theme={theme}
            styles={styles}
          />
        </View>
      ) : null}

      {!isInvoiceBasedFlow && (
        <InvoiceForCard
          companionAvatar={companionAvatar}
          companionInitial={companionInitial}
          guardianAvatar={guardianAvatar}
          guardianInitial={guardianInitial}
          guardianEmail={guardianEmail}
          guardianAddress={guardianAddress}
          companionName={companionName}
          styles={styles}
        />
      )}

      <BreakdownCard
        effectiveInvoice={effectiveInvoice}
        subtotal={subtotal}
        discountAmount={discountAmount}
        taxAmount={taxAmount}
        total={total}
        formatMoney={formatMoney}
        currency={effectiveInvoice?.currency ?? paymentIntent?.currency ?? 'USD'}
        styles={styles}
      />

      <ReceiptCard receiptUrl={receiptUrl} theme={theme} styles={styles} />

      <TermsCard
        paymentDueLabel={paymentDueLabel}
        businessName={businessName}
        businessAddress={businessAddress}
        styles={styles}
      />

      <PayButton
        shouldShowPay={shouldShowPay}
        presentingSheet={presentingSheet}
        clientSecret={clientSecret}
        theme={theme}
        handlePayNow={handlePayNow}
        styles={styles}
      />
      </>
    );
  }

  return (
    <Text style={styles.warningText}>
      No invoice found for this booking. Please retry booking or contact
      support.
    </Text>
  );
};

export const PaymentInvoiceScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const route = useRoute<any>();
  const navigation = useNavigation<Nav>();
  const dispatch = useDispatch<AppDispatch>();
  const routeParams = (route.params ?? {}) as {
    appointmentId?: string;
    companionId?: string;
    expenseId?: string;
    invoice?: Invoice | null;
    paymentIntent?: PaymentIntentInfo | null;
  };
  const appointmentId = routeParams.appointmentId ?? '';
  const companionId = routeParams.companionId;
  const expenseId = routeParams.expenseId;
  const routeInvoice = routeParams.invoice;
  const routeIntent = routeParams.paymentIntent;
  const invoiceRequestedRef = useRef(false);
  const paymentIntentRequestedRef = useRef(false);

  // Reset one-shot guards when navigating between different appointments
  useEffect(() => {
    invoiceRequestedRef.current = false;
    paymentIntentRequestedRef.current = false;
  }, [appointmentId]);

  const invoiceFromStore = useSelector(
    appointmentId ? selectInvoiceForAppointment(appointmentId) : () => null,
  );
  const isInvoiceBasedFlow = Boolean(routeInvoice || expenseId); // expense/invoice-based flow
  const invoicePreferred = isInvoiceBasedFlow
    ? routeInvoice ?? invoiceFromStore ?? null
    : invoiceFromStore ?? routeInvoice ?? null;
  const invoice = invoicePreferred;
  const fallbackPaymentIntent = routeIntent ?? routeInvoice?.paymentIntent ?? null;
  const {apt, business, service, companion} = useAppointmentSelectors(appointmentId, companionId);
  const authUser = useSelector(selectAuthUser);
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);

  // Extract organization details from invoice if available (expense/invoice-based flow)
  const invoiceOrganisation = (invoice as any)?.organisation;
  const invoiceOrganisationAddress = invoiceOrganisation?.address;
  const invoiceBusinessName = invoiceOrganisation?.name;
  const invoiceGooglePlaceId =
    invoiceOrganisation?.placesId ??
    invoiceOrganisation?.placeId ??
    invoiceOrganisation?.googlePlacesId ??
    null;
  const invoiceBusinessAddress = invoiceOrganisationAddress
    ? [
        invoiceOrganisationAddress.addressLine,
        invoiceOrganisationAddress.city,
        invoiceOrganisationAddress.state,
        invoiceOrganisationAddress.postalCode,
      ]
        .filter(Boolean)
        .join(', ')
    : undefined;
  const invoiceBusinessImage = invoiceOrganisation?.image;

  // Use invoice organization if available, otherwise use appointment/business data
  const businessName = invoiceBusinessName ?? business?.name ?? apt?.organisationName ?? 'Your clinic';
  const businessAddress = invoiceBusinessAddress ?? business?.address ?? apt?.organisationAddress ?? undefined;

  const {guardianName, guardianInitial, guardianAvatar, guardianEmail} = useGuardianInfo(authUser, invoice);
  const {companionName, companionInitial, companionAvatar} = useCompanionInfo(companion);
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

  const paymentIntent =
    (isInvoiceBasedFlow ? routeIntent ?? invoice?.paymentIntent : invoice?.paymentIntent) ??
    routeIntent ??
    apt?.paymentIntent ??
    fallbackPaymentIntent ??
    null;
  const googlePlacesId =
    invoiceGooglePlaceId ??
    business?.googlePlacesId ??
    apt?.businessGooglePlacesId ??
    null;
  const isDummyPhoto = React.useCallback(
    (photo?: string | null) =>
      typeof photo === 'string' &&
      (photo.includes('example.com') || photo.includes('placeholder')),
    [],
  );
  const businessPhoto = invoiceBusinessImage ?? business?.photo ?? apt?.businessPhoto ?? null;
  const resolvedBusinessPhoto = fallbackPhoto || (isDummyPhoto(businessPhoto) ? null : businessPhoto);
  const summaryBusiness = {
    name: businessName,
    address: businessAddress,
    description: undefined,
    photo: resolvedBusinessPhoto ?? null,
  };

  const effectiveInvoice = buildInvoices(invoice, paymentIntent, appointmentId);
  const invoiceToCheck = invoicePreferred;
  const {isPaymentPendingStatus: aptPaymentPending} = usePaymentStatus(apt?.status);
  const isPaymentPendingStatus = isInvoiceBasedFlow
    ? isInvoicePending(invoiceToCheck?.status)
    : aptPaymentPending;
  const invoiceIncomplete = isInvoiceMissingTotals(invoiceToCheck);

  useFetchAppointmentById({appointmentId, apt: isInvoiceBasedFlow ? {} : apt, dispatch});
  useBusinessPhoto({
    googlePlacesId,
    dispatch,
    setFallbackPhoto,
  });
  useEnsurePaymentData({
    appointmentId,
    aptStatus: apt?.status,
    dispatch,
    invoiceFromStore,
    routeInvoice,
    navigation,
    invoiceRequestedRef,
    isInvoiceIncomplete: invoiceIncomplete,
    isInvoiceBasedFlow,
  });

  useEffect(() => {
    // Always ensure we have a payment intent when opening from Pay Now
    const needsIntent =
      (!paymentIntent?.clientSecret || !paymentIntent?.paymentIntentId) &&
      (isPaymentPendingStatus ||
        (effectiveInvoice?.status ?? '').toString().toUpperCase() === 'AWAITING_PAYMENT');
    if (isInvoiceBasedFlow || !appointmentId || paymentIntentRequestedRef.current || !needsIntent) {
      return;
    }
    paymentIntentRequestedRef.current = true;
    dispatch(fetchPaymentIntentForAppointment({appointmentId}));
  }, [
    appointmentId,
    dispatch,
    effectiveInvoice?.status,
    isInvoiceBasedFlow,
    isPaymentPendingStatus,
    paymentIntent?.clientSecret,
    paymentIntent?.paymentIntentId,
  ]);

  const {clientSecret, currencySymbol, invoiceNumberDisplay, receiptUrl, hasRefund, refundAmountDisplay} = useInvoiceDisplayData(effectiveInvoice, paymentIntent, businessAddress);
  const formatMoney = useCallback(
    (value: number) => `${currencySymbol}${value.toFixed(2)}`,
    [currencySymbol],
  );
  const {subtotal, discountAmount, taxAmount, total} = useInvoiceCalculations(effectiveInvoice);
  const shouldShowPay =
    (isPaymentPendingStatus ||
      (isInvoiceBasedFlow && isInvoicePending(invoiceToCheck?.status))) &&
    !!clientSecret;
  const headerTitle = getHeaderTitle(isInvoiceBasedFlow, isPaymentPendingStatus);
  const {shouldShowLoadingNotice} = useInvoiceLoadingState({
    effectiveInvoice,
    isPaymentPendingStatus,
    invoiceRequestedRef,
    paymentIntentRequestedRef,
    paymentIntent,
  });
  const paymentDueLabel = formatDateOnlyDisplay(effectiveInvoice?.dueDate ?? apt?.date ?? null);

  const {handlePayNow, presentingSheet} = usePaymentHandler({
    clientSecret,
    businessName,
    guardianName,
    guardianEmail,
    appointmentId,
    companionId,
    aptCompanionId: apt?.companionId,
    expenseId,
    navigation,
  });

  const content = useMemo(
    () =>
      buildInvoiceContent({
        shouldShowLoadingNotice,
        effectiveInvoice,
        invoiceNumberDisplay,
        apt,
        styles,
        hasRefund,
        refundAmountDisplay,
        theme,
        isInvoiceBasedFlow,
        companionAvatar,
        companionInitial,
        guardianAvatar,
        guardianInitial,
        guardianEmail,
        guardianAddress,
        companionName,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        formatMoney,
        paymentIntent,
        receiptUrl,
        paymentDueLabel,
        businessName,
        businessAddress,
        shouldShowPay,
        presentingSheet,
        clientSecret,
        handlePayNow,
      }),
    [
      shouldShowLoadingNotice,
      effectiveInvoice,
      invoiceNumberDisplay,
      apt,
      styles,
      hasRefund,
      refundAmountDisplay,
      theme,
      isInvoiceBasedFlow,
      companionAvatar,
      companionInitial,
      guardianAvatar,
      guardianInitial,
      guardianEmail,
      guardianAddress,
      companionName,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      formatMoney,
      paymentIntent,
      receiptUrl,
      paymentDueLabel,
      businessName,
      businessAddress,
      shouldShowPay,
      presentingSheet,
      clientSecret,
      handlePayNow,
    ],
  );

  return (
    <SafeArea>
      <Header
        title={headerTitle}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <SummaryCards
          businessSummary={summaryBusiness as any}
          service={service}
          serviceName={apt?.serviceName}
          cardStyle={styles.summaryCard}
        />
        {content}
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
    loadingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      padding: theme.spacing[3],
      borderRadius: 12,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted ?? theme.colors.border,
    },
    loadingText: {
      ...theme.typography.body14,
      color: theme.colors.textSecondary,
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
    refundLinkRow: {
      gap: theme.spacing[2],
      marginTop: theme.spacing[2],
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
