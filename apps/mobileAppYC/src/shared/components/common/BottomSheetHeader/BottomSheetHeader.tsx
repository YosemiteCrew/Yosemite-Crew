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
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingRight: theme.spacing['12'],
    },
    title: {
      // Left-aligned 18/700 Satoshi title with a slightly taller line height.
      ...theme.typography.paragraphBold,
      fontSize: 18,
      lineHeight: 24,
      color: theme.colors.ink,
      textAlign: 'left',
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
