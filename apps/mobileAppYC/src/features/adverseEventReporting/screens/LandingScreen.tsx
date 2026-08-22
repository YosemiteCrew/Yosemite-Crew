import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '@/hooks';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import type {AdverseEventStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Landing'>;

// Brief-sanctioned destructive red for the safety callout (0.07 bg / 0.18 border).
const DANGER_CALLOUT_BG = 'rgba(234,55,41,0.07)';
const DANGER_CALLOUT_BORDER = 'rgba(234,55,41,0.18)';

const REPORT_STEPS = [
  'Who to notify',
  'Parent information',
  'Which companion',
  'Companion information',
  'The product and what happened',
];

export const LandingScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleStartReporting = () => {
    navigation.navigate('Step1');
  };

  return (
    <AERLayout
      onBack={() => navigation.goBack()}
      bottomButton={{title: 'Start report', onPress: handleStartReporting}}>
      <View style={styles.intro}>
        <View style={styles.iconTile}>
          <Ionicons
            name="shield-half-outline"
            size={28}
            color={theme.colors.blueText}
          />
        </View>

        <Text style={styles.hero}>
          If a medicine or vaccine went wrong, report it.
        </Text>

        <Text style={styles.body}>
          Your report reaches the people who track drug safety: the
          manufacturer, your clinic, or the regulatory authority. It takes about
          five minutes.
        </Text>

        <View style={styles.stepsCard}>
          {REPORT_STEPS.map((label, index) => (
            <View key={label}>
              {index > 0 ? <View style={styles.stepDivider} /> : null}
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepLabel}>{label}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.dangerCallout}>
          <Ionicons
            name="alert-circle-outline"
            size={17}
            color={theme.colors.dangerText}
            style={styles.dangerIcon}
          />
          <Text style={styles.dangerText}>
            If your companion is in danger right now, call the vet first. This
            report can wait.
          </Text>
        </View>
      </View>
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    intro: {
      gap: theme.spacing['3.5'],
      marginTop: theme.spacing['4'],
    },
    iconTile: {
      width: 60,
      height: 60,
      borderRadius: theme.borderRadius.card,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: {
      ...theme.typography.serifTitleSmall,
      fontSize: 29,
      lineHeight: 33,
      color: theme.colors.ink,
    },
    body: {
      ...theme.typography.subtitleRegular14,
      fontSize: 15,
      lineHeight: 24,
      color: theme.colors.inkMuted,
    },
    stepsCard: {
      backgroundColor: theme.colors.screen,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      paddingHorizontal: theme.spacing['4'],
      ...theme.shadows.card,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['3.5'],
    },
    stepBadge: {
      width: 26,
      height: 26,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.navActive,
    },
    stepLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.inkBody,
    },
    stepDivider: {
      height: 1,
      backgroundColor: theme.colors.hairline,
    },
    dangerCallout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2.5'],
      backgroundColor: DANGER_CALLOUT_BG,
      borderWidth: 1,
      borderColor: DANGER_CALLOUT_BORDER,
      borderRadius: 14,
      padding: theme.spacing['3.5'],
    },
    dangerIcon: {
      marginTop: 1,
    },
    dangerText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19.5,
      color: theme.colors.inkBody,
    },
  });
