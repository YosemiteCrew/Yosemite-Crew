import React, {useState, useMemo, useEffect} from 'react';
import {View, StyleSheet, Image, Text} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
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

export const Step1Screen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch();
  const {
    draft,
    updateDraft,
    setReporterType: setReporterTypeInDraft,
  } = useAdverseEventReport();
  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
  const globalSelectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );

  const [selectedCompanionId, setSelectedCompanionId] = useState<string | null>(
    draft.companionId ?? globalSelectedCompanionId ?? null,
  );
  const [reporterType, setReporterType] = useState<ReporterType>(
    draft.reporterType,
  );
  const [agreeToTerms, setAgreeToTerms] = useState(draft.agreeToTerms);
  const [termsError, setTermsError] = useState('');

  const companionSyncedRef = React.useRef(false);
  useEffect(() => {
    if (!companionSyncedRef.current && selectedCompanionId) {
      companionSyncedRef.current = true;
      updateDraft({companionId: selectedCompanionId});
      dispatch(setSelectedCompanion(selectedCompanionId));
    }
  }, [dispatch, selectedCompanionId, updateDraft]);

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
      currentStep={1}
      totalSteps={5}
      onBack={() => navigation.goBack()}
      bottomButton={{
        title: 'Next',
        onPress: handleNext,
        disabled: !isCompanionSelected,
      }}>
      <Image source={Images.adverse2} style={styles.heroImage} />

      <Text style={styles.title}>Veterinary product adverse events</Text>
      <Text style={styles.subtitle}>
        Notify the manufacturer about any issues or concerns you experienced
        with a pharmaceutical product used for your pet.
      </Text>

      <Text style={styles.descriptionText}>
        To report a potential side effect, unexpected reaction, or any other
        concern following the use of a YosemiteCrew Animal Health product,
        please fill out the following form as completely and accurately as
        possible.
      </Text>

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

        <PressableOpacity
          style={[
            styles.optionCard,
            reporterType === 'parent' && styles.optionCardSelected,
          ]}
          activeOpacity={0.9}
          accessibilityRole="radio"
          accessibilityState={{selected: reporterType === 'parent'}}
          onPress={() => handleReporterTypeSelect('parent')}>
          <View style={[styles.optionIconTile, styles.optionIconTileParent]}>
            <Ionicons
              name="person-outline"
              size={22}
              color={theme.colors.blueText}
            />
          </View>
          <Text style={styles.optionLabel}>The parent</Text>
          <View
            style={[
              styles.radioOuter,
              reporterType === 'parent' && styles.radioOuterSelected,
            ]}>
            {reporterType === 'parent' ? (
              <Ionicons name="checkmark" size={15} color={theme.colors.white} />
            ) : null}
          </View>
        </PressableOpacity>

        <PressableOpacity
          style={[
            styles.optionCard,
            reporterType === 'guardian' && styles.optionCardSelected,
          ]}
          activeOpacity={0.9}
          accessibilityRole="radio"
          accessibilityState={{selected: reporterType === 'guardian'}}
          onPress={() => handleReporterTypeSelect('guardian')}>
          <View style={[styles.optionIconTile, styles.optionIconTileGuardian]}>
            <Ionicons
              name="people-outline"
              size={22}
              color={theme.colors.avatarVioletInk}
            />
          </View>
          <Text style={styles.optionLabel}>The guardian (Co-Parent)</Text>
          <View
            style={[
              styles.radioOuter,
              reporterType === 'guardian' && styles.radioOuterSelected,
            ]}>
            {reporterType === 'guardian' ? (
              <Ionicons name="checkmark" size={15} color={theme.colors.white} />
            ) : null}
          </View>
        </PressableOpacity>
      </View>

      <View style={styles.checkboxSection}>
        <Text style={styles.beforeProceed}>Before you proceed</Text>
        <PressableOpacity
          style={styles.consentRow}
          activeOpacity={0.9}
          onPress={handleToggleTerms}
          accessibilityRole="checkbox"
          accessibilityState={{checked: agreeToTerms}}>
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
        </PressableOpacity>
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
      marginBottom: theme.spacing['5'],
    },
    title: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
      marginBottom: theme.spacing['2'],
    },
    subtitle: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.inkMuted,
      marginBottom: theme.spacing['3'],
    },
    descriptionText: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.inkMuted,
      marginBottom: theme.spacing['6'],
    },
    companionSelector: {
      marginBottom: theme.spacing['6'],
    },
    radioSection: {
      marginBottom: theme.spacing['6'],
      gap: theme.spacing['3'],
    },
    sectionTitle: {
      ...theme.typography.pillSubtitleBold15,
      lineHeight: 18,
      color: theme.colors.ink,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['4'],
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      backgroundColor: theme.colors.screen2,
    },
    optionCardSelected: {
      borderWidth: 1.5,
      borderColor: theme.colors.blue,
      backgroundColor: theme.colors.screen,
      ...theme.shadows.card,
    },
    optionIconTile: {
      width: 46,
      height: 46,
      borderRadius: theme.borderRadius.field,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionIconTileParent: {
      backgroundColor: theme.colors.blueSoft,
    },
    optionIconTileGuardian: {
      backgroundColor: theme.colors.avatarVioletBg,
    },
    optionLabel: {
      ...theme.typography.pillSubtitleBold15,
      lineHeight: 20,
      color: theme.colors.ink,
      flex: 1,
    },
    radioOuter: {
      width: 24,
      height: 24,
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.divider,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.transparent,
    },
    radioOuterSelected: {
      borderColor: theme.colors.blue,
      backgroundColor: theme.colors.blue,
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
      color: theme.colors.ink,
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
      color: theme.colors.inkMuted,
      marginLeft: theme.spacing['2'],
      flex: 1,
      // Add comfortable space from the right screen edge
      paddingRight: theme.spacing['6'],
    },
    consentLink: {
      ...theme.typography.paragraphBold,
      color: theme.colors.blueText,
      textDecorationLine: 'underline',
    },
    errorText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.dangerText,
      marginLeft: theme.spacing['1'],
    },
  });
