import React, {useMemo} from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SwipeableActionCard} from '@/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {CardActionButton} from '@/shared/components/common/CardActionButton/CardActionButton';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {AvatarGroup} from '@/shared/components/common/AvatarGroup/AvatarGroup';
import {useTheme} from '@/hooks';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import {createCardStyles} from '@/shared/components/common/cardStyles';
import type {TaskCategory, TaskStatus} from '@/features/tasks/types';

export interface TaskCardProps {
  title: string;
  categoryLabel: string;
  subcategoryLabel?: string;
  date: string;
  time?: string;
  companionName: string;
  companionAvatar?: string;
  assignedToName?: string;
  assignedToAvatar?: string;
  status: TaskStatus;
  onPressView?: () => void;
  onPressEdit?: () => void;
  onPressComplete?: () => void;
  showEditAction?: boolean;
  showCompleteButton?: boolean;
  completeButtonVariant?: 'primary' | 'success' | 'secondary' | 'liquid-glass';
  completeButtonLabel?: string;
  hideSwipeActions?: boolean;
  category: TaskCategory;
  details?: any; // Task-specific details (medication, observational tool, etc.)
}

export const TaskCard: React.FC<TaskCardProps> = ({
  title,
  categoryLabel: _categoryLabel,
  subcategoryLabel: _subcategoryLabel,
  date,
  time,
  companionName,
  companionAvatar,
  assignedToName,
  assignedToAvatar,
  status,
  onPressView,
  onPressEdit,
  onPressComplete,
  showEditAction = true,
  showCompleteButton = false,
  completeButtonVariant = 'primary',
  completeButtonLabel = 'Complete',
  hideSwipeActions = false,
  category,
  details,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardStyles = useMemo(() => createCardStyles(theme), [theme]);

  const formattedDate = useMemo(() => {
    try {
      return formatDateForDisplay(new Date(date));
    } catch {
      return date;
    }
  }, [date]);

  const formattedTime = useMemo(() => {
    if (!time) return null;
    try {
      const [hours, minutes, seconds] = time.split(':').map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
      const timeDate = new Date();
      timeDate.setHours(hours, minutes, seconds || 0);
      return timeDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return time;
    }
  }, [time]);

  const isCompleted = status === 'completed';

  const renderTaskDetails = () => {
    if (!details) return null;

    if (category === 'health' && details.taskType === 'give-medication') {
      return (
        <View style={styles.detailsSection}>
          <Text style={styles.detailLabel}>
            💊 {details.medicineName} ({details.medicineType})
          </Text>
          {details.dosages && details.dosages.length > 0 && (
            <Text style={styles.detailSmall}>
              Doses: {details.dosages.map((d: any) => d.label).join(', ')}
            </Text>
          )}
        </View>
      );
    }

    if (category === 'health' && details.taskType === 'take-observational-tool') {
      return (
        <View style={styles.detailsSection}>
          <Text style={styles.detailLabel}>📋 Tool: {details.toolType}</Text>
        </View>
      );
    }

    if ((category === 'hygiene' || category === 'dietary') && details.description) {
      return (
        <View style={styles.detailsSection}>
          <Text style={styles.detailSmall} numberOfLines={1}>
            {details.description}
          </Text>
        </View>
      );
    }

    return null;
  };

  const avatars = [];
  if (companionAvatar) {
    avatars.push({uri: companionAvatar});
  } else {
    // Show placeholder with companion name initial
    avatars.push({placeholder: companionName.charAt(0).toUpperCase()});
  }
  if (assignedToName) {
    if (assignedToAvatar) {
      avatars.push({uri: assignedToAvatar});
    } else {
      // Show placeholder with assigned user name initial
      avatars.push({placeholder: assignedToName.charAt(0).toUpperCase()});
    }
  }

  return (
    <SwipeableActionCard
      cardStyle={cardStyles.card}
      fallbackStyle={cardStyles.fallback}
      onPressView={onPressView}
      onPressEdit={onPressEdit}
      showEditAction={showEditAction && !isCompleted}
      hideSwipeActions={hideSwipeActions}
    >
      <TouchableOpacity
        activeOpacity={onPressView ? 0.85 : 1}
        onPress={onPressView}
        style={styles.innerContent}>
        <View style={styles.infoRow}>
          {avatars.length > 0 && (
            <AvatarGroup
              avatars={avatars}
              size={40}
              overlap={-15}
            />
          )}

          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              {companionName}
            </Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
              {formattedDate}
              {formattedTime && ` - ${formattedTime}`}
            </Text>
            {renderTaskDetails()}
          </View>

          <View style={styles.statusColumn}>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>Completed</Text>
              </View>
            )}
          </View>
        </View>

        {showCompleteButton && !isCompleted && (
          <>
            {completeButtonVariant === 'liquid-glass' ? (
              <LiquidGlassButton
                title={completeButtonLabel}
                onPress={onPressComplete!}
                tintColor={theme.colors.secondary}
                shadowIntensity="medium"
                height={48}
                textStyle={styles.liquidGlassButtonText}
                borderRadius={12}
                style={styles.liquidGlassButton}
              />
            ) : (
              <CardActionButton
                label={completeButtonLabel}
                onPress={onPressComplete!}
                variant={completeButtonVariant}
              />
            )}
          </>
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
    textContent: {
      flex: 1,
      gap: theme.spacing[1],
    },
    title: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    meta: {
      ...theme.typography.captionBoldSatoshi,
      color: theme.colors.textSecondary,
    },
    statusColumn: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minWidth: 70,
    },
    completedBadge: {
      paddingHorizontal: theme.spacing[2],
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(0, 143, 93, 0.12)',
    },
    completedText: {
      ...theme.typography.labelSmall,
      color: theme.colors.success,
    },
    detailsSection: {
      marginTop: theme.spacing[2],
      paddingTop: theme.spacing[2],
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderMuted,
      gap: theme.spacing[1],
    },
    detailLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    detailSmall: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
    },
    liquidGlassButton: {
      marginTop: theme.spacing[4],
    },
    liquidGlassButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
  });

export default TaskCard;
