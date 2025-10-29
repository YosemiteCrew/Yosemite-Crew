import React, {useMemo} from 'react';
import {View, ScrollView, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {createScreenContainerStyles} from '@/shared/utils/screenStyles';

interface FormScreenLayoutProps {
  children: React.ReactNode;
  contentContainerStyle?: any;
  glassCardStyle?: any;
  glassFallbackStyle?: any;
}

export const FormScreenLayout: React.FC<FormScreenLayoutProps> = ({
  children,
  contentContainerStyle,
  glassCardStyle,
  glassFallbackStyle,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
        showsVerticalScrollIndicator={false}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive
          tintColor={theme.colors.white}
          style={[styles.glassContainer, glassCardStyle]}
          fallbackStyle={[styles.glassFallback, glassFallbackStyle]}>
          <View style={styles.listContainer}>{children}</View>
        </LiquidGlassCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    content: {
      paddingHorizontal: theme.spacing[5],
      paddingBottom: theme.spacing[10],
    },
    glassContainer: {
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[2],
      overflow: 'hidden',
      ...theme.shadows.md,
    },
    glassFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
    },
    listContainer: {
      gap: theme.spacing[1],
    },
  });
