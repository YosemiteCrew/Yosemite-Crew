import React, {useMemo} from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageSourcePropType,
} from 'react-native';
import {SwipeableActionCard} from '@/components/common/SwipeableActionCard/SwipeableActionCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {createCardStyles} from '@/components/common/cardStyles';

const formatDateDDMMYYYY = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
};

export interface DocumentCardProps {
  title: string;
  businessName: string;
  visitType: string;
  issueDate: string;
  thumbnail?: ImageSourcePropType;
  onPressView?: () => void;
  onPressEdit?: () => void;
  showEditAction?: boolean;
  onPress?: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  title,
  businessName,
  visitType,
  issueDate,
  thumbnail,
  onPressView,
  onPressEdit,
  showEditAction = true,
  onPress,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardStyles = useMemo(() => createCardStyles(theme), [theme]);

  const handleCardPress = () => {
    onPress?.();
  };

  return (
    <SwipeableActionCard
      cardStyle={cardStyles.card}
      fallbackStyle={cardStyles.fallback}
      onPressView={onPressView}
      onPressEdit={onPressEdit}
      showEditAction={showEditAction}
    >
      <TouchableOpacity
        activeOpacity={onPress ? 0.8 : 1}
        onPress={handleCardPress}
        disabled={!onPress}>
        <View style={styles.content}>
          <View style={styles.thumbnailContainer}>
            <Image
              source={thumbnail ?? Images.documentFallback}
              style={styles.thumbnail}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
              <Text style={styles.label}>Title: </Text>
              <Text style={styles.value}>{title}</Text>
            </Text>
            <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
              <Text style={styles.label}>Business: </Text>
              <Text style={styles.value}>{businessName}</Text>
            </Text>
            <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
              <Text style={styles.label}>Visit type: </Text>
              <Text style={styles.value}>{visitType}</Text>
            </Text>
            <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
              <Text style={styles.label}>Issue Date: </Text>
              <Text style={styles.value}>{formatDateDDMMYYYY(issueDate)}</Text>
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </SwipeableActionCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    content: {
      flexDirection: 'row',
      gap: theme.spacing[4],
      alignItems: 'center',
    },
    thumbnailContainer: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.base,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover' as const,
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing[1],
    },
    infoRow: {
      ...theme.typography.labelXsBold,
      color: theme.colors.secondary,
    },
    label: {
      color: theme.colors.textSecondary,
    },
    value: {
      color: theme.colors.secondary,
      fontWeight: '600',
    },
  });

export default DocumentCard;
