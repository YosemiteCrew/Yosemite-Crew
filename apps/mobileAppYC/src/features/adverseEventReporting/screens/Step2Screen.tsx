import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import { SafeArea } from '@/shared/components/common';
import { Header } from '@/shared/components/common/Header/Header';
import { LiquidGlassCard } from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import { Images } from '@/assets/images';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step2'>;

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing[3] }}>
      <Text style={{ ...theme.typography.labelSmall, color: theme.colors.textSecondary }}>
        {label}
      </Text>
      <Text style={{ ...theme.typography.body, color: theme.colors.secondary }}>
        {value || '—'}
      </Text>
    </View>
  );
};

export const Step2Screen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const authUser = useSelector((state: RootState) => state.auth.user);

  const handleEdit = () => {
    navigation.getParent<any>()?.navigate('HomeStack', {
      screen: 'EditParentOverview',
      params: { companionId: 'parent' },
    });
  };

  return (
    <SafeArea>
      <Header
        title="Adverse event reporting"
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Step 2 of 5</Text>

        <LiquidGlassCard
          glassEffect="clear"
          interactive
          style={styles.infoCard}
          fallbackStyle={styles.infoCardFallback}
        >
          <View style={styles.cardContent}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>Parent Information</Text>
              <TouchableOpacity onPress={handleEdit}>
                <Image source={Images.blackEdit} style={styles.editIcon} />
              </TouchableOpacity>
            </View>

            <InfoRow label="First name" value={authUser?.firstName ?? ''} />
            <InfoRow label="Last name" value={authUser?.lastName ?? ''} />
            <InfoRow label="Phone number" value={authUser?.phone ?? ''} />
            <InfoRow label="Email address" value={authUser?.email ?? ''} />
            <InfoRow label="Currency" value={authUser?.currency ?? 'USD'} />
            <InfoRow
              label="Date of birth"
              value={
                authUser?.dateOfBirth
                  ? new Date(authUser.dateOfBirth).toLocaleDateString()
                  : ''
              }
            />
            <InfoRow label="Address" value={authUser?.address?.addressLine ?? ''} />
            <InfoRow label="City" value={authUser?.address?.city ?? ''} />
            <InfoRow label="State/Province" value={authUser?.address?.stateProvince ?? ''} />
            <InfoRow label="Postal code" value={authUser?.address?.postalCode ?? ''} />
            <InfoRow label="Country" value={authUser?.address?.country ?? ''} />
          </View>
        </LiquidGlassCard>

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Next"
            onPress={() => navigation.navigate('Step3')}
            glassEffect="clear"
            interactive
            borderRadius="lg"
            forceBorder
            borderColor={theme.colors.borderMuted}
            height={56}
            style={styles.button}
            textStyle={styles.buttonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
          />
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[24],
    },
    stepTitle: {
      ...theme.typography.labelMdBold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[4],
    },
    infoCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      marginBottom: theme.spacing[6],
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    infoCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
    },
    cardContent: {
      padding: theme.spacing[4],
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing[4],
    },
    cardTitle: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
    },
    editIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
    },
    buttonContainer: {
      marginTop: theme.spacing[4],
    },
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraphBold,
    },
  });
