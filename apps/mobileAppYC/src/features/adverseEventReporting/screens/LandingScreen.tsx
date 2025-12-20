import React, { useMemo } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { Images } from '@/assets/images';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import LegalContentRenderer from '@/features/legal/components/LegalContentRenderer';
import {generalInfoSections} from '@/features/adverseEventReporting/content/generalInfoSections';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Landing'>;

// Content moved to dedicated content module to avoid duplication

export const LandingScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleStartReporting = () => {
    navigation.navigate('Step1');
  };

  return (
    <AERLayout
      stepLabel="General information"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Start', onPress: handleStartReporting }}
    >
      <Image source={Images.adverse1} style={styles.heroImage} />
      <View style={styles.contentWrapper}>
        <LegalContentRenderer sections={generalInfoSections} />
      </View>
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    heroImage: {
      width: '100%',
      height: 250,
      resizeMode: 'contain',
      marginTop: -theme.spacing['6'],
    },
    contentWrapper: {
      marginBottom: theme.spacing['6'],
    },
  });
