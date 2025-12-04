import {useCallback, useState} from 'react';
import {Alert} from 'react-native';
import {useDispatch} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import type {AppDispatch} from '@/app/store';
import type {Expense} from '@/features/expenses/types';
import {
  fetchExpenseInvoice,
  fetchExpensePaymentIntent,
  fetchExpensePaymentIntentByInvoice,
} from '@/features/expenses/thunks';
import {isExpensePaymentPending} from '@/features/expenses/utils/status';
import type {TabParamList} from '@/navigation/types';
import type {Invoice, PaymentIntentInfo} from '@/features/appointments/types';

// Extract appointmentId from invoice extensions
const extractAppointmentId = (invoice: Invoice | null): string | null => {
  if (!invoice) return null;
  if (invoice.appointmentId) {
    return invoice.appointmentId;
  }
  const extList = (invoice as any)?.extension;
  if (Array.isArray(extList)) {
    const appointmentIdExt = extList.find((ext: any) => ext?.url?.includes('appointment-id'));
    if (appointmentIdExt?.valueString) {
      return appointmentIdExt.valueString;
    }
  }
  const accountRef = (invoice as any)?.account?.reference as string | undefined;
  if (accountRef?.includes('Appointment/')) {
    return accountRef.split('/').pop() ?? null;
  }
  return null;
};

export const useExpensePayment = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const [processingPayment, setProcessingPayment] = useState(false);

  const validateExpenseForPayment = useCallback((expense: Expense): string | null => {
    if (expense.source !== 'inApp') {
      return 'Only in-app expenses can be paid here.';
    }
    if (!expense.invoiceId) {
      return 'Invoice not found for this expense. Please try again later.';
    }
    return null;
  }, []);

  const fetchInvoiceAndIntent = useCallback(
    async (
      expense: Expense,
      invoice: Invoice | null = null,
      preloadedPaymentIntent: PaymentIntentInfo | null = null,
    ): Promise<{invoice: Invoice | null; paymentIntent: PaymentIntentInfo | null}> => {
      let resolvedInvoice = invoice;
      let resolvedIntent = preloadedPaymentIntent;

      if (!resolvedInvoice) {
        const invoiceResult = await dispatch(
          fetchExpenseInvoice({invoiceId: expense.invoiceId!}),
        ).unwrap();
        resolvedInvoice = invoiceResult.invoice;
        resolvedIntent = invoiceResult.paymentIntent ?? null;
      }

      // Only fetch latest payment intent for unpaid invoices
      if (isExpensePaymentPending(expense)) {
        try {
          resolvedIntent = await dispatch(
            fetchExpensePaymentIntentByInvoice({invoiceId: expense.invoiceId!}),
          ).unwrap();
        } catch {
          // ignore, fallback to older intent resolution below
        }
      }

      if (!resolvedIntent?.clientSecret && resolvedInvoice) {
        const intentId =
          (resolvedInvoice as any)?.paymentIntent?.paymentIntentId ??
          (resolvedInvoice as any)?.payment_intent_id ??
          (resolvedInvoice as any)?.stripePaymentIntentId ??
          null;
        if (intentId) {
          resolvedIntent = await dispatch(
            fetchExpensePaymentIntent({paymentIntentId: intentId}),
          ).unwrap();
        }
      }

      return {invoice: resolvedInvoice, paymentIntent: resolvedIntent};
    },
    [dispatch],
  );

  const findTabNavigation = useCallback((): NavigationProp<TabParamList> | null => {
    let tabNavigation =
      navigation.getParent<NavigationProp<TabParamList>>() ??
      navigation.getParent()?.getParent<NavigationProp<TabParamList>>() ??
      navigation.getParent()?.getParent()?.getParent<NavigationProp<TabParamList>>();

    if (tabNavigation || !(navigation as any)?.getParent) {
      return tabNavigation ?? null;
    }

    let current: any = navigation;
    let depth = 0;
    while (current?.getParent && depth < 6) {
      current = current.getParent();
      depth += 1;
      if (current?.getState?.()?.routeNames?.includes?.('Appointments')) {
        return current as NavigationProp<TabParamList>;
      }
    }
    return tabNavigation ?? null;
  }, [navigation]);

  const openPaymentScreen = useCallback(
    async (expense: Expense, preloadedInvoice?: Invoice | null, preloadedPaymentIntent?: PaymentIntentInfo | null) => {
      if (processingPayment) {
        return;
      }

      const validationError = validateExpenseForPayment(expense);
      if (validationError) {
        Alert.alert('Payment unavailable', validationError);
        return;
      }

      setProcessingPayment(true);
      try {
        const {invoice, paymentIntent} = await fetchInvoiceAndIntent(
          expense,
          preloadedInvoice,
          preloadedPaymentIntent,
        );

        if (!invoice) {
          Alert.alert(
            'Payment unavailable',
            'Invoice data not found. Please try again.',
          );
          return;
        }

        // Extract appointmentId from invoice extensions
        const appointmentId = expense.appointmentId ?? extractAppointmentId(invoice);

        if (!appointmentId) {
          Alert.alert(
            'Payment unavailable',
            'Invoice does not contain appointment reference. Please try again.',
          );
          return;
        }

        // Navigate to PaymentInvoice screen with extracted appointmentId
        const tabNavigation = findTabNavigation();

        (tabNavigation ?? (navigation as any))?.navigate(
          'Appointments' as any,
          {
            screen: 'PaymentInvoice',
            params: {
              appointmentId,
              companionId: expense.companionId,
              expenseId: expense.id,
              invoice,
              paymentIntent,
            },
          } as any,
        );
      } catch (error) {
        Alert.alert(
          'Payment unavailable',
          error instanceof Error ? error.message : 'Unable to start payment. Please try again.',
        );
      } finally {
        setProcessingPayment(false);
      }
    },
    [fetchInvoiceAndIntent, findTabNavigation, navigation, processingPayment, validateExpenseForPayment],
  );

  return {openPaymentScreen, processingPayment};
};

export default useExpensePayment;
