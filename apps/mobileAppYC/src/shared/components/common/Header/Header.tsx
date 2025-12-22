// src/components/common/Header/Header.tsx
import React from 'react';
import {View, Text, Image, StyleSheet, Platform} from 'react-native';
import {useTheme} from '@/hooks';
import { Images } from '@/assets/images';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightIcon?: any;
  onRightPress?: () => void;
  style?: object;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBack,
  rightIcon,
  onRightPress,
  style,
}) => {
  const {theme} = useTheme();
  const iconButtonSize = theme.spacing?.['9'] ?? 36;
  const styles = createStyles(theme);

  return (
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
    },
    iconButton: {
      width: iconButtonSize,
      height: iconButtonSize,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconButtonShadow: {
      borderRadius: theme.borderRadius.full,
      ...theme.shadows.md,
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
