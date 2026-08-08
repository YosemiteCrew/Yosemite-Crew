// src/components/common/Header/Header.tsx
import React from 'react';
import {View, Text, Image, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightIcon?: any;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
  style?: object;
  glass?: boolean;
  /**
   * `root` renders a tab-root header: a large left-aligned Newsreader title.
   * `default` renders a sub-screen header: a centered 17/600 title.
   */
  variant?: 'default' | 'root';
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBack,
  rightIcon,
  onRightPress,
  rightAccessibilityLabel = 'More options',
  style,
  glass = true,
  variant = 'default',
}) => {
  const {theme} = useTheme();
  const iconButtonSize = theme.spacing?.['10'] ?? 40;
  const styles = createStyles(theme);
  const isRoot = variant === 'root';

  const content = (
    <View style={[styles.container, style]}>
      {!isRoot &&
        (showBackButton ? (
          <View style={styles.iconButtonShadow}>
            <LiquidGlassIconButton
              onPress={onBack ?? (() => {})}
              size={iconButtonSize}
              style={styles.iconButton}
              accessibilityLabel="Back">
              <Image
                source={Images.backIcon}
                style={[styles.icon, {tintColor: theme.colors.text}]}
              />
            </LiquidGlassIconButton>
          </View>
        ) : (
          <View style={styles.spacer} />
        ))}

      {title && (
        <Text
          style={isRoot ? styles.titleRoot : styles.title}
          numberOfLines={1}>
          {title}
        </Text>
      )}

      {rightIcon ? (
        <View style={styles.iconButtonShadow}>
          <LiquidGlassIconButton
            onPress={onRightPress ?? (() => {})}
            size={iconButtonSize}
            style={styles.iconButton}
            accessibilityLabel={rightAccessibilityLabel}>
            <Image source={rightIcon} style={styles.icon} />
          </LiquidGlassIconButton>
        </View>
      ) : (
        !isRoot && <View style={styles.spacer} />
      )}
    </View>
  );

  if (!glass) {
    return content;
  }

  return (
    <View style={styles.glassShadowWrapper}>
      <LiquidGlassCard
        glassEffect="clear"
        interactive={false}
        shadow="none"
        style={styles.glassCard}
        fallbackStyle={styles.glassFallback}>
        {content}
      </LiquidGlassCard>
    </View>
  );
};

const createStyles = (theme: any) => {
  const iconButtonSize = theme.spacing?.['10'] ?? 40;

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing?.['5'] || 20,
      paddingTop:
        Platform.OS === 'ios'
          ? theme.spacing?.['2'] || 8
          : theme.spacing?.['5'] || 20,
      paddingBottom: theme.spacing?.['2'] || 8,
      overflow: 'visible',
    },
    glassCard: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'visible',
    },
    glassShadowWrapper: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      boxShadow: `0px 12px 18px ${theme.colors.neutralShadow ?? '#000000'}`,
      backgroundColor: 'transparent',
    },
    glassFallback: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      borderWidth: 0,
      borderColor: 'transparent',
    },
    iconButton: {
      width: iconButtonSize,
      height: iconButtonSize,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconButtonShadow: {
      borderRadius: theme.borderRadius.full,
      overflow: 'visible',
      ...(Platform.OS === 'ios' ? theme.shadows.sm : null),
    },
    icon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
    },
    spacer: {
      width: iconButtonSize,
      height: iconButtonSize,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      ...theme.typography.mobileBodyEmphasis,
      fontWeight: '600',
      color: theme.colors.ink,
    },
    titleRoot: {
      flex: 1,
      textAlign: 'left',
      ...theme.typography.serifTitle,
      color: theme.colors.ink,
    },
  });
};
