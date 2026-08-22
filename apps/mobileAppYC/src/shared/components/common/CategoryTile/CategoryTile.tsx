import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';

export interface CategoryTileProps {
  icon: ImageSourcePropType;
  title: string;
  subtitle: string;
  isSynced?: boolean;
  onPress: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  /** Pastel background for the icon tile (warm-bone surface token value). */
  iconTint?: string;
  /** Optional item count; renders the count badge when a value is provided. */
  count?: number;
  testID?: string;
}

const SYNCED_LABEL = 'SYNCED';

export const CategoryTile: React.FC<CategoryTileProps> = ({
  icon,
  title,
  subtitle,
  isSynced = false,
  onPress,
  containerStyle,
  iconTint,
  count,
  testID = 'category-tile',
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const iconTileStyle = React.useMemo(
    () => [
      styles.iconTile,
      {backgroundColor: iconTint ?? theme.colors.screen2},
    ],
    [styles.iconTile, iconTint, theme.colors.screen2],
  );

  return (
    <PressableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, containerStyle]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}>
      <View style={iconTileStyle}>
        <Image source={icon} style={styles.iconImage} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {count !== undefined ? (
            <View style={styles.countBadge} testID={`${testID}-count`}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>

        {isSynced ? (
          <View style={styles.syncedPill} testID={`${testID}-synced`}>
            <View style={styles.syncedDot} />
            <Text style={styles.syncedText}>{SYNCED_LABEL}</Text>
          </View>
        ) : null}
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={theme.colors.inkFaint}
      />
    </PressableOpacity>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3.5'],
      padding: theme.spacing['4'],
      backgroundColor: theme.colors.screen,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      ...theme.shadows.card,
    },
    iconTile: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconImage: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      resizeMode: 'contain',
    },
    body: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
    },
    title: {
      fontSize: 15.5,
      fontWeight: '700',
      color: theme.colors.ink,
      flexShrink: 1,
    },
    subtitle: {
      fontSize: 12.5,
      color: theme.colors.inkMuted,
      marginTop: 1,
    },
    countBadge: {
      paddingHorizontal: 11,
      paddingVertical: theme.spacing['1.25'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blueSoft,
    },
    countText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.blueText,
    },
    syncedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing['1.25'],
      marginTop: theme.spacing['2'],
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    syncedDot: {
      width: 5,
      height: 5,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.success,
    },
    syncedText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: theme.colors.inkMuted,
      letterSpacing: 0.4,
    },
  });
