import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ImageSourcePropType,
} from 'react-native';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface CategoryTileProps {
  icon: ImageSourcePropType;
  title: string;
  subtitle: string;
  isSynced?: boolean;
  onPress: () => void;
  containerStyle?: any;
}

export const CategoryTile: React.FC<CategoryTileProps> = ({
  icon,
  title,
  subtitle,
  isSynced = false,
  onPress,
  containerStyle,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

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
            {isSynced && (
              <View style={styles.syncBadge}>
                <Text style={styles.syncText}>Synced with{'\n'}Yosemite Crew PMS</Text>
              </View>
            )}
            <Image source={Images.rightArrow} style={styles.arrowIcon} />
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
    arrowIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
  });
