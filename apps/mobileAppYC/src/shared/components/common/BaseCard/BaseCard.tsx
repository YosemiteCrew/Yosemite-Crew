import React, {useMemo} from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SwipeableActionCard} from '@/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {CardActionButton} from '@/shared/components/common/CardActionButton/CardActionButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {createCardStyles} from '@/shared/components/common/cardStyles';

export interface BaseCardProps {
  title: string;
  primaryMeta?: string;
  secondaryMeta?: string;
  thumbnail?: ImageSourcePropType;
  onPressView?: () => void;
  onPressEdit?: () => void;
  onPressPrimary?: () => void;
  showEditAction?: boolean;
  showPrimaryButton?: boolean;
  isPrimaryActive?: boolean;
  primaryButtonLabel?: string;
  primaryIcon?: ImageSourcePropType;
  hideSwipeActions?: boolean;
  _onTogglePrimaryStatus?: () => void;
  amountDisplay?: string;
  rightContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
  detailsContent?: React.ReactNode;
}

export const BaseCard: React.FC<BaseCardProps> = ({
  title,
  primaryMeta,
  secondaryMeta,
  thumbnail,
  onPressView,
  onPressEdit,
  onPressPrimary,
  showEditAction = true,
  showPrimaryButton = false,
  isPrimaryActive = false,
  primaryButtonLabel = 'Action',
  primaryIcon = Images.currencyIcon,
  hideSwipeActions = false,
  _onTogglePrimaryStatus,
  amountDisplay,
  rightContent,
  bottomContent,
  detailsContent,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardStyles = useMemo(() => createCardStyles(theme), [theme]);

  return (
    <SwipeableActionCard
      cardStyle={cardStyles.card}
      fallbackStyle={cardStyles.fallback}
      onPressView={onPressView}
      onPressEdit={onPressEdit}
      showEditAction={showEditAction}
      hideSwipeActions={hideSwipeActions}
    >
      <TouchableOpacity
        activeOpacity={onPressView ? 0.85 : 1}
        onPress={onPressView}
        style={styles.innerContent}>
        <View style={styles.infoRow}>
          {thumbnail && (
            <View style={styles.thumbnailContainer}>
              <Image
                source={thumbnail}
                style={styles.thumbnail}
              />
            </View>
          )}
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            {primaryMeta && (
              <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
                {primaryMeta}
              </Text>
            )}
            {secondaryMeta && (
              <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
                {secondaryMeta}
              </Text>
            )}
            {detailsContent}
          </View>

          {(amountDisplay || rightContent) && (
            <View style={styles.rightColumn}>
              {amountDisplay && <Text style={styles.amount}>{amountDisplay}</Text>}
              {rightContent}
            </View>
          )}
        </View>

        {bottomContent}

        {showPrimaryButton && !isPrimaryActive && (
          <CardActionButton
            label={primaryButtonLabel}
            icon={primaryIcon}
            onPress={onPressPrimary!}
            variant="primary"
          />
        )}
      </TouchableOpacity>
    </SwipeableActionCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    innerContent: {
      width: '100%',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    thumbnailContainer: {
      width: 54,
      height: 54,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: theme.colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover' as const,
    },
    textContent: {
      flex: 1,
      gap: theme.spacing[1],
    },
    title: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    meta: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    rightColumn: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: theme.spacing[2],
      minWidth: 70,
    },
    amount: {
      ...theme.typography.h5,
      color: theme.colors.secondary,
    },
  });

export default BaseCard;
