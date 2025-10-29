import React, { useMemo } from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '@/hooks';

export interface AvatarItemConfig {
  source?: ImageSourcePropType | { uri: string };
  placeholder?: string; // Initial/letter for placeholder
}

export interface AvatarGroupProps {
  avatars: Array<ImageSourcePropType | { uri: string } | AvatarItemConfig>;
  size?: number;
  overlap?: number;
  borderWidth?: number;
  maxCount?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Reusable component for displaying a group of overlapping avatars.
 * Used in TaskCard and AppointmentCard to avoid code duplication.
 */
export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  size = 40,
  overlap = -15,
  borderWidth = 2,
  maxCount,
  containerStyle,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, size, borderWidth), [theme, size, borderWidth]);

  const displayedAvatars = maxCount ? avatars.slice(0, maxCount) : avatars;

  const isAvatarConfig = (avatar: any): avatar is AvatarItemConfig => {
    return avatar && typeof avatar === 'object' && ('source' in avatar || 'placeholder' in avatar);
  };

  const getAvatarSource = (avatar: any) => {
    if (isAvatarConfig(avatar)) {
      return avatar.source;
    }
    return avatar;
  };

  const getPlaceholder = (avatar: any) => {
    if (isAvatarConfig(avatar)) {
      return avatar.placeholder;
    }
    return undefined;
  };

  const getUniqueKey = (avatar: any, index: number) => {
    if (isAvatarConfig(avatar)) {
      if (avatar.source && typeof avatar.source === 'object' && 'uri' in avatar.source && typeof avatar.source.uri === 'string') {
        return avatar.source.uri;
      }
      return avatar.placeholder || `config-${index}`;
    }
    if (typeof avatar === 'object' && avatar && 'uri' in avatar && typeof avatar.uri === 'string') {
      return avatar.uri;
    }
    if (typeof avatar === 'number') {
      return `require-${avatar}`;
    }
    return `avatar-${index}`;
  };

  return (
    <View style={[styles.avatarGroup, containerStyle]}>
      {displayedAvatars.map((avatar, index) => {
        const source = getAvatarSource(avatar);
        const placeholder = getPlaceholder(avatar);
        const uniqueKey = getUniqueKey(avatar, index);

        if (source) {
          // Render actual image
          return (
            <Image
              key={uniqueKey}
              source={source}
              style={[
                styles.avatar,
                index === 0 ? styles.avatarFirst : { marginLeft: overlap },
              ]}
            />
          );
        } else if (placeholder) {
          // Render placeholder with initial
          return (
            <View
              key={uniqueKey}
              style={[
                styles.avatarPlaceholder,
                index === 0 ? styles.avatarFirst : { marginLeft: overlap },
              ]}
            >
              <Text style={styles.avatarInitial}>{placeholder}</Text>
            </View>
          );
        }
        return null;
      })}
    </View>
  );
};

const createStyles = (theme: any, size: number, borderWidth: number) =>
  StyleSheet.create({
    avatarGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: borderWidth,
      borderColor: theme.colors.surface,
      resizeMode: 'cover' as const,
    },
    avatarPlaceholder: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: borderWidth,
      borderColor: theme.colors.surface,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      ...theme.typography.titleSmall,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    avatarFirst: {
      marginLeft: 0,
    },
  });
