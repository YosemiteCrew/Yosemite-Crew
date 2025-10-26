import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TextInputProps,
  Image,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

type SearchBarMode = 'readonly' | 'input';

export interface SearchBarProps extends Pick<TextInputProps, 'value' | 'onChangeText' | 'onSubmitEditing' | 'autoFocus'> {
  placeholder?: string;
  mode?: SearchBarMode;
  containerStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search',
  mode = 'readonly',
  containerStyle,
  onPress,
  rightElement,
  value,
  onChangeText,
  onSubmitEditing,
  autoFocus,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const renderReadonly = () => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.touchable}
      onPress={onPress}>
      <View style={styles.content}>
        <Text
          style={styles.placeholder}
          numberOfLines={1}
          ellipsizeMode="tail">
          {placeholder}
        </Text>
        <Image source={Images.searchIcon} style={styles.icon} />
      </View>
      {rightElement}
    </TouchableOpacity>
  );

  const renderInput = () => (
    <View style={styles.inputWrapper}>
      <TextInput
        autoFocus={autoFocus}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
      />
      <Image source={Images.searchIcon} style={styles.icon} />
      {rightElement}
    </View>
  );

  return (
    <LiquidGlassCard
      interactive
      glassEffect="clear"
      style={StyleSheet.flatten([styles.container, containerStyle])}
      fallbackStyle={StyleSheet.flatten([styles.fallback, containerStyle])}>
      {mode === 'readonly' ? renderReadonly() : renderInput()}
    </LiquidGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      overflow: 'hidden',
      ...theme.shadows.base,
      shadowColor: theme.colors.neutralShadow,
    },
    fallback: {
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
    },
    touchable: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flex: 1,
    },
    icon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    placeholder: {
      flex: 1,
      fontFamily: theme.typography.paragraph.fontFamily,
      fontSize: 15,
      fontWeight: theme.typography.paragraph.fontWeight,
      lineHeight: 18,
      letterSpacing: -0.32,
      color: theme.colors.textSecondary,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    input: {
      flex: 1,
      fontFamily: theme.typography.paragraph.fontFamily,
      fontSize: 15,
      lineHeight: 18,
      letterSpacing: -0.32,
      color: theme.colors.text,
      padding: 0,
    },
  });
