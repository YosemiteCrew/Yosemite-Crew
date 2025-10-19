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
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';

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
      <LiquidGlassCard
        interactive={false}
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
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing[3],
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      padding: theme.spacing[4],
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.base,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing[1],
    },
    title: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    subtitle: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
    },
    rightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    syncBadge: {
      backgroundColor: theme.colors.successLight || '#E6F4EF',
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    syncText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.success,
      fontSize: 10,
      textAlign: 'center',
      lineHeight: 11,
    },
  });

export default IconInfoTile;
