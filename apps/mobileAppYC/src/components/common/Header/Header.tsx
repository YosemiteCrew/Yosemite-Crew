// src/components/common/Header/Header.tsx
import React from 'react';
import {View, Text, TouchableOpacity, Image, StyleSheet, Platform} from 'react-native';
import {useTheme} from '../../../hooks';
import { Images } from '@/assets/images';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightIcon?: any;
  onRightPress?: () => void;
  style?: object;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBack,
  rightIcon,
  onRightPress,
  style,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, style]}>
      {showBackButton ? (
        <TouchableOpacity style={styles.iconButton} onPress={onBack}>
          <Image
            source={Images.backIcon || require('../../../assets/images/icons/back.png')}
            style={[styles.icon, {tintColor: theme.colors.text}]}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.spacer} />
      )}

      {title && (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      )}

      {rightIcon ? (
        <TouchableOpacity style={styles.iconButton} onPress={onRightPress}>
          <Image source={rightIcon} style={[styles.icon, {tintColor: theme.colors.text}]} />
        </TouchableOpacity>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing?.['5'] || 20,
      paddingTop: Platform.OS === 'ios' ? theme.spacing?.['2'] || 8 : theme.spacing?.['5'] || 20,
      paddingBottom: theme.spacing?.['2'] || 8,
      backgroundColor: theme.colors.background,
    },
    iconButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    icon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
    },
    spacer: {
      width: 32,
      height: 32,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      ...theme.typography.h3,
      color: theme.colors.text,
    },
  });
