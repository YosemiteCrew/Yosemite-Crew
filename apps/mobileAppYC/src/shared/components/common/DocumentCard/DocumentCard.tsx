import React, {useMemo} from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageSourcePropType,
} from 'react-native';
import {SwipeableActionCard} from '@/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {createCardStyles} from '@/shared/components/common/cardStyles';
import {formatLabel} from '@/shared/utils/helpers';

const formatReadableDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dateObj.getTime())) {
    return '—';
  }

  return dateObj.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

  const resolvedTitle = title?.trim() || 'Document';
  const resolvedBusiness = businessName?.trim() || '—';
  const resolvedVisitType = visitType?.trim()
    ? formatLabel(visitType.trim(), '—')
    : '—';
  const resolvedIssueDate = issueDate || '';

  const handleCardPress = () => {
    onPress?.();
  };

  return (
    <View style={styles.shadowWrapper}>
      <SwipeableActionCard
        cardStyle={cardStyles.card}
        fallbackStyle={cardStyles.fallback}
        onPressView={onPressView}
        onPressEdit={onPressEdit}
        showEditAction={showEditAction}>
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
                <Text style={styles.value}>{resolvedTitle}</Text>
              </Text>
              <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
                <Text style={styles.label}>Business: </Text>
                <Text style={styles.value}>{resolvedBusiness}</Text>
              </Text>
              <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
                <Text style={styles.label}>Visit type: </Text>
                <Text style={styles.value}>{resolvedVisitType}</Text>
              </Text>
              <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
                <Text style={styles.label}>Issue Date: </Text>
                <Text style={styles.value}>
                  {formatReadableDate(resolvedIssueDate)}
                </Text>
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </SwipeableActionCard>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    shadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      ...(Platform.OS === 'ios' ? theme.shadows.sm : theme.shadows.sm),
      shadowColor: theme.colors.neutralShadow ?? theme.colors.black,
      backgroundColor: theme.colors.surface,
    },
    content: {
      flexDirection: 'row',
      gap: theme.spacing['4'],
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
      gap: theme.spacing['1'],
    },
    infoRow: {
      ...theme.typography.labelXxsBold,
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
