import React from 'react';
import {ScrollView, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {LegalContentRenderer} from './LegalContentRenderer';
import {createLegalStyles} from '../styles/legalStyles';
import {exportLegalDocument} from '../services/legalExportService';
import type {LegalSection, LegalDocumentMeta} from '../data/legalContentTypes';
import type {LegalStackParamList} from '@/navigation/types';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';

type LegalScreenProps = NativeStackScreenProps<
  LegalStackParamList,
  'PrivacyPolicy' | 'TermsAndConditions'
> & {
  title: string;
  sections: LegalSection[];
  extraContent?: React.ReactNode;
  meta?: LegalDocumentMeta;
  /** Optional on-page jump chips (Privacy reader). Styling only. */
  navChips?: string[];
};

export const LegalScreen: React.FC<LegalScreenProps> = ({
  navigation,
  title,
  sections,
  extraContent,
  meta,
  navChips,
}) => {
  const {theme} = useTheme();
  const baseStyles = React.useMemo(() => createLegalStyles(theme), [theme]);
  const headerStyles = React.useMemo(
    () => createLiquidGlassHeaderStyles(theme),
    [theme],
  );
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);
  const [activeChip, setActiveChip] = React.useState(0);

  const handleDownload = React.useCallback(() => {
    exportLegalDocument(title, sections, meta);
  }, [meta, sections, title]);

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
          topGlassHeight
            ? {paddingTop: topGlassHeight + theme.spacing['3']}
            : null,
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={baseStyles.titleBlock}>
          <Text style={baseStyles.displayTitle}>
            {meta?.displayTitle ?? title}
          </Text>
          {meta ? (
            <View style={baseStyles.updatedPill}>
              <View style={baseStyles.updatedDot} />
              <Text style={baseStyles.updatedPillText}>
                Last updated {meta.lastUpdated} · {meta.version}
              </Text>
            </View>
          ) : null}
        </View>

        {Array.isArray(navChips) && navChips.length > 0 ? (
          <View style={baseStyles.navChipsRow}>
            {navChips.map((chip, index) => {
              const active = index === activeChip;
              return (
                <PressableOpacity
                  key={chip}
                  accessibilityRole="button"
                  onPress={() => setActiveChip(index)}
                  style={[
                    baseStyles.navChip,
                    active && baseStyles.navChipActive,
                  ]}>
                  <Text
                    style={[
                      baseStyles.navChipText,
                      active && baseStyles.navChipTextActive,
                    ]}>
                    {chip}
                  </Text>
                </PressableOpacity>
              );
            })}
          </View>
        ) : null}

        <LegalContentRenderer sections={sections} />
        {extraContent}

        <PressableOpacity
          accessibilityRole="button"
          accessibilityLabel="Download as PDF"
          onPress={handleDownload}
          style={baseStyles.downloadButton}>
          <Ionicons
            name="download-outline"
            size={16}
            color={theme.colors.inkBody}
          />
          <Text style={baseStyles.downloadButtonText}>Download as PDF</Text>
        </PressableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
