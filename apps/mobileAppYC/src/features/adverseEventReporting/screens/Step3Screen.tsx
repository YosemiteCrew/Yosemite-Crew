import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import { SafeArea } from '@/shared/components/common';
import { Header } from '@/shared/components/common/Header/Header';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import { LiquidGlassCard } from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Step3'>;

export const Step3Screen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const linkedBusinesses = useSelector(
    (state: RootState) => state.linkedBusinesses.linkedBusinesses
  );

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  const handleNext = () => {
    if (selectedBusinessId) {
      navigation.navigate('Step4');
    }
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
        <Text style={styles.stepTitle}>Step 3 of 5</Text>
        <Text style={styles.title}>Select Linked Hospital</Text>

        <FlatList
          data={linkedBusinesses}
          scrollEnabled={false}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedBusinessId(item.id)}
              activeOpacity={0.85}
            >
              <LiquidGlassCard
                glassEffect="clear"
                interactive
                style={[
                  styles.businessCard,
                  selectedBusinessId === item.id && styles.businessCardSelected,
                ]}
                fallbackStyle={styles.businessCardFallback}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.businessName}>{item.businessName}</Text>
                  <Text style={styles.businessAddress}>
                    {item.address || 'Address not available'}
                  </Text>
                  {selectedBusinessId === item.id && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </View>
              </LiquidGlassCard>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />

        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Next"
            onPress={handleNext}
            disabled={!selectedBusinessId}
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
    title: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[4],
    },
    listContent: {
      marginBottom: theme.spacing[6],
    },
    businessCard: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      marginBottom: theme.spacing[4],
      minHeight: 100,
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    businessCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
    },
    businessCardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    cardContent: {
      padding: theme.spacing[4],
    },
    businessName: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
    },
    businessAddress: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.textSecondary,
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      top: theme.spacing[3],
      right: theme.spacing[3],
    },
    checkmarkText: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: 'bold',
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
