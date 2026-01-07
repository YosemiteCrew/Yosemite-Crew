import React, {useState, useMemo, useEffect} from 'react';
import {View, StyleSheet, Image, TouchableOpacity, Text} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTheme} from '@/hooks';
import {useDispatch, useSelector} from 'react-redux';
import {Images} from '@/assets/images';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import type {RootState} from '@/app/store';
import type {AdverseEventStackParamList} from '@/navigation/types';
import {setSelectedCompanion} from '@/features/companion';
import {useAdverseEventReport} from '@/features/adverseEventReporting/state/AdverseEventReportContext';
import type {ReporterType} from '@/features/adverseEventReporting/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step1'>;

export const Step1Screen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch();
  const {draft, updateDraft, setReporterType: setReporterTypeInDraft} = useAdverseEventReport();
  const companions = useSelector((state: RootState) => state.companion.companions);
  const globalSelectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);

  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(draft.companionId ?? null);
  const [reporterType, setReporterType] = useState<ReporterType>(draft.reporterType);
  const [agreeToTerms, setAgreeToTerms] = useState(draft.agreeToTerms);
  const [termsError, setTermsError] = useState('');

  // Set the globally selected companion as default when component mounts
  useEffect(() => {
    if (!selectedCompanionId) {
      const fallbackCompanionId = draft.companionId ?? globalSelectedCompanionId;
      if (fallbackCompanionId) {
        setSelectedCompanionId(fallbackCompanionId);
        updateDraft({companionId: fallbackCompanionId});
        dispatch(setSelectedCompanion(fallbackCompanionId));
      }
    }
  }, [dispatch, draft.companionId, globalSelectedCompanionId, selectedCompanionId, updateDraft]);

  const handleNext = () => {
    if (!selectedCompanionId) {
      return;
    }

    if (!agreeToTerms) {
      setTermsError('Accept the terms to continue');
      return;
    }
    updateDraft({
      companionId: selectedCompanionId,
      reporterType,
      agreeToTerms,
    });
    navigation.navigate('Step2');
  };

  const isCompanionSelected = !!selectedCompanionId;
  const navigateToLegal = (target: 'TermsAndConditions' | 'PrivacyPolicy') => {
    const parentNav = navigation.getParent?.();
    parentNav?.navigate(target as any);
  };
  const handleToggleTerms = () => {
    setAgreeToTerms(prev => {
      const nextValue = !prev;
      updateDraft({agreeToTerms: nextValue});
      if (nextValue && termsError) {
        setTermsError('');
      }
      return nextValue;
    });
  };
  const handleReporterTypeSelect = (type: ReporterType) => {
    setReporterType(type);
    setReporterTypeInDraft(type);
  };
  const handleCompanionSelect = (id: string | null) => {
    setSelectedCompanionId(id);
    updateDraft({companionId: id});
    if (id) {
      dispatch(setSelectedCompanion(id));
    }
  };

  return (
    <AERLayout
      stepLabel="Step 1 of 5"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Next', onPress: handleNext, disabled: !isCompanionSelected }}
    >
      <Image source={Images.adverse2} style={styles.heroImage} />

      <Text style={styles.title}>Veterinary product adverse events</Text>
      <Text style={styles.subtitle}>Notify the manufacturer about any issues or concerns you experienced with a pharmaceutical product used for your pet.</Text>

      <Text style={styles.descriptionText}>To report a potential side effect, unexpected reaction, or any other concern following the use of a YosemiteCrew Animal Health product, please fill out the following form as completely and accurately as possible.</Text>

      <View style={styles.companionSelector}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={handleCompanionSelect}
          showAddButton={false}
          requiredPermission="emergencyBasedPermissions"
          permissionLabel="emergency actions"
        />
      </View>

      <View style={styles.radioSection}>
        <Text style={styles.sectionTitle}>Who is reporting the concern?</Text>

        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => handleReporterTypeSelect('parent')}
        >
          <View style={styles.radioOuter}>
            {reporterType === 'parent' && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.radioLabel}>The parent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => handleReporterTypeSelect('guardian')}
        >
          <View style={styles.radioOuter}>
            {reporterType === 'guardian' && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.radioLabel}>The guardian (Co-Parent)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.checkboxSection}>
        <Text style={styles.beforeProceed}>Before you proceed</Text>
        <TouchableOpacity
          style={styles.consentRow}
          activeOpacity={0.9}
          onPress={handleToggleTerms}
          accessibilityRole="checkbox"
          accessibilityState={{checked: agreeToTerms}}
        >
          <Checkbox
            value={agreeToTerms}
            onValueChange={() => {
              handleToggleTerms();
            }}
          />
          <Text style={styles.consentText}>
            I agree to Yosemite Crew’s{' '}
            <Text
              style={styles.consentLink}
              onPress={() => navigateToLegal('TermsAndConditions')}>
              terms and conditions
            </Text>{' '}
            and{' '}
            <Text
              style={styles.consentLink}
              onPress={() => navigateToLegal('PrivacyPolicy')}>
              privacy policy
            </Text>
          </Text>
        </TouchableOpacity>
        {termsError ? <Text style={styles.errorText}>{termsError}</Text> : null}
      </View>
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    heroImage: {
      width: '100%',
      height: 200,
      resizeMode: 'contain',
      marginBottom: theme.spacing['6'],
    },
    title: {
      ...theme.typography.h4Alt,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['2'],
      textAlign: 'center',
            paddingHorizontal: theme.spacing['16'],
    },
    subtitle: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.placeholder,
      marginBottom: theme.spacing['6'],
      textAlign: 'center',
      paddingHorizontal: theme.spacing['6'],
    },
    descriptionText: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      marginBottom: theme.spacing['6'],

    },
    companionSelector: {
      marginBottom: theme.spacing['6'],
    },
    radioSection: {
      marginBottom: theme.spacing['6'],
    },
    sectionTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['3'],
    },
    radioOption: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing['4'],
    },
    radioOuter: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.borderMuted,
      marginRight: theme.spacing['3'],
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioInner: {
      width: theme.spacing['2.5'],
      height: theme.spacing['2.5'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primary,
    },
    radioLabel: {
      ...theme.typography.body,
      color: theme.colors.secondary,

    },
    checkboxSection: {
      marginBottom: theme.spacing['6'],
      gap: theme.spacing['2'],
      // Ensure long consent text doesn't touch screen edge
      paddingRight: theme.spacing['8'],
    },
    beforeProceed: {
      // Satoshi 15 bold, 120%, -0.3 letter spacing
      ...theme.typography.pillSubtitleBold15,
      lineHeight: 18,
      color: theme.colors.secondary,
        marginBottom: theme.spacing['2'],
    },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      // Keep checkbox and text on the same row; allow text to wrap
      flexWrap: 'nowrap',
      width: '100%',
    },
    consentText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      marginLeft: 8,
      flex: 1,
      // Add comfortable space from the right screen edge
      paddingRight: theme.spacing['6'],
    },
    consentLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textTertiary,
      textDecorationLine: 'underline',
    },
    errorText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.error,
      marginLeft: theme.spacing['1'],
    },
  });
