import {useTheme} from '@/hooks';
import React from 'react';
import {Image, ImageSourcePropType, StyleSheet, Text, View} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {
  IconTile,
  type IconTileTone,
} from '@/shared/components/common/IconTile/IconTile';
import type {Theme} from '@/theme';

export interface AccountMenuItem {
  id: string;
  label: string;
  icon: ImageSourcePropType;
  /** Warm-bone tile tint. Falls back to danger/neutral when omitted. */
  tone?: IconTileTone;
  danger?: boolean;
}

export interface AccountMenuListProps {
  items: AccountMenuItem[];
  onItemPress: (id: string) => void;
  rightArrowIcon?: ImageSourcePropType;
}

// These icon PNGs are drawn with a fixed near-black glyph colour, so on the
// low-opacity dark-theme tints (indigo/violet/success) the icon nearly
// disappears into its own badge. Retint with the tone's own accent colour
// (the same token paired with the tone's surface in theme/colors.ts) so the
// glyph stays legible in both themes.
const resolveIconTint = (
  theme: Theme,
  tone: IconTileTone,
): string | undefined => {
  switch (tone) {
    case 'indigo':
      return theme.colors.indigo;
    case 'violet':
      return theme.colors.violet;
    case 'success':
      return theme.colors.success;
    case 'info':
      return theme.colors.info;
    default:
      return undefined;
  }
};

export const AccountMenuList: React.FC<AccountMenuListProps> = ({
  items,
  onItemPress,
  rightArrowIcon,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const tone = item.tone ?? (item.danger ? 'danger' : 'neutral');
        return (
          <PressableOpacity
            key={item.id}
            style={[styles.row, index < items.length - 1 && styles.divider]}
            activeOpacity={0.85}
            onPress={() => onItemPress(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.label}>
            <IconTile
              icon={item.icon}
              tone={tone}
              iconTintColor={resolveIconTint(theme, tone)}
              size={theme.spacing['10']}
              style={styles.iconTile}
            />
            <Text style={[styles.label, item.danger && styles.labelDanger]}>
              {item.label}
            </Text>
            {rightArrowIcon ? (
              <Image
                source={rightArrowIcon}
                style={[styles.arrow, item.danger && styles.arrowDanger]}
              />
            ) : null}
          </PressableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['4'],
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.hairline,
    },
    iconTile: {
      marginRight: theme.spacing['3'],
    },
    label: {
      flex: 1,
      ...theme.typography.titleSmall,
      color: theme.colors.inkBody,
    },
    labelDanger: {
      color: theme.colors.error,
    },
    arrow: {
      width: theme.spacing['4'],
      height: theme.spacing['4'],
      tintColor: theme.colors.inkFaint2,
      resizeMode: 'contain',
    },
    arrowDanger: {
      tintColor: theme.colors.error,
    },
  });

export default AccountMenuList;
