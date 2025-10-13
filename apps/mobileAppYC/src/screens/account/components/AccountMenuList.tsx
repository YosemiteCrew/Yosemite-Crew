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

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 7,
    backgroundColor: '#FFFFFF',
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAEAEA',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(48, 47, 46, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconCircleDanger: {
    backgroundColor: '#FDEBEA',
  },
  icon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  label: {
    flex: 1,
    color: '#302F2E',
    fontWeight: '700',
  },
  labelDanger: {
    color: '#EA3729',
  },
  arrow: {
    width: 16,
    height: 16,
    tintColor: '#302F2E',
    resizeMode: 'contain',
  },
  arrowDanger: {
    tintColor: '#EA3729',
  },
});

export default AccountMenuList;

