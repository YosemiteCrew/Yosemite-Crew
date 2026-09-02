import React, {useMemo, useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  Linking,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import type {
  AdverseEventStackParamList,
  HomeStackParamList,
} from '@/navigation/types';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {useAdverseEventReport} from '@/features/adverseEventReporting/state/AdverseEventReportContext';
import {adverseEventService} from '@/features/adverseEventReporting/services/adverseEventService';
import {showErrorAlert, showSuccessAlert} from '@/shared/utils/commonHelpers';
import {SUPPORTED_ADVERSE_EVENT_COUNTRIES} from '@/features/adverseEventReporting/content/supportedCountries';
import type {Theme} from '@/theme';
import {useResolvedUserCurrency} from '@/shared/hooks/useResolvedUserCurrency';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'ThankYou'>;

type RegulatoryContact = {
  authorityName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

export const ThankYouScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {draft, setConsentToContact, setProductInfo, resetDraft} =
    useAdverseEventReport();
  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const linkedBusinesses = useSelector(
    (state: RootState) => state.linkedBusinesses.linkedBusinesses,
  );
  const authUser = useSelector((state: RootState) => state.auth.user);
  const resolvedCurrency = useResolvedUserCurrency();

  const [agreeToBeContacted, setAgreeToBeContacted] = useState(
    draft.consentToContact,
  );
  const [contactError, setContactError] = useState('');
  const [submitLoading, setSubmitLoading] = useState<
    'manufacturer' | 'hospital' | null
  >(null);
  const [regulatoryLoading, setRegulatoryLoading] = useState(false);
  const [regulatoryContact, setRegulatoryContact] =
    useState<RegulatoryContact | null>(null);

  const resolvedCompanion = useMemo(() => {
    const targetId = draft.companionId ?? selectedCompanionId;
    if (!targetId) {
      return null;
    }
    return companions.find(c => c.id === targetId) ?? null;
  }, [companions, draft.companionId, selectedCompanionId]);

  const resolvedOrganisationId = useMemo(() => {
    if (!draft.linkedBusinessId) {
      return null;
    }
    const linked = linkedBusinesses.find(b => b.id === draft.linkedBusinessId);
    return linked?.businessId ?? linked?.id ?? null;
  }, [draft.linkedBusinessId, linkedBusinesses]);

  const resolveCountryMeta = () => {
    const countryName = authUser?.address?.country ?? '';
    if (!countryName) {
      return {country: '', iso2: null, iso3: null, authorityName: null};
    }
    const match = SUPPORTED_ADVERSE_EVENT_COUNTRIES.find(
      c => c.name.toLowerCase() === countryName.toLowerCase(),
    );
    if (!match) {
      return {country: '', iso2: null, iso3: null, authorityName: null};
    }
    return {
      country: match.name,
      iso2: match.code,
      iso3: match.iso3,
      authorityName: match.authorityName,
    };
  };

  const handleBack = () => {
    navigation
      .getParent<NativeStackNavigationProp<HomeStackParamList>>()
      ?.navigate('Home');
  };

  const requireContactConsent = async (action: () => void | Promise<void>) => {
    if (!agreeToBeContacted) {
      setContactError('Select the checkbox to continue');
      return;
    }
    if (contactError) {
      setContactError('');
    }
    setConsentToContact(true);
    await action();
  };

  const ensureSubmissionInputs = () => {
    if (!authUser) {
      throw new Error('Please sign in again to submit this report.');
    }
    if (!resolvedCompanion) {
      throw new Error('Select a companion to continue.');
    }
    if (!resolvedOrganisationId) {
      throw new Error('Select a linked hospital to continue.');
    }
    if (!draft.productInfo) {
      throw new Error('Add product details before submitting.');
    }
  };

  const handleSubmitReport = async (target: 'manufacturer' | 'hospital') => {
    await requireContactConsent(async () => {
      try {
        ensureSubmissionInputs();
        if (
          !authUser ||
          !resolvedCompanion ||
          !draft.productInfo ||
          !resolvedOrganisationId
        ) {
          return;
        }

        setSubmitLoading(target);
        const {productFiles} = await adverseEventService.submitReport({
          organisationId: resolvedOrganisationId,
          reporterType: draft.reporterType,
          reporter: authUser,
          companion: resolvedCompanion,
          product: draft.productInfo,
          destinations: {
            sendToManufacturer: target === 'manufacturer',
            sendToHospital: target === 'hospital',
            sendToAuthority: false,
          },
          consentToContact: agreeToBeContacted,
          reporterCurrency: resolvedCurrency,
        });

        if (productFiles?.length) {
          setProductInfo({
            ...(draft.productInfo ?? {files: []}),
            files: productFiles,
          });
        }
        // Nothing is transmitted: the report is stored with `destinations`, so
        // neither branch may claim it was sent. Enforced by the test.
        showSuccessAlert(
          'Report saved',
          target === 'manufacturer'
            ? 'Saved for the manufacturer. Forwarding is not switched on yet, so tell your vet too.'
            : 'Saved to your vet practice, with the product and batch details attached.',
        );
        resetDraft();
        handleBack();
      } catch (error: any) {
        const message =
          error?.message ?? 'Failed to submit adverse event report.';
        showErrorAlert('Unable to submit', message);
      } finally {
        setSubmitLoading(null);
      }
    });
  };

  const handleSendToManufacturer = () => handleSubmitReport('manufacturer');
  const handleSendToHospital = () => handleSubmitReport('hospital');

  const handleCallAuthority = async () => {
    await requireContactConsent(async () => {
      try {
        setRegulatoryLoading(true);
        const {country, iso2, iso3, authorityName} = resolveCountryMeta();
        if (!country || !iso2) {
          throw new Error(
            'Regulatory authority dialing is available only in supported countries. Please update your profile country to a supported region.',
          );
        }
        const data = await adverseEventService.fetchRegulatoryAuthority({
          country,
          iso2,
          iso3,
        });
        setRegulatoryContact({
          ...data,
          authorityName: data?.authorityName ?? authorityName,
        });
        const phone = data?.phone ?? null;
        if (phone) {
          const normalizedPhone = (phone as string).replaceAll(/[^\d+]/g, '');
          const telUrl = `tel:${normalizedPhone}`;
          const opened = await Linking.openURL(telUrl).catch(() => false);
          if (!opened) {
            showErrorAlert(
              'Dialer unavailable',
              `Please call this number manually: ${normalizedPhone}`,
            );
          }
        } else {
          showErrorAlert(
            'Contact unavailable',
            'No phone number available for the regulatory authority.',
          );
        }
      } catch (error: any) {
        const message =
          error?.message ?? 'Failed to fetch regulatory authority contact.';
        showErrorAlert('Unable to call authority', message);
      } finally {
        setRegulatoryLoading(false);
      }
    });
  };

  return (
    <SafeArea>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <ThankYouHero styles={styles} theme={theme} />

        <View style={styles.checkboxSection}>
          <Checkbox
            value={agreeToBeContacted}
            onValueChange={value => {
              setAgreeToBeContacted(value);
              setConsentToContact(value);
              if (value && contactError) {
                setContactError('');
              }
            }}
            label="I agree to be contacted by Drug Manufacturer, Hospital, or Regulatory Authority if needed."
            labelStyle={styles.checkboxLabel}
          />
          {contactError ? (
            <Text style={styles.errorText}>{contactError}</Text>
          ) : null}
        </View>

        <View style={styles.actionsContainer}>
          <SubmitReportButton
            styles={styles}
            label="Send report to drug manufacturer"
            buttonStyle={styles.primaryButton}
            textStyle={styles.primaryButtonText}
            iconName="flask-outline"
            contentColor={theme.colors.ctaText}
            isBusy={submitLoading === 'manufacturer'}
            isDimmed={submitLoading === 'hospital'}
            disabled={submitLoading !== null}
            onPress={handleSendToManufacturer}
          />

          <SubmitReportButton
            styles={styles}
            label="Send report to hospital"
            buttonStyle={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
            iconName="business-outline"
            contentColor={theme.colors.inkBody}
            isBusy={submitLoading === 'hospital'}
            isDimmed={submitLoading === 'manufacturer'}
            disabled={submitLoading !== null}
            onPress={handleSendToHospital}
          />

          <RegulatoryAuthoritySection
            styles={styles}
            theme={theme}
            loading={regulatoryLoading}
            contact={regulatoryContact}
            onCall={handleCallAuthority}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PressableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          testID="back-to-home"
          style={styles.backHomeButton}
          onPress={handleBack}>
          <Text style={styles.backHomeText}>Back to home</Text>
        </PressableOpacity>
      </View>
    </SafeArea>
  );
};

interface ThankYouHeroProps {
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}

const ThankYouHero: React.FC<ThankYouHeroProps> = ({styles, theme}) => (
  <View style={styles.hero}>
    <View style={styles.medallion}>
      <Ionicons name="heart" size={46} color={theme.colors.pink} />
    </View>

    <Text style={styles.title}>Thank you for reaching out to us</Text>
    <Text style={styles.subtitle}>
      By submitting a report, you agree to be contacted by the company if needed
      to obtain further details regarding your report.
    </Text>
  </View>
);

interface SubmitReportButtonProps {
  styles: ReturnType<typeof createStyles>;
  label: string;
  buttonStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  iconName: string;
  contentColor: string;
  isBusy: boolean;
  isDimmed: boolean;
  disabled: boolean;
  onPress: () => void;
}

const SubmitReportButton: React.FC<SubmitReportButtonProps> = ({
  styles,
  label,
  buttonStyle,
  textStyle,
  iconName,
  contentColor,
  isBusy,
  isDimmed,
  disabled,
  onPress,
}) => (
  <PressableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{disabled, busy: isBusy}}
    testID={`btn-${label}`}
    style={[buttonStyle, isDimmed && styles.buttonDisabled]}
    onPress={onPress}
    disabled={disabled}>
    {isBusy ? (
      <ActivityIndicator color={contentColor} />
    ) : (
      <>
        <Ionicons name={iconName} size={18} color={contentColor} />
        <Text style={textStyle}>{label}</Text>
      </>
    )}
  </PressableOpacity>
);

interface RegulatoryAuthoritySectionProps {
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  loading: boolean;
  contact: RegulatoryContact | null;
  onCall: () => void;
}

const RegulatoryAuthoritySection: React.FC<RegulatoryAuthoritySectionProps> = ({
  styles,
  theme,
  loading,
  contact,
  onCall,
}) => (
  <>
    <PressableOpacity
      style={styles.callAuthorityAction}
      onPress={loading ? undefined : onCall}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Call regulatory authority"
      accessibilityState={{disabled: loading}}>
      <Ionicons name="call-outline" size={17} color={theme.colors.blueText} />
      <Text style={styles.callAuthorityText}>
        {loading
          ? 'Fetching authority contact...'
          : 'Call regulatory authority'}
      </Text>
    </PressableOpacity>

    {contact?.authorityName ? (
      <View style={styles.authorityDetails}>
        <Text style={styles.authorityName}>{contact.authorityName}</Text>
        {contact.phone ? (
          <Text style={styles.authorityMeta}>Phone: {contact.phone}</Text>
        ) : null}
        {contact.email ? (
          <Text style={styles.authorityMeta}>Email: {contact.email}</Text>
        ) : null}
        {contact.website ? (
          <Text style={styles.authorityMeta}>Website: {contact.website}</Text>
        ) : null}
      </View>
    ) : null}
  </>
);

const createStyles = (theme: any) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['10'],
      paddingBottom: theme.spacing['6'],
    },
    // Emotional payoff: pink heart medallion mirrors the payment-success check.
    hero: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing['3'],
      marginBottom: theme.spacing['7'],
    },
    medallion: {
      width: 100,
      height: 100,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.pinkGlow,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing['5'],
      ...theme.shadows.companion,
    },
    title: {
      // Warm-bone hero title: Newsreader serif, thank-you headline.
      ...theme.typography.serifTitle,
      fontSize: 29,
      lineHeight: 34,
      color: theme.colors.ink,
      textAlign: 'center',
      marginBottom: theme.spacing['3'],
    },
    subtitle: {
      ...theme.typography.subtitleRegular14,
      fontSize: 14.5,
      lineHeight: 23,
      color: theme.colors.inkMuted,
      textAlign: 'center',
    },
    checkboxSection: {
      marginBottom: theme.spacing['6'],
    },
    checkboxLabel: {
      ...theme.typography.subtitleRegular14,
      fontSize: 13.5,
      lineHeight: 20,
      color: theme.colors.inkMuted,
    },
    errorText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.dangerText,
      marginTop: theme.spacing['2'],
      marginLeft: theme.spacing['7'],
    },
    actionsContainer: {
      gap: theme.spacing['2.5'],
    },
    // Primary send action: solid charcoal CTA fill with a leading flask icon.
    primaryButton: {
      width: '100%',
      height: 54,
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      ...theme.shadows.cta,
    },
    primaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.ctaText,
      textAlign: 'center',
    },
    // Secondary send action: outlined button with a leading business icon.
    secondaryButton: {
      width: '100%',
      height: 54,
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.transparent,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
    },
    secondaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.inkBody,
      textAlign: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    callAuthorityAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      paddingVertical: theme.spacing['3'],
      marginTop: theme.spacing['1'],
    },
    callAuthorityText: {
      ...theme.typography.subtitleBold14,
      fontSize: 15,
      color: theme.colors.blueText,
    },
    authorityDetails: {
      marginTop: theme.spacing['1'],
      alignItems: 'center',
      gap: theme.spacing['1'],
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.cardSmall,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      padding: theme.spacing['4'],
    },
    authorityName: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.ink,
    },
    authorityMeta: {
      ...theme.typography.body13,
      color: theme.colors.inkMuted,
    },
    footer: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['2'],
      paddingBottom: theme.spacing['6'],
    },
    backHomeButton: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backHomeText: {
      ...theme.typography.subtitleBold14,
      fontSize: 15,
      color: theme.colors.blueText,
    },
  });
