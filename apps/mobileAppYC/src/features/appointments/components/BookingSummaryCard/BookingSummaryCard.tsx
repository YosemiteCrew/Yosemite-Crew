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
      <Image source={source} style={styles.avatar} />
      <View style={styles.textColumn}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        {!!subtitlePrimary && (
          <Text style={styles.subtitlePrimary} numberOfLines={1} ellipsizeMode="tail">
            {subtitlePrimary}
          </Text>
        )}
        {!!subtitleSecondary && (
          <Text style={styles.subtitleSecondary} numberOfLines={2} ellipsizeMode="tail">
            {subtitleSecondary}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!interactive) {
    return (
      <View style={[styles.cardContainer, style]}>
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
      containerStyle={[styles.cardContainer, style]}
      cardProps={{
        shadow: 'none',
        glassEffect: 'none',
        style: styles.card,
        fallbackStyle: styles.card,
        padding: '0',
      }}>
      {content}
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    cardContainer: {
      width: '100%',
    },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[3],
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 16,
      backgroundColor: theme.colors.border + '40',
    },
    textColumn: {
      flex: 1,
      gap: 4,
    },
    title: {
      ...theme.typography.h6Clash,
      color: '#302F2E',
    },
    subtitlePrimary: {
      ...theme.typography.subtitleBold14,
      color: '#595958',
    },
    subtitleSecondary: {
      ...theme.typography.subtitleBold14,
      color: '#302F2E',
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
