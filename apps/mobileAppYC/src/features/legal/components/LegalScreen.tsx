import React from 'react';
import {ScrollView, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ScreenLayout} from '@/shared/components/common/ScreenLayout/ScreenLayout';
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
    <ScreenLayout
      title={title}
      showBackButton
      onBack={() => navigation.goBack()}
      edges={[]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <LegalContentRenderer sections={sections} />
        {extraContent}
      </ScrollView>
    </ScreenLayout>
  );
};
