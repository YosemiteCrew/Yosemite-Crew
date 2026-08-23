import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {useTheme} from '@/hooks';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {RowButton} from '@/shared/components/common/RowButton';
import {Separator} from '@/shared/components/common/Separator';
import type {AdverseEventStackParamList} from '@/navigation/types';
import {usePreferences} from '@/features/preferences/PreferencesContext';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step2'>;

export const Step2Screen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const authUser = useSelector((state: RootState) => state.auth.user);

  const handleEdit = () => {
    navigation.getParent<any>()?.navigate('HomeStack', {
      screen: 'EditParentOverview',
      params: {companionId: 'parent'},
    });
  };

  // The user's own currency, not an entity's. When the profile has none set,
  // defer to what PreferencesContext resolves rather than a hardcoded 'USD',
  // which disagreed with the Preferences screen for non-imperial accounts.
  const {currency: resolvedCurrency} = usePreferences();

  const rows = [
    {label: 'First name', value: authUser?.firstName ?? ''},
    {label: 'Last name', value: authUser?.lastName ?? ''},
    {label: 'Phone number', value: authUser?.phone ?? ''},
    {label: 'Email address', value: authUser?.email ?? ''},
    {label: 'Currency', value: authUser?.currency ?? resolvedCurrency},
    {
      label: 'Date of birth',
      value: authUser?.dateOfBirth
        ? new Date(authUser.dateOfBirth).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '',
    },
    {label: 'Address', value: authUser?.address?.addressLine ?? ''},
    {label: 'City', value: authUser?.address?.city ?? ''},
    {label: 'State/Province', value: authUser?.address?.stateProvince ?? ''},
    {label: 'Postal code', value: authUser?.address?.postalCode ?? ''},
    {label: 'Country', value: authUser?.address?.country ?? ''},
  ];

  return (
    <AERLayout
      stepLabel="Step 2 of 5"
      currentStep={2}
      totalSteps={5}
      onBack={() => navigation.goBack()}
      bottomButton={{
        title: 'Next',
        onPress: () => navigation.navigate('Step3'),
      }}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Who is reporting?</Text>
        <Text style={styles.subtitle}>
          Prefilled from your account. Check it is current, recipients may
          contact you about the event.
        </Text>
      </View>

      <LiquidGlassCard
        glassEffect="clear"
        interactive
        style={styles.infoCard}
        fallbackStyle={styles.infoCardFallback}>
        <View style={styles.cardContent}>
          {rows.map((row, idx) => (
            <View key={row.label}>
              <RowButton
                label={row.label}
                value={row.value}
                onPress={handleEdit}
              />
              {idx < rows.length - 1 ? <Separator /> : null}
            </View>
          ))}
        </View>
      </LiquidGlassCard>

      <View style={styles.helperBanner}>
        <Ionicons
          name="lock-closed-outline"
          size={16}
          color={theme.colors.navActive}
          style={styles.helperBannerIcon}
        />
        <Text style={styles.helperBannerText}>
          Shared only with the recipients you picked in step 1.
        </Text>
      </View>
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    titleBlock: {
      marginBottom: theme.spacing['5'],
    },
    title: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
      marginBottom: theme.spacing['1.25'],
    },
    subtitle: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.inkMuted,
    },
    infoCard: {
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      backgroundColor: theme.colors.screen,
      marginBottom: theme.spacing['5'],
      ...theme.shadows.card,
    },
    infoCardFallback: {
      borderRadius: theme.borderRadius.card,
      backgroundColor: theme.colors.screen,
    },
    cardContent: {
      paddingVertical: 0,
    },
    helperBanner: {
      flexDirection: 'row',
      gap: theme.spacing['2'],
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3.5'],
      backgroundColor: theme.colors.blueSoft,
      borderRadius: theme.borderRadius.field,
    },
    helperBannerIcon: {
      marginTop: 1,
    },
    helperBannerText: {
      ...theme.typography.body13,
      flex: 1,
      color: theme.colors.navActive,
    },
  });
