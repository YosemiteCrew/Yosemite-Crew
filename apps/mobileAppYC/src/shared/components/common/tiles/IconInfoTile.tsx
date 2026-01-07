import React, {useMemo} from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {createGlassCardStyles, createCardContentStyles, createIconContainerStyles, createTextContainerStyles} from '@/shared/utils/cardStyles';

export interface IconInfoTileProps {
  icon: ImageSourcePropType;
  title: string;
  subtitle: string;
  onPress: () => void;
  isSynced?: boolean;
  syncLabel?: string;
  containerStyle?: ViewStyle;
  rightAccessory?: React.ReactNode;
}

export const IconInfoTile: React.FC<IconInfoTileProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  isSynced = false,
  syncLabel,
  containerStyle,
  rightAccessory,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const syncedLabel = syncLabel ?? 'Synced';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.container, containerStyle]}>
      <View style={styles.shadowWrapper}>
        <LiquidGlassCard
          interactive={true}
          glassEffect="clear"
          shadow="none"
          style={styles.card}
          fallbackStyle={styles.fallback}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Image source={icon} style={styles.icon} />
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>

            <View style={styles.rightContainer}>
              {isSynced ? (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncText}>{syncedLabel}</Text>
                </View>
              ) : null}
              {rightAccessory}
            </View>
          </View>
        </LiquidGlassCard>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) => {
  const glassCardStyles = createGlassCardStyles(theme);
  const contentStyles = createCardContentStyles(theme, '3');
  const iconStyles = createIconContainerStyles(theme, 48);
  const textStyles = createTextContainerStyles(theme, '1');

  return StyleSheet.create({
    container: {
      marginBottom: theme.spacing['3'],
    },
    shadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.sm,
      backgroundColor: theme.colors.cardBackground,
    },
    ...glassCardStyles,
    card: {
      ...(glassCardStyles as any).card,
      ...theme.shadows.none,
    },
    ...contentStyles,
    ...iconStyles,
    icon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
    },
    ...textStyles,
    title: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    subtitle: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.textSecondary,
    },
    rightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
    },
    syncBadge: {
      backgroundColor: theme.colors.successLight,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    syncText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.success,
      textAlign: 'center',
    },
  });
};

export default IconInfoTile;
