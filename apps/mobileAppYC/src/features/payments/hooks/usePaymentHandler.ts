import {useState, useCallback} from 'react';
import {Alert} from 'react-native';
import {useStripe, initStripe} from '@stripe/stripe-react-native';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {recordPayment} from '@/features/appointments/appointmentsSlice';
import {getResolvedStripePublishableKey} from '@/config/stripeKeyRegistry';

export const usePaymentHandler = ({
  clientSecret,
  connectedAccountId,
  businessName,
  guardianName,
  guardianEmail,
  appointmentId,
  companionId,
  aptCompanionId,
  expenseId,
  navigation,
}: {
  clientSecret: string | null;
  connectedAccountId?: string | null;
  businessName: string;
  guardianName: string;
  guardianEmail: string;
  appointmentId: string;
  companionId?: string;
  aptCompanionId?: string;
  expenseId?: string;
  navigation: any;
}) => {
  const {initPaymentSheet, presentPaymentSheet} = useStripe();
  const dispatch = useDispatch<AppDispatch>();
  const [presentingSheet, setPresentingSheet] = useState(false);

  const buildPaymentSheetOptions = useCallback(
    (secret: string, bizName: string, gName: string, gEmail: string) => {
      const {STRIPE_CONFIG} = require('@/config/variables');
      const resolvedMerchantName =
        STRIPE_CONFIG.merchantDisplayName?.trim?.() ||
        bizName?.trim?.() ||
        'Yosemite Crew';
      const opts: any = {
        paymentIntentClientSecret: secret,
        merchantDisplayName: resolvedMerchantName,
        defaultBillingDetails: {
          name: gName,
          email: gEmail === '—' ? undefined : gEmail,
        },
        customFlow: false,
      };
      if (STRIPE_CONFIG.urlScheme) {
        opts.returnURL = `${STRIPE_CONFIG.urlScheme}://stripe-redirect`;
      }
      return opts;
    },
    [],
  );

  const handlePayNow = useCallback(async () => {
    if (!clientSecret) {
      Alert.alert(
        'Payment unavailable',
        'No payment intent found for this appointment.',
      );
      return;
    }

    setPresentingSheet(true);

    if (connectedAccountId) {
      const {STRIPE_CONFIG} = require('@/config/variables');
      const publishableKey =
        getResolvedStripePublishableKey() || STRIPE_CONFIG.publishableKey;
      if (publishableKey) {
        await initStripe({
          publishableKey,
          stripeAccountId: connectedAccountId,
          merchantIdentifier: STRIPE_CONFIG.merchantIdentifier,
          urlScheme: STRIPE_CONFIG.urlScheme,
        });
      }
    }

    const sheetOptions = buildPaymentSheetOptions(
      clientSecret,
      businessName,
      guardianName,
      guardianEmail,
    );

    const {error: initError} = await initPaymentSheet(sheetOptions);
    if (initError) {
      setPresentingSheet(false);
      console.error(
        '[Payment] initPaymentSheet error',
        initError.code,
        initError.message,
      );
      Alert.alert('Payment unavailable', initError.message);
      return;
    }

    try {
      const {error} = await presentPaymentSheet();
      setPresentingSheet(false);

      if (error) {
        console.error(
          '[Payment] presentPaymentSheet error',
          error.code,
          error.message,
        );
        Alert.alert('Payment failed', error.message);
        return;
      }
    } catch (err) {
      setPresentingSheet(false);
      console.error('[Payment] presentPaymentSheet threw', err);
      Alert.alert(
        'Payment failed',
        'Unable to present the payment sheet. Please try again.',
      );
      return;
    }

    const recordResult = await dispatch(recordPayment({appointmentId}));
    if (recordPayment.rejected.match(recordResult)) {
      console.warn(
        '[Payment] Failed to refresh appointment status after payment',
      );
    }

    navigation.replace('PaymentSuccess', {
      appointmentId,
      companionId: companionId ?? aptCompanionId,
      expenseId,
    });
  }, [
    clientSecret,
    connectedAccountId,
    businessName,
    guardianName,
    guardianEmail,
    initPaymentSheet,
    presentPaymentSheet,
    dispatch,
    appointmentId,
    companionId,
    aptCompanionId,
    expenseId,
    navigation,
    buildPaymentSheetOptions,
  ]);

  return {handlePayNow, presentingSheet};
};
