import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import { LiquidGlassCard } from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import { Separator, RowButton } from '@/shared/components/common/FormRowComponents';
import { Images } from '@/assets/images';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step2'>;

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
    <AERLayout
      stepLabel="Step 2 of 5"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Next', onPress: () => navigation.navigate('Step3') }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Parent Information</Text>
        <TouchableOpacity onPress={handleEdit}>
          <Image source={Images.blackEdit} style={styles.editIcon} />
        </TouchableOpacity>
      </View>

      <LiquidGlassCard
        glassEffect="clear"
        interactive
        style={styles.infoCard}
        fallbackStyle={styles.infoCardFallback}
      >
        <View style={styles.cardContent}>
          <RowButton
            label="First name"
            value={authUser?.firstName ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Last name"
            value={authUser?.lastName ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Phone number"
            value={authUser?.phone ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Email address"
            value={authUser?.email ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Currency"
            value={authUser?.currency ?? 'USD'}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Date of birth"
            value={
              authUser?.dateOfBirth
                ? new Date(authUser.dateOfBirth).toLocaleDateString()
                : ''
            }
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Address"
            value={authUser?.address?.addressLine ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="City"
            value={authUser?.address?.city ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="State/Province"
            value={authUser?.address?.stateProvince ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Postal code"
            value={authUser?.address?.postalCode ?? ''}
            onPress={handleEdit}
          />
          <Separator />

          <RowButton
            label="Country"
            value={authUser?.address?.country ?? ''}
            onPress={handleEdit}
          />
        </View>
      </LiquidGlassCard>
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing[4],
    },
    sectionTitle: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      marginHorizontal: theme.spacing[2],
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
      paddingVertical: 0,
    },
    editIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
         marginHorizontal: theme.spacing[2],
    },
  });
