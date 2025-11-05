import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import { SafeArea } from '@/shared/components/common';
import { Header } from '@/shared/components/common/Header/Header';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import { LinkedBusinessCard } from '@/features/linkedBusinesses/components/LinkedBusinessCard';
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
              disabled={false}
            >
              <View
                style={[
                  styles.businessCardWrapper,
                  selectedBusinessId === item.id && styles.businessCardWrapperSelected,
                ]}
              >
                <LinkedBusinessCard
                  business={item}
                  onPress={() => setSelectedBusinessId(item.id)}
                />
              </View>
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
      textAlign: 'center',
    },
    title: {
      ...theme.typography.labelMdBold,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[4],
    },
    listContent: {
      marginBottom: theme.spacing[6],
    },
    businessCardWrapper: {
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
    },
    businessCardWrapperSelected: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
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
