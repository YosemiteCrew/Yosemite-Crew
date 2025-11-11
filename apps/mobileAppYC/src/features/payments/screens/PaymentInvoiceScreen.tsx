import React, {useMemo} from 'react';
import {ScrollView, View, Text, StyleSheet, Image} from 'react-native';
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
import type {InvoiceItem} from '@/features/appointments/types';
import {selectAuthUser} from '@/features/auth/selectors';

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
  const {appointmentId, companionId} = route.params as {
    appointmentId: string;
    companionId?: string;
  };
  const invoice = useSelector(selectInvoiceForAppointment(appointmentId));
  const apt = useSelector((s: RootState) =>
    s.appointments.items.find(a => a.id === appointmentId),
  );
  const business = useSelector((s: RootState) =>
    s.businesses.businesses.find(b => b.id === apt?.businessId),
  );
  const service = useSelector((s: RootState) =>
    apt?.serviceId
      ? s.businesses.services.find(svc => svc.id === apt.serviceId)
      : null,
  );
  const employee = useSelector((s: RootState) =>
    s.businesses.employees.find(e => e.id === apt?.employeeId),
  );
  const companion = useSelector((s: RootState) =>
    companionId ?? apt?.companionId
      ? s.companion.companions.find(
          c => c.id === (companionId ?? apt?.companionId),
        )
      : null,
  );
  const authUser = useSelector(selectAuthUser);

  const total = invoice?.total ?? 0;
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

  const handlePayNow = async () => {
    // Mocked payment success. Integrate Stripe PaymentSheet later.
    await dispatch(recordPayment({appointmentId}));
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
        <SummaryCards
          business={business}
          service={service}
          serviceName={apt?.serviceName}
          employee={employee}
          cardStyle={styles.summaryCard}
        />

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Invoice details</Text>
          <MetaRow
            label="Invoice number"
            value={invoice?.invoiceNumber ?? '—'}
          />
          <MetaRow label="Appointment ID" value={apt?.id ?? '—'} />
          <MetaRow
            label="Invoice date"
            value={formatDate(invoice?.invoiceDate)}
          />
          <MetaRow label="Due till" value={invoice?.dueDate ?? '—'} />
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
          {invoice?.items?.map(item => (
            <BreakdownRow
              key={buildInvoiceItemKey(item)}
              label={item.description}
              value={`$${item.lineTotal.toFixed(2)}`}
            />
          ))}
          <BreakdownRow
            label="Sub Total"
            value={`$${(invoice?.subtotal ?? 0).toFixed(2)}`}
            subtle
          />
          {!!invoice?.discount && (
            <BreakdownRow
              label="Discount"
              value={`-$${invoice.discount.toFixed(2)}`}
              subtle
            />
          )}
          {!!invoice?.tax && (
            <BreakdownRow
              label="Tax"
              value={`$${invoice.tax.toFixed(2)}`}
              subtle
            />
          )}
          <BreakdownRow
            label="Total"
            value={`$${total.toFixed(2)}`}
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
          <LiquidGlassButton
            title="Pay now"
            onPress={handlePayNow}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            textStyle={styles.confirmPrimaryButtonText}
          />
          <LiquidGlassButton
            title="Pay later"
            onPress={() => navigation.goBack()}
            height={56}
            borderRadius={16}
            glassEffect="clear"
            tintColor={theme.colors.surface}
            forceBorder
            borderColor={theme.colors.secondary}
            textStyle={styles.payLaterText}
            shadowIntensity="medium"
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
    payLaterText: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
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
