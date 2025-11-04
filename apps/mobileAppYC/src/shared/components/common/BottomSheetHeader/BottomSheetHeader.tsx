import React from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet} from 'react-native';
import {Images} from '@/assets/images';

interface BottomSheetHeaderProps {
  title: string;
  onClose: () => void;
  theme: any;
}

/**
 * Shared header component for bottom sheets
 * Eliminates duplication across TaskTypeBottomSheet, GenericSelectBottomSheet, etc.
 */
export const BottomSheetHeader: React.FC<BottomSheetHeaderProps> = ({
  title,
  onClose,
  theme,
}) => {
  const styles = createStyles(theme);
  const closeIconSource = Images?.crossIcon ?? null;

  return (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
      {closeIconSource && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Image
            source={closeIconSource}
            style={styles.closeIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
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
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: theme.spacing['8'],
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: theme.typography.h3.fontSize * 1.3,
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      padding: theme.spacing['2'],
    },
    closeIcon: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
    },
  });
