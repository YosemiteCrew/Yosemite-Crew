import React from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import {Images} from '@/assets/images';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';

interface BottomSheetHeaderProps {
  title: string;
  onClose: () => void;
  theme: any;
  showCloseButton?: boolean;
}

/**
 * Shared header component for bottom sheets
 * Eliminates duplication across TaskTypeBottomSheet, GenericSelectBottomSheet, etc.
 */
export const BottomSheetHeader: React.FC<BottomSheetHeaderProps> = ({
  title,
  onClose,
  theme,
  showCloseButton = true,
}) => {
  const styles = createStyles(theme);
  const closeIconSource = Images?.crossIcon ?? null;
  const closeButtonSize = theme.spacing['9'];

  return (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
      {showCloseButton && closeIconSource && (
        <LiquidGlassIconButton
          onPress={onClose}
          size={closeButtonSize}
          style={styles.closeButton}>
          <Image
            source={closeIconSource}
            style={styles.closeIcon}
            resizeMode="contain"
          />
        </LiquidGlassIconButton>
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['4'],
      position: 'relative',
      minHeight: theme.spacing['12'],
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['10'],
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: theme.typography.h3.fontSize * 1.3,
      maxWidth: '100%',
    },
    closeButton: {
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      right: 0,
      top: theme.spacing['4'],
    },
    closeIcon: {
      width: theme.spacing['4'],
      height: theme.spacing['4'],
    },
  });
