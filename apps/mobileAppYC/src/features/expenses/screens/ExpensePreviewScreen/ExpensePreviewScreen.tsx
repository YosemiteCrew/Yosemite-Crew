import React, {useMemo, useState, useEffect} from 'react';
import {Image, ScrollView, StyleSheet, Text, View, ActivityIndicator} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
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
import {LiquidGlassHeader} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';

type Navigation = NativeStackNavigationProp<ExpenseStackParamList, 'ExpensePreview'>;
type Route = RouteProp<ExpenseStackParamList, 'ExpensePreview'>;

type ExpenseDetailsProps = {
  expense: any;
  formattedAmount: string;
  businessName: string;
  onStatusRender: React.ReactNode;
  styles: any;
};

const ExpenseDetailsCard = ({
  expense,
  formattedAmount,
  businessName,
  onStatusRender,
  styles,
}: ExpenseDetailsProps) => (
  <View style={styles.invoiceDetailsCard}>
    <Text style={styles.invoiceDetailsTitle}>Expense Details</Text>

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Title</Text>
      <Text style={styles.detailValue}>{expense.title}</Text>
    </View>

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Business</Text>
      <Text style={styles.detailValue}>{businessName}</Text>
    </View>

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Category</Text>
      <Text style={styles.detailValue}>{resolveCategoryLabel(expense.category)}</Text>
    </View>

    {!!expense.subcategory && expense.subcategory !== 'none' && (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Sub category</Text>
        <Text style={styles.detailValue}>
          {resolveSubcategoryLabel(expense.category, expense.subcategory)}
        </Text>
      </View>
    )}

    {!!expense.visitType && expense.visitType !== 'other' && (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Visit type</Text>
        <Text style={styles.detailValue}>{resolveVisitTypeLabel(expense.visitType)}</Text>
      </View>
    )}

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Date</Text>
      <Text style={styles.detailValue}>
        {new Date(expense.date).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </Text>
    </View>

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Amount</Text>
      <Text style={[styles.detailValue, styles.detailValueBold]}>{formattedAmount}</Text>
    </View>

    {expense.description ? (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Description</Text>
        <Text style={styles.detailValue}>{expense.description}</Text>
      </View>
    ) : null}

    {onStatusRender}
  </View>
);

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
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = useState(0);
  const {openPaymentScreen, processingPayment} = useExpensePayment();

  const expenseId = (route.params as any)?.expenseId ?? '';
  const expense = useSelector(selectExpenseById(expenseId));
  const userCurrencyCode = useSelector(
    (state: RootState) => state.auth.user?.currency ?? 'USD',
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
      <SafeAreaView style={styles.root}>
        <LiquidGlassHeader
          insetsTop={insets.top}
          currentHeight={topGlassHeight}
          onHeightChange={setTopGlassHeight}
          topSectionStyle={styles.topSection}
          cardStyle={styles.topGlassCard}
          fallbackStyle={styles.topGlassFallback}>
          <Header title="Expenses" showBackButton onBack={handleBack} glass={false} />
        </LiquidGlassHeader>
        <View
          style={[
            styles.errorContainer,
            topGlassHeight
              ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['3']}
              : null,
          ]}>
          <Text style={styles.errorText}>Expense not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isInAppExpense = expense.source === 'inApp';
  const isPendingPayment = isExpensePaymentPending(expense);
  const shouldShowPaymentActions = isInAppExpense && (isPendingPayment || hasInvoice(expense));

  const renderStatusBadge = () => {
    if (!isInAppExpense) {
      return (
        <View style={[styles.statusBadge, styles.externalBadge]}>
          <Text style={styles.externalText}>External expense</Text>
        </View>
      );
    }

    const badgeStyle = isPendingPayment ? [styles.statusBadge, styles.pendingBadge] : [styles.statusBadge, styles.paidBadge];
    const badgeTextStyle = isPendingPayment ? styles.pendingText : styles.paidText;
    const badgeLabel = isPendingPayment ? 'Awaiting Payment' : 'Paid';
    return (
      <View style={[styles.statusBadgeContainer, {marginTop: theme.spacing['2']}]}>
        <View style={badgeStyle}>
          <Text style={badgeTextStyle}>{badgeLabel}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <LiquidGlassHeader
        insetsTop={insets.top}
        currentHeight={topGlassHeight}
        onHeightChange={setTopGlassHeight}
        topSectionStyle={styles.topSection}
        cardStyle={styles.topGlassCard}
        fallbackStyle={styles.topGlassFallback}>
        <Header
          title="Expenses"
          showBackButton
          onBack={handleBack}
          rightIcon={canEdit ? Images.blackEdit : undefined}
          onRightPress={canEdit ? handleEdit : undefined}
          glass={false}
        />
      </LiquidGlassHeader>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            topGlassHeight
              ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['3']}
              : null,
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Business Info Card using SummaryCards */}
          {isInAppExpense && invoiceData && (
            <SummaryCards businessSummary={businessSummary as any} />
          )}

          <ExpenseDetailsCard
            expense={expense}
            formattedAmount={formattedAmount}
            businessName={businessNameFromOrg ?? expense.businessName ?? '—'}
            onStatusRender={renderStatusBadge()}
            styles={styles}
          />

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
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    ...createLiquidGlassHeaderStyles(theme),
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['12'],
      gap: theme.spacing['4'],
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
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      gap: theme.spacing['2'],
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
    statusBadgeContainer: {
      marginTop: theme.spacing['3'],
    },
    statusBadge: {
      paddingVertical: theme.spacing['1'],
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.full,
      alignSelf: 'flex-start',
    },
    paidBadge: {
      backgroundColor: 'rgba(0, 143, 93, 0.12)',
    },
    paidText: {
      ...theme.typography.labelSmall,
      color: theme.colors.success,
    },
    pendingBadge: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    pendingText: {
      ...theme.typography.labelSmall,
      color: '#F59E0B',
    },
    externalBadge: {
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
    },
    externalText: {
      ...theme.typography.labelSmall,
      color: theme.colors.primary,
    },
    invoiceDetailsCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing['2'],
    },
    invoiceDetailsTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['1'],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing['2'],
    },
    detailLabel: {
      ...theme.typography.body14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
      maxWidth: '45%',
    },
    detailValue: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
      flexWrap: 'wrap',
    },
    detailValueBold: {
      fontWeight: '700',
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
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['4'],
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
