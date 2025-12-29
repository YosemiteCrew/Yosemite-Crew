import React, {useMemo} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';

interface ViewMoreButtonProps {
  onPress: () => void;
  title?: string;
}

/**
 * Reusable "View more" button with consistent styling
 * Eliminates duplication across screens
 */
export const ViewMoreButton: React.FC<ViewMoreButtonProps> = ({
  onPress,
  title = 'View more',
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.shadowWrapper}>
      <LiquidGlassButton
        onPress={onPress}
        size="small"
        compact
        glassEffect="clear"
        borderRadius="full"
        style={styles.button}
        textStyle={styles.text}
        shadowIntensity="none"
        title={title}
      />
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    shadowWrapper: {
      borderRadius: theme.borderRadius.full,
      ...(Platform.OS === 'ios' ? theme.shadows.sm : null),
    },
    button: {
      alignSelf: 'flex-start',
      flexGrow: 0,
      flexShrink: 0,
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['1'],
      minHeight: theme.spacing['7'],
      minWidth: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      ...theme.shadows.sm,
      shadowColor: theme.colors.neutralShadow,
    },
    text: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.primary,
    },
  });
