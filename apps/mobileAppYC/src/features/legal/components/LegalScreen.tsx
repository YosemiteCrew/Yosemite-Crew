import React from 'react';
import {ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Header} from '@/shared/components/common';
import {useTheme} from '@/hooks';
import {LegalContentRenderer} from './LegalContentRenderer';
import {createLegalStyles} from '../styles/legalStyles';
import type {HomeStackParamList} from '@/navigation/types';

type LegalScreenProps = NativeStackScreenProps<HomeStackParamList, 'PrivacyPolicy' | 'TermsAndConditions'> & {
  title: string;
  sections: any[];
  extraContent?: React.ReactNode;
};

export const LegalScreen: React.FC<LegalScreenProps> = ({
  navigation,
  title,
  sections,
  extraContent,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createLegalStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={title}
        showBackButton
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <LegalContentRenderer sections={sections} />
        {extraContent}
      </ScrollView>
    </SafeAreaView>
  );
};
