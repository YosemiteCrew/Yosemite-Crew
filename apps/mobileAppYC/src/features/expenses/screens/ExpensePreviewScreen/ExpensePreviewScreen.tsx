import React, {useMemo, useState, useEffect as useReactEffect} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
import {useExpensePayment} from '@/features/expenses/hooks/useExpensePayment';
import {
  hasInvoice,
  isExpensePaymentPending,
} from '@/features/expenses/utils/status';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {SummaryCards} from '@/features/appointments/components/SummaryCards/SummaryCards';
import {fetchBusinessDetails} from '@/features/linkedBusinesses';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import type {
  DetailItem,
  DetailBadge,
} from '@/shared/components/common/DetailsCard';
import type {ExpenseAttachment} from '@/features/expenses/types';

type Navigation = NativeStackNavigationProp<
  ExpenseStackParamList,
  'ExpensePreview'
>;
type Route = RouteProp<ExpenseStackParamList, 'ExpensePreview'>;

type CategoryVisual = {
  backgroundColor: string;
  iconColor: string;
  iconName: string;
};

const getCategoryVisual = (theme: any, category?: string): CategoryVisual => {
  const {colors} = theme;
  switch (category) {
    case 'hygiene-maintenance':
      return {
        backgroundColor: colors.pinkGlow,
        iconColor: colors.pink,
        iconName: 'cut-outline',
      };
    case 'dietary-plans':
      return {
        backgroundColor: colors.avatarGreenBg,
        iconColor: colors.avatarGreenInk,
        iconName: 'nutrition-outline',
      };
    case 'admin':
      return {
        backgroundColor: colors.avatarVioletBg,
        iconColor: colors.avatarVioletInk,
        iconName: 'document-text-outline',
      };
    case 'others':
      return {
        backgroundColor: colors.avatarAmberBg,
        iconColor: colors.avatarAmberInk,
        iconName: 'pricetag-outline',
      };
    default:
      return {
        backgroundColor: colors.blueSoft,
        iconColor: colors.blueText,
        iconName: 'medkit-outline',
      };
  }
};

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
          borderRadius={16}
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

  useReactEffect(() => {
    if (!expense?.invoiceId || expense.source !== 'inApp') {
      return;
    }

    const fetchInvoiceData = async () => {
      try {
        const result = await dispatch(
          fetchExpenseInvoice({invoiceId: expense.invoiceId!}),
        ).unwrap();
        setInvoiceData(result.invoice);
        setOrganisationData(result.organistion || result.organisation || null);

        if (isExpensePaymentPending(expense) && result.paymentIntentId) {
          setLoadingPayment(true);
          try {
            try {
              const latestIntent = await dispatch(
                fetchExpensePaymentIntentByInvoice({
                  invoiceId: expense.invoiceId!,
                }),
              ).unwrap();
              setPaymentIntent(latestIntent);
            } catch {
              const intentResult = await dispatch(
                fetchExpensePaymentIntent({
                  paymentIntentId: result.paymentIntentId,
                }),
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
  useReactEffect(() => {
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
        console.debug(
          '[ExpensePreview] Could not fetch places image for placesId:',
          placesId,
        );
      });
  }, [
    placesId,
    businessImage,
    isDummyImage,
    fallbackPhoto,
    dispatch,
    setFallbackPhoto,
  ]);
};

export const ExpensePreviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {openPaymentScreen, processingPayment} = useExpensePayment();
  const [isPdfInteracting, setIsPdfInteracting] = React.useState(false);

  const expenseId = (route.params as any)?.expenseId ?? '';
  const expense = useSelector(selectExpenseById(expenseId));
  const userCurrencyCode = useSelector(
    (state: RootState) => state.auth.user?.currency ?? 'USD',
  );
  const companion = useSelector((state: RootState) =>
    expense?.companionId
      ? state.companion.companions.find(c => c.id === expense.companionId)
      : null,
  );
  const currencyCode = expense?.currencyCode ?? userCurrencyCode;

  const {invoiceData, organisationData, paymentIntent, loadingPayment} =
    useExpenseInvoiceDetails({expense, dispatch});
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);

  // Always fetch latest expense details (including external) from backend
  useReactEffect(() => {
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
  const businessNameFromOrg =
    organisationData?.name ?? expense?.businessName ?? 'Healthcare Provider';
  const businessAddress = orgAddress?.addressLine ?? 'Address not available';
  const businessCity = orgAddress?.city ?? '';
  const businessState = orgAddress?.state ?? '';
  const businessPostalCode = orgAddress?.postalCode ?? '';
  const businessImage = organisationData?.image ?? null;
  const placesId = organisationData?.placesId ?? null;

  // Check if the image is a dummy/placeholder URL
  const isDummyImage = isDummyPhoto(businessImage);

  const fullBusinessAddress = [
    businessAddress,
    businessCity,
    businessState,
    businessPostalCode,
  ]
    .filter(Boolean)
    .join(', ');

  // Use organisation image only if it's not a dummy, otherwise use fallback photo
  // If placesId is empty/invalid, the image will be undefined (no fallback available)
  const resolvedBusinessImage =
    !isDummyImage && businessImage ? businessImage : fallbackPhoto;

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
          <Header
            title="Expenses"
            showBackButton
            onBack={handleBack}
            glass={false}
          />
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
  const shouldShowPaymentActions =
    isInAppExpense && (isPendingPayment || hasInvoice(expense));

  const heroDate = new Date(expense.date).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const categoryVisual = getCategoryVisual(theme, expense.category);

  const detailItems: DetailItem[] = [
    {
      label: 'Provider',
      value: businessNameFromOrg ?? expense.businessName ?? '—',
    },
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
      label: 'Description',
      value: expense.description || '',
      hidden: !expense.description,
    },
  ];

  const visibleDetailItems = detailItems.filter(item => !item.hidden);

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
          title="Expense"
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
          nestedScrollEnabled
          scrollEnabled={!isPdfInteracting}
          showsVerticalScrollIndicator={false}>
          {/* Hero: category tile + serif amount + title + date + status */}
          <ExpenseHero
            styles={styles}
            categoryVisual={categoryVisual}
            formattedAmount={formattedAmount}
            title={expense.title}
            heroDate={heroDate}
            badges={badges}
          />

          {/* Business Info Card using SummaryCards */}
          {isInAppExpense && invoiceData && (
            <SummaryCards
              businessSummary={businessSummary as any}
              interactive={false}
              cardStyle={styles.summaryCard}
            />
          )}

          {/* Detail group: hairline-divided rows on the inset surface */}
          {visibleDetailItems.length > 0 && (
            <View style={styles.detailGroup}>
              {visibleDetailItems.map((item, index) => (
                <View
                  key={item.label}
                  style={[
                    styles.detailRow,
                    index < visibleDetailItems.length - 1 &&
                      styles.detailRowDivider,
                  ]}>
                  <Text style={styles.detailLabel}>{item.label}</Text>
                  <Text style={styles.detailValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Receipt */}
          <ReceiptSection
            styles={styles}
            theme={theme}
            attachments={expense.attachments}
            onPdfTouchStart={() => setIsPdfInteracting(true)}
            onPdfTouchEnd={() => setIsPdfInteracting(false)}
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
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const ExpenseHero = ({
  styles,
  categoryVisual,
  formattedAmount,
  title,
  heroDate,
  badges,
}: {
  styles: any;
  categoryVisual: CategoryVisual;
  formattedAmount: string;
  title: string;
  heroDate: string;
  badges: DetailBadge[];
}) => (
  <View style={styles.hero}>
    <View
      style={[
        styles.heroTile,
        {backgroundColor: categoryVisual.backgroundColor},
      ]}>
      <Ionicons
        name={categoryVisual.iconName}
        size={28}
        color={categoryVisual.iconColor}
      />
    </View>
    <Text style={styles.heroAmount}>{formattedAmount}</Text>
    <Text style={styles.heroTitle}>{title}</Text>
    <Text style={styles.heroDate}>{heroDate}</Text>
    {badges.length > 0 && (
      <View style={styles.badgeRow}>
        {badges.map(badge => (
          <View
            key={badge.text}
            style={[
              styles.statusBadge,
              {backgroundColor: badge.backgroundColor},
            ]}>
            <Text style={[styles.statusText, {color: badge.textColor}]}>
              {badge.text}
            </Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

const ReceiptSection = ({
  styles,
  theme,
  attachments,
  onPdfTouchStart,
  onPdfTouchEnd,
}: {
  styles: any;
  theme: any;
  attachments?: ExpenseAttachment[];
  onPdfTouchStart: () => void;
  onPdfTouchEnd: () => void;
}) => (
  <View style={styles.receiptSection}>
    <Text style={styles.receiptTitle}>Receipt</Text>
    {attachments && attachments.length > 0 ? (
      <DocumentAttachmentViewer
        attachments={attachments}
        onPdfTouchStart={onPdfTouchStart}
        onPdfTouchEnd={onPdfTouchEnd}
      />
    ) : (
      <View style={styles.fallbackCard}>
        <View style={styles.fallbackTile}>
          <Ionicons
            name="receipt-outline"
            size={18}
            color={theme.colors.avatarAmberInk}
          />
        </View>
        <Text style={styles.fallbackTitle}>No attachments</Text>
        <Text style={styles.fallbackText}>
          There are no files attached to this expense.
        </Text>
      </View>
    )}
  </View>
);

const createStyles = (theme: any) =>
  StyleSheet.create({
    contentContainer: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['5'],
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
    hero: {
      alignItems: 'center',
      paddingTop: theme.spacing['1'],
      gap: theme.spacing['1'],
    },
    heroTile: {
      width: 64,
      height: 64,
      borderRadius: theme.borderRadius.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroAmount: {
      ...theme.typography.amountHero,
      fontSize: 36,
      lineHeight: 40,
      color: theme.colors.ink,
      marginTop: theme.spacing['2.5'],
      fontVariant: ['tabular-nums'],
    },
    heroTitle: {
      ...theme.typography.bodyMedium,
      fontSize: 15.5,
      fontWeight: '600',
      color: theme.colors.inkBody,
      textAlign: 'center',
    },
    heroDate: {
      ...theme.typography.body13,
      color: theme.colors.inkMuted,
      textAlign: 'center',
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      marginTop: theme.spacing['2'],
    },
    statusBadge: {
      paddingVertical: theme.spacing['1'],
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.full,
    },
    statusText: {
      ...theme.typography.labelXs,
    },
    summaryCard: {
      marginBottom: theme.spacing['1'],
    },
    detailGroup: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.cardSmall,
      paddingHorizontal: theme.spacing['4'],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing['3.5'],
      gap: theme.spacing['4'],
    },
    detailRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.hairline,
    },
    detailLabel: {
      ...theme.typography.body13,
      color: theme.colors.inkMuted,
    },
    detailValue: {
      ...theme.typography.body14,
      fontWeight: '600',
      color: theme.colors.inkBody,
      flex: 1,
      textAlign: 'right',
      flexWrap: 'wrap',
    },
    receiptSection: {
      gap: theme.spacing['2.5'],
    },
    receiptTitle: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.ink,
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
      color: theme.colors.ctaText,
      textAlign: 'center',
      fontWeight: '600',
    },
    fallbackCard: {
      backgroundColor: theme.colors.screen,
      borderRadius: theme.borderRadius.cardSmall,
      padding: theme.spacing['6'],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      ...theme.shadows.card,
    },
    fallbackTile: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.avatarAmberBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing['3'],
    },
    fallbackTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.ink,
      marginBottom: theme.spacing['1'],
    },
    fallbackText: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkMuted,
      textAlign: 'center',
    },
  });

export default ExpensePreviewScreen;
