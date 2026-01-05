import React, {useMemo, useCallback} from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import {SwipeableGlassCard} from '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {useNavigation} from '@react-navigation/native';

type Props = {
  title: string;
  subtitlePrimary?: string | null;
  subtitleSecondary?: string | null;
  image?: ImageSourcePropType | number | null;
  onPress?: () => void;
  onEdit?: () => void;
  style?: ViewStyle;
  interactive?: boolean;
  showAvatar?: boolean;
  badgeText?: string | null;
  maxTitleLines?: number;
  maxSubtitleLines?: number;
  avatarSize?: number;
};

export const BookingSummaryCard: React.FC<Props> = ({
  title,
  subtitlePrimary,
  subtitleSecondary,
  image,
  onPress,
  onEdit,
  style,
  interactive = true,
  showAvatar = true,
  badgeText = null,
  maxTitleLines = 2,
  maxSubtitleLines = 2,
  avatarSize = 96,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const source = useMemo(() => resolveImageSource(image), [image]);
  const navigation = useNavigation<any>();

  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit();
    } else {
      navigation.goBack();
    }
  }, [navigation, onEdit]);

  const content = (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
      style={styles.inner}>
      {showAvatar ? (
        <Image
          source={source}
          style={[
            styles.avatar,
            {width: avatarSize, height: avatarSize, borderRadius: avatarSize / 4},
          ]}
        />
      ) : null}
      <View style={styles.textColumn}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={maxTitleLines} ellipsizeMode="tail">
            {title}
          </Text>
          {badgeText ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
          ) : null}
        </View>
        {!!subtitlePrimary && (
          <Text style={styles.subtitlePrimary} numberOfLines={maxSubtitleLines} ellipsizeMode="tail">
            {subtitlePrimary}
          </Text>
        )}
        {!!subtitleSecondary && (
          <Text style={styles.subtitleSecondary} numberOfLines={maxSubtitleLines} ellipsizeMode="tail">
            {subtitleSecondary}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!interactive) {
    return (
      <View style={[styles.shadowWrapper, style]}>
        <View style={styles.card}>{content}</View>
      </View>
    );
  }

  return (
    <SwipeableGlassCard
      actionIcon={Images.editIconSlide}
      onAction={handleEdit}
      actionBackgroundColor={theme.colors.primary}
      enableHorizontalSwipeOnly
      containerStyle={[styles.shadowWrapper, style]}
      cardProps={{
        glassEffect: 'clear',
        interactive: true,
        style: styles.card,
        fallbackStyle: styles.fallback,
        padding: '0',
      }}>
      {content}
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    shadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing['4'],
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    avatar: {
      width: theme.spacing['24'],
      height: theme.spacing['24'],
      borderRadius: theme.borderRadius['2xl'],
      backgroundColor: theme.colors.border + '40',
    },
    textColumn: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    title: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
    },
    subtitlePrimary: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.placeholder,
    },
    subtitleSecondary: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.secondary,
    },
    badge: {
      marginLeft: 'auto',
      paddingHorizontal: theme.spacing['2.5'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryTint,
    },
    badgeText: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.primary,
    },
  });

const resolveImageSource = (source?: ImageSourcePropType | number | null) => {
  if (typeof source === 'number') {
    return source;
  }
  if (!source) {
    return Images.hospitalIcon;
  }
  if (typeof source === 'string') {
    return {uri: source};
  }
  if (Array.isArray(source) && source.length > 0) {
    return resolveImageSource(source[0] as ImageSourcePropType);
  }
  if (typeof source === 'object' && 'uri' in source && source.uri) {
    return source as ImageSourcePropType;
  }
  return Images.hospitalIcon;
};

export default BookingSummaryCard;
