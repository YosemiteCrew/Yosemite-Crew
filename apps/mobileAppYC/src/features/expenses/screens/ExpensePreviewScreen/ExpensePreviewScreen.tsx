import React, {useMemo, useState, useEffect} from 'react';
import {Image, ScrollView, StyleSheet, Text, View, ActivityIndicator} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {
  selectExpenseById,
  fetchExpenseInvoice,
  fetchExpensePaymentIntent,
  fetchExpensePaymentIntentByInvoice,
  fetchExpenseById,
} from '@/features/expenses';
import type {ExpenseStackParamList} from '@/navigation/types';
import {Images} from '@/assets/images';
import {formatCurrency} from '@/shared/utils/currency';
import {
  resolveCategoryLabel,
  resolveSubcategoryLabel,
  resolveVisitTypeLabel,
} from '@/features/expenses/utils/expenseLabels';
import DocumentAttachmentViewer from '@/features/documents/components/DocumentAttachmentViewer';
import type {DocumentFile} from '@/features/documents/types';
import {useExpensePayment} from '@/features/expenses/hooks/useExpensePayment';
import {hasInvoice, isExpensePaymentPending} from '@/features/expenses/utils/status';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {fetchBusinessDetails} from '@/features/linkedBusinesses';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {DetailsCard, type DetailItem, type DetailBadge} from '@/shared/components/common/DetailsCard';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList, 'ExpensePreview'>;
type Route = RouteProp<ExpenseStackParamList, 'ExpensePreview'>;

const PaymentActions = ({
  shouldShow,
  loadingPayment,
  processingPayment,
  formattedAmount,
  isPending,
  onOpenInvoice,
  styles,
  theme,
}: {
  shouldShow: boolean;
  loadingPayment: boolean;
  processingPayment: boolean;
  formattedAmount: string;
  isPending: boolean;
  onOpenInvoice: () => void;
  styles: any;
  theme: any;
}) => {
  if (!shouldShow) return null;
  return (
    <View style={styles.paymentButtonContainer}>
      {loadingPayment ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : (
        <LiquidGlassButton
          title={isPending ? `Pay ${formattedAmount}` : 'View Invoice'}
          onPress={onOpenInvoice}
          height={48}
          borderRadius={12}
          disabled={processingPayment || loadingPayment}
          tintColor={theme.colors.secondary}
          shadowIntensity="medium"
          textStyle={styles.paymentButtonText}
        />
      )}
    </View>
  );
};

const useExpenseInvoiceDetails = ({
  expense,
  dispatch,
}: {
  expense: any;
  dispatch: AppDispatch;
}) => {
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [organisationData, setOrganisationData] = useState<any>(null);
  const [paymentIntent, setPaymentIntent] = useState<any>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  useEffect(() => {
    if (!expense?.invoiceId || expense.source !== 'inApp') {
      return;
    }

    const fetchInvoiceData = async () => {
      try {
        const result = await dispatch(
          fetchExpenseInvoice({invoiceId: expense.invoiceId!})
        ).unwrap();
        setInvoiceData(result.invoice);
        setOrganisationData(result.organistion || result.organisation || null);

        if (isExpensePaymentPending(expense) && result.paymentIntentId) {
          setLoadingPayment(true);
          try {
            try {
              const latestIntent = await dispatch(
                fetchExpensePaymentIntentByInvoice({invoiceId: expense.invoiceId!})
              ).unwrap();
              setPaymentIntent(latestIntent);
            } catch {
              const intentResult = await dispatch(
                fetchExpensePaymentIntent({paymentIntentId: result.paymentIntentId})
              ).unwrap();
              setPaymentIntent(intentResult);
            }
          } catch (error) {
            console.error('Failed to fetch payment intent:', error);
          } finally {
            setLoadingPayment(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch invoice:', error);
      }
    };

    fetchInvoiceData();
  }, [expense, dispatch]);

  return {invoiceData, organisationData, paymentIntent, loadingPayment};
};

const useBusinessPhotoFallback = ({
  placesId,
  businessImage,
  isDummyImage,
  fallbackPhoto,
  setFallbackPhoto,
  dispatch,
}: {
  placesId: string | null;
  businessImage: string | null;
  isDummyImage: boolean;
  fallbackPhoto: string | null;
  setFallbackPhoto: (url: string | null) => void;
  dispatch: AppDispatch;
}) => {
  useEffect(() => {
    if (!placesId || typeof placesId !== 'string' || placesId.trim() === '') {
      return;
    }

    const hasValidPhoto = Boolean(businessImage && !isDummyImage);
    if (hasValidPhoto || fallbackPhoto) {
      return;
    }

    dispatch(fetchBusinessDetails(placesId))
      .unwrap()
      .then(res => {
        if (res?.photoUrl) {
          setFallbackPhoto(res.photoUrl);
        }
      })
      .catch(() => {
        console.debug('[ExpensePreview] Could not fetch places image for placesId:', placesId);
      });
  }, [placesId, businessImage, isDummyImage, fallbackPhoto, dispatch, setFallbackPhoto]);
};

export const ExpensePreviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {openPaymentScreen, processingPayment} = useExpensePayment();

  const expenseId = (route.params as any)?.expenseId ?? '';
  const expense = useSelector(selectExpenseById(expenseId));
  const userCurrencyCode = useSelector(
    (state: RootState) => state.auth.user?.currency ?? 'USD',
  );
  const companion = useSelector((state: RootState) =>
    expense?.companionId ? state.companion.companions.find(c => c.id === expense.companionId) : null,
  );
  const currencyCode = expense?.currencyCode ?? userCurrencyCode;

  const {
    invoiceData,
    organisationData,
    paymentIntent,
    loadingPayment,
  } = useExpenseInvoiceDetails({expense, dispatch});
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);

  // Always fetch latest expense details (including external) from backend
  useEffect(() => {
    if (expenseId && expense?.source === 'external') {
      dispatch(fetchExpenseById({expenseId}));
    }
  }, [dispatch, expenseId, expense?.source]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const canEdit = expense?.source === 'external';
  const formattedAmount = formatCurrency(expense?.amount ?? 0, {currencyCode});

  const handleEdit = () => {
    if (expense && canEdit) {
      navigation.navigate('EditExpense', {expenseId});
    }
  };

  const handleOpenInvoice = () => {
    if (expense && !processingPayment && !loadingPayment) {
      openPaymentScreen(expense, invoiceData, paymentIntent);
    }
  };

  // Extract organization details from the separated organisationData
  const orgAddress = organisationData?.address;
  const businessNameFromOrg = organisationData?.name ?? expense?.businessName ?? 'Healthcare Provider';
  const businessAddress = orgAddress?.addressLine ?? 'Address not available';
  const businessCity = orgAddress?.city ?? '';
  const businessState = orgAddress?.state ?? '';
  const businessPostalCode = orgAddress?.postalCode ?? '';
  const businessImage = organisationData?.image ?? null;
  const placesId = organisationData?.placesId ?? null;

  // Check if the image is a dummy/placeholder URL
  const isDummyImage = isDummyPhoto(businessImage);

  const fullBusinessAddress = [businessAddress, businessCity, businessState, businessPostalCode]
    .filter(Boolean)
    .join(', ');

  // Use organisation image only if it's not a dummy, otherwise use fallback photo
  // If placesId is empty/invalid, the image will be undefined (no fallback available)
  const resolvedBusinessImage = !isDummyImage && businessImage ? businessImage : fallbackPhoto;

  const businessSummary = {
    name: businessNameFromOrg,
    address: fullBusinessAddress,
    description: undefined,
    photo: resolvedBusinessImage ?? undefined,
  };

  useBusinessPhotoFallback({
    placesId,
    businessImage,
    isDummyImage,
    fallbackPhoto,
    setFallbackPhoto,
    dispatch,
  });


  if (!expense) {
    return (
      <LiquidGlassHeaderScreen
        header={
          <Header title="Expenses" showBackButton onBack={handleBack} glass={false} />
        }
        cardGap={theme.spacing['3']}
        contentPadding={theme.spacing['4']}>
        {contentPaddingStyle => (
          <View style={[styles.errorContainer, contentPaddingStyle]}>
            <Text style={styles.errorText}>Expense not found</Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>
    );
  }

  const isInAppExpense = expense.source === 'inApp';
  const isPendingPayment = isExpensePaymentPending(expense);
  const shouldShowPaymentActions = isInAppExpense && (isPendingPayment || hasInvoice(expense));

  const detailItems: DetailItem[] = [
    {label: 'Title', value: expense.title},
    {label: 'Provider', value: businessNameFromOrg ?? expense.businessName ?? '—'},
    {
      label: 'Companion',
      value: companion?.name ?? '',
      hidden: !companion?.name,
    },
    {label: 'Category', value: resolveCategoryLabel(expense.category)},
    {
      label: 'Sub category',
      value: resolveSubcategoryLabel(expense.category, expense.subcategory),
      hidden: !expense.subcategory || expense.subcategory === 'none',
    },
    {
      label: 'Visit type',
      value: resolveVisitTypeLabel(expense.visitType),
      hidden: !expense.visitType || expense.visitType === 'other',
    },
    {
      label: 'Date',
      value: new Date(expense.date).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    },
    {label: 'Amount', value: formattedAmount, bold: true},
    {label: 'Description', value: expense.description || '', hidden: !expense.description},
  ];

  const badges: DetailBadge[] = [];
  if (!isInAppExpense) {
    badges.push({
      text: 'External expense',
      backgroundColor: theme.colors.infoSurface,
      textColor: theme.colors.primary,
    });
  } else if (isPendingPayment) {
    badges.push({
      text: 'Awaiting Payment',
      backgroundColor: theme.colors.warningSurface,
      textColor: theme.colors.warning,
    });
  } else {
    badges.push({
      text: 'Paid',
      backgroundColor: theme.colors.successSurface,
      textColor: theme.colors.success,
    });
  }

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Expenses"
          showBackButton
          onBack={handleBack}
          rightIcon={canEdit ? Images.blackEdit : undefined}
          onRightPress={canEdit ? handleEdit : undefined}
          glass={false}
        />
      }
      cardGap={theme.spacing['4']}
      contentPadding={theme.spacing['4']}>
      {contentPaddingStyle => (
        <ScrollView
          contentContainerStyle={[styles.contentContainer, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}>
          {/* Business Info Card using SummaryCards */}
          {isInAppExpense && invoiceData && (
            <SummaryCards businessSummary={businessSummary as any} interactive={false} cardStyle={styles.summaryCard} />
          )}

          <DetailsCard title="Expense Details" items={detailItems} badges={badges} />

          <PaymentActions
            shouldShow={shouldShowPaymentActions}
            loadingPayment={loadingPayment}
            processingPayment={processingPayment}
            formattedAmount={formattedAmount}
            isPending={isPendingPayment}
            onOpenInvoice={handleOpenInvoice}
            styles={styles}
            theme={theme}
          />

          <View style={styles.previewContainer}>
            {expense.attachments && expense.attachments.length > 0 ? (
              <DocumentAttachmentViewer attachments={expense.attachments as DocumentFile[]} />
            ) : (
              <View style={styles.fallbackCard}>
                <Image source={Images.documentIcon} style={styles.fallbackIcon} />
                <Text style={styles.fallbackTitle}>No attachments</Text>
                <Text style={styles.fallbackText}>There are no files attached to this expense.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    contentContainer: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['6'],
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
    summaryCard: {
      marginBottom: theme.spacing['1'],
    },
    summaryTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
    },
    summarySubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    summaryDate: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    description: {
      ...theme.typography.bodySmall,
      color: theme.colors.secondary,
      fontStyle: 'italic',
      marginTop: theme.spacing['1'],
    },
    summaryAmount: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
      marginTop: theme.spacing['2'],
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing['6'],
      gap: theme.spacing['2'],
    },
    loadingText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    paymentButtonContainer: {
      // Spacing handled by container gap
      gap: theme.spacing['2'],
    },
    paymentButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
      fontWeight: '600',
    },
    previewContainer: {
      gap: theme.spacing['4'],
    },
    fallbackCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['6'],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    fallbackIcon: {
      width: 64,
      height: 64,
      marginBottom: theme.spacing['4'],
      tintColor: theme.colors.textSecondary,
    },
    fallbackTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing['2'],
    },
    fallbackText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default ExpensePreviewScreen;
