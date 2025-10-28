import React, {useMemo} from 'react';
import {ScrollView, View, Text, StyleSheet, Image} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {selectInvoiceForAppointment} from '@/features/appointments/selectors';
import {recordPayment} from '@/features/appointments/appointmentsSlice';
import {BookingSummaryCard} from '@/components/appointments/BookingSummaryCard';
import {Images} from '@/assets/images';
import type {InvoiceItem} from '@/features/appointments/types';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return '—';
  }

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const buildInvoiceItemKey = ({description, rate, lineTotal, qty}: InvoiceItem) =>
  `${description}-${rate}-${lineTotal}-${qty ?? 0}`;

export const PaymentInvoiceScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const route = useRoute<any>();
  const navigation = useNavigation<Nav>();
  const dispatch = useDispatch<AppDispatch>();
  const {appointmentId, companionId} = route.params as {appointmentId: string; companionId?: string};
  const invoice = useSelector(selectInvoiceForAppointment(appointmentId));
  const apt = useSelector((s: RootState) => s.appointments.items.find(a => a.id === appointmentId));
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === apt?.businessId));
  const employee = useSelector((s: RootState) => s.businesses.employees.find(e => e.id === apt?.employeeId));

  const total = invoice?.total ?? 0;

  const handlePayNow = async () => {
    // Mocked payment success. Integrate Stripe PaymentSheet later.
    await dispatch(recordPayment({appointmentId}));
    navigation.replace('PaymentSuccess', {appointmentId, companionId: companionId ?? apt?.companionId});
  };

  return (
    <SafeArea>
      <Header title="Book an Appointment" showBackButton onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <BookingSummaryCard
          title={business?.name || ''}
          subtitlePrimary={business?.address || undefined}
          subtitleSecondary={business?.description || undefined}
          image={business?.photo}
          interactive={false}
          style={styles.summaryCard}
        />
        {employee && (
          <BookingSummaryCard
            title={employee.name}
            subtitlePrimary={employee.specialization}
            subtitleSecondary={employee.title}
            image={employee.avatar}
            interactive={false}
            style={styles.summaryCard}
          />
        )}

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Invoice details</Text>
          <MetaRow label="Invoice number" value={invoice?.invoiceNumber ?? '—'} />
          <MetaRow label="Appointment ID" value={apt?.id ?? '—'} />
          <MetaRow label="Invoice date" value={formatDate(invoice?.invoiceDate)} />
          <MetaRow label="Due till" value={invoice?.dueDate ?? '—'} />
        </View>

        <View style={styles.invoiceForCard}>
          <Text style={styles.metaTitle}>Invoice for</Text>
          <Text style={styles.invoiceText}>{invoice?.billedToName ?? '—'}</Text>
          {!!invoice?.billedToEmail && <Text style={styles.invoiceSubText}>{invoice.billedToEmail}</Text>}
        </View>

        <Image source={invoice?.image ?? Images.sampleInvoice} style={styles.invoiceImage} />

        <View style={styles.breakdownCard}>
          <Text style={styles.metaTitle}>Description</Text>
          {invoice?.items?.map(item => (
            <BreakdownRow
              key={buildInvoiceItemKey(item)}
              label={item.description}
              value={`$${item.lineTotal.toFixed(2)}`}
            />
          ))}
          <BreakdownRow label="Sub Total" value={`$${(invoice?.subtotal ?? 0).toFixed(2)}`} subtle />
          {!!invoice?.discount && <BreakdownRow label="Discount" value={`-$${invoice.discount.toFixed(2)}`} subtle />}
          {!!invoice?.tax && <BreakdownRow label="Tax" value={`$${invoice.tax.toFixed(2)}`} subtle />}
          <BreakdownRow label="Total" value={`$${total.toFixed(2)}`} highlight />
          <Text style={styles.breakdownNote}>Price calculated as: Sum of line-item (Qty × Unit Price) – Discounts + Taxes.</Text>
        </View>

        <View style={styles.termsCard}>
          <Text style={styles.metaTitle}>Payment Terms & Legal Disclaimer</Text>
          <Text style={styles.termsLine}>Payment Terms: Net 14 days (due 21 Jul 2025)</Text>
          <Text style={styles.termsLine}>Statutory Liability: You have the right to request correction or refund for any defective services.</Text>
          <Text style={styles.termsLine}>After-Sales Service & Guarantee: Free post-op consultation within 7 days. 24×7 emergency hotline available.</Text>
          <Text style={styles.termsLine}>Complaints to: San Francisco Animal Medical Center, 456 Referral Rd, Suite 200, San Francisco CA 94103, (415) 555-0199, complaints@sfamc.com</Text>
        </View>
        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Pay now"
            onPress={handlePayNow}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
          />
          <LiquidGlassButton
            title="Pay later"
            onPress={() => navigation.goBack()}
            height={56}
            borderRadius={16}
            tintColor="rgba(255,255,255,0.95)"
            forceBorder
            borderColor={theme.colors.border}
            textStyle={styles.payLaterText}
            shadowIntensity="none"
          />
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

const BreakdownRow = ({label, value, highlight, subtle}: {label: string; value: string; highlight?: boolean; subtle?: boolean}) => (
  <View style={[breakdownStyles.row, highlight && breakdownStyles.rowHighlight, subtle && breakdownStyles.rowSubtle]}>
    <Text style={[breakdownStyles.label, highlight && breakdownStyles.labelHighlight]}>{label}</Text>
    <Text style={[breakdownStyles.value, highlight && breakdownStyles.valueHighlight]}>{value}</Text>
  </View>
);

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[24],
    gap: theme.spacing[4],
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
  },
  metaTitle: {
    ...theme.typography.titleSmall,
    color: theme.colors.secondary,
    marginBottom: theme.spacing[1],
  },
  invoiceForCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    padding: theme.spacing[4],
    gap: theme.spacing[1],
  },
  invoiceText: {
    ...theme.typography.titleSmall,
    color: theme.colors.secondary,
  },
  invoiceSubText: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
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
  payLaterText: {
    ...theme.typography.titleSmall,
    color: theme.colors.secondary,
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
