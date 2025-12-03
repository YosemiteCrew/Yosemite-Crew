import {useCallback, useState} from 'react';
import {Alert} from 'react-native';
import {useDispatch} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import type {AppDispatch} from '@/app/store';
import type {Expense} from '@/features/expenses/types';
import {fetchExpenseInvoice, fetchExpensePaymentIntent} from '@/features/expenses/thunks';
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

  const openPaymentScreen = useCallback(
    async (expense: Expense, preloadedInvoice?: Invoice | null, preloadedPaymentIntent?: PaymentIntentInfo | null) => {
      if (processingPayment) {
        return;
      }

      if (expense.source !== 'inApp') {
        Alert.alert('Payment unavailable', 'Only in-app expenses can be paid here.');
        return;
      }

      if (!expense.invoiceId) {
        Alert.alert(
          'Payment unavailable',
          'Invoice not found for this expense. Please try again later.',
        );
        return;
      }

      setProcessingPayment(true);
      try {
        let invoice = preloadedInvoice;
        let paymentIntent = preloadedPaymentIntent;
        let paymentIntentId: string | null = null;

        // Fetch invoice if not preloaded
        if (!invoice) {
          const invoiceResult = await dispatch(
            fetchExpenseInvoice({invoiceId: expense.invoiceId}),
          ).unwrap();

          invoice = invoiceResult.invoice;
          paymentIntentId =
            invoiceResult.paymentIntent?.paymentIntentId ?? invoiceResult.paymentIntentId;
          paymentIntent = invoiceResult.paymentIntent ?? null;

          // Fetch payment intent if we have the ID but not the full intent data
          if (!paymentIntent?.clientSecret && paymentIntentId) {
            paymentIntent = await dispatch(
              fetchExpensePaymentIntent({paymentIntentId}),
            ).unwrap();
          }
        } else {
          // Invoice was preloaded, extract payment intent ID if available
          paymentIntentId = (invoice as any)?.paymentIntentId || (paymentIntent as any)?.paymentIntentId;
        }

        if (!invoice) {
          Alert.alert(
            'Payment unavailable',
            'Invoice data not found. Please try again.',
          );
          return;
        }

        // Extract appointmentId from invoice extensions
        const appointmentId = extractAppointmentId(invoice);

        if (!appointmentId) {
          Alert.alert(
            'Payment unavailable',
            'Invoice does not contain appointment reference. Please try again.',
          );
          return;
        }

        // Navigate to PaymentInvoice screen with extracted appointmentId
        let tabNavigation =
          navigation.getParent<NavigationProp<TabParamList>>() ??
          navigation.getParent()?.getParent<NavigationProp<TabParamList>>() ??
          navigation.getParent()?.getParent()?.getParent<NavigationProp<TabParamList>>();

        if (!tabNavigation && (navigation as any)?.getParent) {
          let current: any = navigation;
          let depth = 0;
          while (current?.getParent && depth < 6) {
            current = current.getParent();
            depth += 1;
            if (current?.getState?.()?.routeNames?.includes?.('Appointments')) {
              tabNavigation = current as NavigationProp<TabParamList>;
              break;
            }
          }
        }

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
    [dispatch, navigation, processingPayment],
  );

  return {openPaymentScreen, processingPayment};
};

export default useExpensePayment;
