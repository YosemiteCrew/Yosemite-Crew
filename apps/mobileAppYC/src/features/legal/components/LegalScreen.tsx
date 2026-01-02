import React from 'react';
import {ScrollView, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {LegalContentRenderer} from './LegalContentRenderer';
import {createLegalStyles} from '../styles/legalStyles';
import type {HomeStackParamList} from '@/navigation/types';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';

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
  const baseStyles = React.useMemo(() => createLegalStyles(theme), [theme]);
  const headerStyles = React.useMemo(() => createLiquidGlassHeaderStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  return (
    <SafeAreaView style={baseStyles.safeArea} edges={[]}>
      <View
        style={headerStyles.topSection}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <View style={headerStyles.topGlassShadowWrapper}>
          <LiquidGlassCard
            glassEffect="clear"
            interactive={false}
            shadow="none"
            style={[headerStyles.topGlassCard, {paddingTop: insets.top}]}
            fallbackStyle={headerStyles.topGlassFallback}>
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
        style={baseStyles.container}
        contentContainerStyle={[
          baseStyles.contentContainer,
          topGlassHeight ? {paddingTop: topGlassHeight + theme.spacing['3']} : null,
        ]}
        showsVerticalScrollIndicator={false}>
        <LegalContentRenderer sections={sections} />
        {extraContent}
      </ScrollView>
    </SafeAreaView>
  );
};
