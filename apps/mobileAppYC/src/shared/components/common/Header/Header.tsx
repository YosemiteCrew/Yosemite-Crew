// src/components/common/Header/Header.tsx
import React from 'react';
import {View, Text, Image, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks';
import { Images } from '@/assets/images';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightIcon?: any;
  onRightPress?: () => void;
  style?: object;
  glass?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBack,
  rightIcon,
  onRightPress,
  style,
  glass = true,
}) => {
  const {theme} = useTheme();
  const iconButtonSize = theme.spacing?.['9'] ?? 36;
  const styles = createStyles(theme);

  const content = (
    <View style={[styles.container, style]}>
      {showBackButton ? (
        <View style={styles.iconButtonShadow}>
          <LiquidGlassIconButton
            onPress={onBack ?? (() => {})}
            size={iconButtonSize}
            style={styles.iconButton}>
            <Image
              source={Images.backIcon}
              style={[styles.icon, {tintColor: theme.colors.text}]}
            />
          </LiquidGlassIconButton>
        </View>
      ) : (
        <View style={styles.spacer} />
      )}

      {title && (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      )}

      {rightIcon ? (
        <View style={styles.iconButtonShadow}>
          <LiquidGlassIconButton
            onPress={onRightPress ?? (() => {})}
            size={iconButtonSize}
            style={styles.iconButton}>
            <Image source={rightIcon} style={[styles.icon]} />
          </LiquidGlassIconButton>
        </View>
      ) : (
        <View style={styles.spacer} />
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
  const iconButtonSize = theme.spacing?.['9'] ?? 36;

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing?.['5'] || 20,
      paddingTop: Platform.OS === 'ios' ? theme.spacing?.['2'] || 8 : theme.spacing?.['5'] || 20,
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
      shadowColor: theme.colors.neutralShadow ?? '#000000',
      shadowOffset: {width: 0, height: 12},
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 10,
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
      ...theme.typography.h3,
      color: theme.colors.text,
    },
  });
};
