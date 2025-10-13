import React from 'react';
import {Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

export interface AccountHeaderProps {
  title: string;
  backIcon: ImageSourcePropType;
  notificationIcon?: ImageSourcePropType;
  onBack: () => void;
  onNotificationPress?: () => void;
  iconSize?: number;
  borderRadius?: number;
}

export const AccountHeader: React.FC<AccountHeaderProps> = ({
  title,
  backIcon,
  notificationIcon,
  onBack,
  onNotificationPress,
  iconSize = 30,
  borderRadius = 16,
}) => {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        accessibilityRole="button"
        testID="header-back"
        style={[styles.iconBtn, {borderRadius}]}
        onPress={onBack}
        activeOpacity={0.85}>
        <Image source={backIcon} style={[styles.icon, {width: iconSize, height: iconSize}]} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        testID="header-notification"
        style={[styles.iconBtn, {borderRadius}]}
        onPress={onNotificationPress}
        activeOpacity={0.85}>
        {notificationIcon ? (
          <Image
            source={notificationIcon}
            style={[styles.icon, {width: iconSize, height: iconSize}]}
          />
        ) : null}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    resizeMode: 'contain',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '500',
  },
});

export default AccountHeader;

