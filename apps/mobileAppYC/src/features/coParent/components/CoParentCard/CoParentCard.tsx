import React, {useMemo} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import {SwipeableActionCard} from '@/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {useTheme} from '@/hooks';
import {createCardStyles} from '@/shared/components/common/cardStyles';
import type {CoParent} from '../../types';

interface CoParentCardProps {
  coParent: CoParent;
  onPressView?: () => void;
  onPressEdit?: () => void;
  hideSwipeActions?: boolean;
  showEditAction?: boolean;
  divider?: boolean;
}

export const CoParentCard: React.FC<CoParentCardProps> = ({
  coParent,
  onPressView,
  onPressEdit,
  hideSwipeActions = false,
  showEditAction = true,
  divider = true,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardStyles = useMemo(() => createCardStyles(theme), [theme]);

  const isPrimary = (coParent.role ?? '').toUpperCase().includes('PRIMARY');
  const fallbackName = isPrimary ? 'Primary Parent' : 'Co-parent';
  const displayName =
    `${coParent.firstName ?? ''} ${coParent.lastName ?? ''}`.trim() || fallbackName;
  const companionCount = coParent.companions.length;
  const companionText = companionCount === 1 ? 'Companion' : 'Companions';

  const avatarInitial = coParent.firstName?.charAt(0).toUpperCase() || 'C';

  return (
    <View style={styles.cardWrapper}>
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
          style={styles.innerContent}
        >
          <View style={styles.infoRow}>
            <View style={styles.avatarContainer}>
              {coParent.profilePicture ? (
                <Image
                  source={{uri: coParent.profilePicture}}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarInitials}>
                  <Text style={styles.avatarInitialsText}>{avatarInitial}</Text>
                </View>
              )}
            </View>

            <View style={styles.textContent}>
              <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                {displayName}
              </Text>
              <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
                {companionCount} {companionText}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </SwipeableActionCard>

      {divider && <View style={styles.divider} />}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    cardWrapper: {
      width: '100%',
    },
    innerContent: {
      width: '100%',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      paddingHorizontal: theme.spacing[1],
    },
    avatarContainer: {
      width: 60,
      height: 60,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: theme.borderRadius.full,
    },
    avatarInitials: {
       width: 60,
      height: 60,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.lightBlueBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitialsText: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
    },
    textContent: {
      flex: 1,
      gap: theme.spacing[1],
    },
    name: {
      ...theme.typography.businessSectionTitle20,
      color: theme.colors.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    meta: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.secondary,
    },
    divider: {
      marginTop: theme.spacing[1],
    },
  });

export default CoParentCard;
