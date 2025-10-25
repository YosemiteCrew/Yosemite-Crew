import React, {useMemo} from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SwipeableGlassCard} from '@/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

const ACTION_WIDTH = 65;
const OVERLAP_WIDTH = 12;
const TOTAL_ACTION_WIDTH = ACTION_WIDTH * 2;

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

  const visibleActionWidth = showEditAction ? TOTAL_ACTION_WIDTH : ACTION_WIDTH;
  const totalActionWidth = OVERLAP_WIDTH + visibleActionWidth;

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      actionWidth={hideSwipeActions ? 0 : totalActionWidth}
      actionBackgroundColor="transparent"
      actionOverlap={hideSwipeActions ? 0 : OVERLAP_WIDTH}
      containerStyle={styles.container}
      cardProps={{
        interactive: true,
        glassEffect: 'clear',
        shadow: 'none',
        style: styles.card,
        fallbackStyle: styles.fallback,
      }}
      actionContainerStyle={hideSwipeActions ? styles.hiddenActionContainer : styles.actionContainer}
      renderActionContent={
        hideSwipeActions
          ? undefined
          : close => (
              <View style={styles.actionWrapper}>
                <View
                  style={[
                    styles.overlapContainer,
                    {
                      width: OVERLAP_WIDTH,
                      backgroundColor: showEditAction
                        ? theme.colors.primary
                        : theme.colors.success,
                    },
                  ]}
                />

                {showEditAction && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.actionButton, styles.editActionButton, {width: ACTION_WIDTH}]}
                    onPress={() => {
                      close();
                      onPressEdit?.();
                    }}>
                    <Image source={Images.editIconSlide} style={styles.actionIcon} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.actionButton, styles.viewActionButton, {width: ACTION_WIDTH}]}
                  onPress={() => {
                    close();
                    onPressView?.();
                  }}>
                  <Image source={Images.viewIconSlide} style={styles.actionIcon} />
                </TouchableOpacity>
              </View>
            )
      }>
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
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={onPressPrimary}>
            <Image source={primaryIcon} style={styles.primaryIcon} />
            <Text style={styles.primaryLabel}>{primaryButtonLabel}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
      marginBottom: theme.spacing[3],
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
    },
    hiddenActionContainer: {
      width: 0,
    },
    actionWrapper: {
      flexDirection: 'row',
      height: '100%',
      width: '100%',
      backgroundColor: theme.colors.primary,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
      overflow: 'hidden',
    },
    overlapContainer: {
      height: '100%',
    },
    actionButton: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editActionButton: {
      backgroundColor: theme.colors.primary,
    },
    viewActionButton: {
      backgroundColor: theme.colors.success,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
    },
    actionIcon: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
    },
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
      resizeMode: 'cover',
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
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
      marginTop: theme.spacing[3],
      gap: theme.spacing[2],
      backgroundColor: theme.colors.white,
      minHeight: 45,
    },
    primaryIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.secondary,
    },
    primaryLabel: {
      ...theme.typography.button,
      color: theme.colors.secondary,
    },
  });

export default BaseCard;
