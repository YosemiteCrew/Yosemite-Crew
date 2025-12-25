import React from 'react';
import {ScrollView, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Header} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
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
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <View
        style={styles.topSection}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <View style={styles.topGlassShadowWrapper}>
          <LiquidGlassCard
            glassEffect="clear"
            interactive={false}
            shadow="none"
            style={[styles.topGlassCard, {paddingTop: insets.top}]}
            fallbackStyle={styles.topGlassFallback}>
            <Header
              title={title}
              showBackButton
              onBack={() => navigation.goBack()}
              glass={false}
            />
          </LiquidGlassCard>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          topGlassHeight
            ? {paddingTop: topGlassHeight + theme.spacing['3']}
            : null,
        ]}
        showsVerticalScrollIndicator={false}>
        <LegalContentRenderer sections={sections} />
        {extraContent}
      </ScrollView>
    </SafeAreaView>
  );
};
