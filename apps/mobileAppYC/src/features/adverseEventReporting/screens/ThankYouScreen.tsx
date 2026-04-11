import React, {useMemo, useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import type {AdverseEventStackParamList} from '@/navigation/types';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {useAdverseEventReport} from '@/features/adverseEventReporting/state/AdverseEventReportContext';
import {adverseEventService} from '@/features/adverseEventReporting/services/adverseEventService';
import {showErrorAlert, showSuccessAlert} from '@/shared/utils/commonHelpers';
import {SUPPORTED_ADVERSE_EVENT_COUNTRIES} from '@/features/adverseEventReporting/content/supportedCountries';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'ThankYou'>;

export const ThankYouScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {draft, setConsentToContact, setProductInfo, resetDraft} = useAdverseEventReport();
  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);
  const linkedBusinesses = useSelector((state: RootState) => state.linkedBusinesses.linkedBusinesses);
  const authUser = useSelector((state: RootState) => state.auth.user);

  const [agreeToBeContacted, setAgreeToBeContacted] = useState(draft.consentToContact);
  const [contactError, setContactError] = useState('');
  const [submitLoading, setSubmitLoading] = useState<'manufacturer' | 'hospital' | null>(null);
  const [regulatoryLoading, setRegulatoryLoading] = useState(false);
  const [regulatoryContact, setRegulatoryContact] = useState<{
    authorityName?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null>(null);

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
    navigation.navigate('Home' as never);
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
        if (!authUser || !resolvedCompanion || !draft.productInfo || !resolvedOrganisationId) {
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
        });

        if (productFiles?.length) {
          setProductInfo({
            ...(draft.productInfo ?? {files: []}),
            files: productFiles,
          });
        }
        showSuccessAlert(
          'Report submitted',
          target === 'manufacturer'
            ? 'We sent your report to the manufacturer.'
            : 'We sent your report to the hospital.',
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
            showErrorAlert('Dialer unavailable', `Please call this number manually: ${normalizedPhone}`);
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
      <Header
        title="Adverse event reporting"
        showBackButton
        onBack={handleBack}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image source={Images.adverse3} style={styles.heroImage} />

        <Text style={styles.title}>Thank you for reaching out to us</Text>
        <Text style={styles.subtitle}>
          By submitting a report, you agree to be contacted by the company if needed to obtain
          further details regarding your report.
        </Text>

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
          {contactError ? <Text style={styles.errorText}>{contactError}</Text> : null}
        </View>

        <View style={styles.actionsContainer}>
          <LiquidGlassButton
            title="Send report to drug manufacturer"
            onPress={handleSendToManufacturer}
            glassEffect="clear"
          interactive
          borderRadius="lg"
          forceBorder
          borderColor={theme.colors.borderMuted}
          height={theme.spacing['14']}
          style={styles.button}
          textStyle={styles.buttonText}
          tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            loading={submitLoading === 'manufacturer'}
            disabled={submitLoading !== null}
          />

          <LiquidGlassButton
            title="Send report to hospital"
            onPress={handleSendToHospital}
            glassEffect="clear"
          interactive
          borderRadius="lg"
          forceBorder
          borderColor={theme.colors.borderMuted}
          height={theme.spacing['14']}
          style={[styles.button, styles.lightButton]}
          textStyle={styles.lightButtonText}
          tintColor={theme.colors.white}
            shadowIntensity="light"
            loading={submitLoading === 'hospital'}
            disabled={submitLoading !== null}
          />

          <TouchableOpacity
            style={styles.phoneAction}
            onPress={regulatoryLoading ? undefined : handleCallAuthority}
            disabled={regulatoryLoading}
          >
            <Image source={Images.phone} style={styles.phoneIcon} />
            <Text style={styles.phoneText}>
              {regulatoryLoading ? 'Fetching authority contact...' : 'Call regulatory authority'}
            </Text>
          </TouchableOpacity>

          {regulatoryContact?.authorityName ? (
            <View style={styles.authorityDetails}>
              <Text style={styles.authorityName}>{regulatoryContact.authorityName}</Text>
              {regulatoryContact.phone ? (
                <Text style={styles.authorityMeta}>Phone: {regulatoryContact.phone}</Text>
              ) : null}
              {regulatoryContact.email ? (
                <Text style={styles.authorityMeta}>Email: {regulatoryContact.email}</Text>
              ) : null}
              {regulatoryContact.website ? (
                <Text style={styles.authorityMeta}>Website: {regulatoryContact.website}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['24'],
    },
    heroImage: {
      width: theme.spacing['56'],
      height: theme.spacing['56'],
      resizeMode: 'contain',
      alignSelf: 'center',
      marginBottom: theme.spacing['2'],
    },
    title: {
      // Clash Grotesk 20/24, 500, -0.2
      ...theme.typography.businessSectionTitle20,
      color: theme.colors.text,
      marginBottom: theme.spacing['3'],
      alignSelf: 'center',
    },
    subtitle: {
      // Satoshi 15 Bold, 120%
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing['6'],
    },
    checkboxSection: {
      // Increased space before buttons group
      marginBottom: theme.spacing['8'],
    },
    checkboxLabel: {
      // Satoshi 15 Bold, 120%
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.text,
    },
    errorText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.error,
      marginTop: theme.spacing['2'],
      marginLeft: theme.spacing['1'],
    },
    actionsContainer: {
      // Slightly larger gap between buttons
      gap: theme.spacing['5'],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.lg,
    },
    buttonText: {
      // CTA Clash Grotesk 18/18, 500, -0.18, white
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
    },
    lightButton: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderMuted,
    },
    lightButtonText: {
      // CTA Clash Grotesk 18/18, 500, -0.18, Jet-500
      ...theme.typography.button,
      color: theme.colors.text,
      textAlign: 'center',
    },
    phoneAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing['8'],
      gap: theme.spacing['3'],
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderMuted,
      marginTop: theme.spacing['2'],
    },
    phoneIcon: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      resizeMode: 'contain',
    },
    phoneText: {
      // CTA Clash Grotesk 18/18, 500, -0.18, Jet-500
      ...theme.typography.button,
      color: theme.colors.text,
      textAlign: 'center',
    },
    authorityDetails: {
      marginTop: theme.spacing['2'],
      alignItems: 'center',
      gap: theme.spacing['1'],
    },
    authorityName: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.secondary,
    },
    authorityMeta: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
  });
