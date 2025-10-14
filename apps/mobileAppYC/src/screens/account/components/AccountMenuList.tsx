import { useTheme } from '@/hooks';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface AccountMenuItem {
  id: string;
  label: string;
  icon: ImageSourcePropType;
  danger?: boolean;
}

export interface AccountMenuListProps {
  items: AccountMenuItem[];
  onItemPress: (id: string) => void;
  rightArrowIcon?: ImageSourcePropType;
}

export const AccountMenuList: React.FC<AccountMenuListProps> = ({
  items,
  onItemPress,
  rightArrowIcon,
}) => {
    const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.row, index < items.length - 1 && styles.divider]}
          activeOpacity={0.85}
          onPress={() => onItemPress(item.id)}
          accessibilityRole="button"
          accessibilityLabel={item.label}>
          <View style={[styles.iconCircle, item.danger && styles.iconCircleDanger]}>
            <Image source={item.icon} style={styles.icon} />
          </View>
          <Text style={[styles.label, item.danger && styles.labelDanger]}>{item.label}</Text>
          {rightArrowIcon ? (
            <Image
              source={rightArrowIcon}
              style={[styles.arrow, item.danger && styles.arrowDanger]}
            />
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
};


const createStyles = (theme: any) =>
  StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: theme.colors.cardBackground,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
    paddingHorizontal: theme.spacing['2'],
    backgroundColor: theme.colors.cardBackground,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSeperator,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(48, 47, 46, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing['4'],
  },
  iconCircleDanger: {
    backgroundColor: theme.colors.errorSurface,
  },
  icon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  label: {
    flex: 1,
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
  },
  labelDanger: {
    color: theme.colors.error,
  },
  arrow: {
    width: 16,
    height: 16,
    tintColor: theme.colors.secondary,
    resizeMode: 'contain',
  },
  arrowDanger: {
    tintColor: theme.colors.error,
  },
  });


export default AccountMenuList;

