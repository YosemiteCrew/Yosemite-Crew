import React, {useMemo} from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SwipeableGlassCard} from '@/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import type {TaskCategory, TaskStatus} from '@/features/tasks/types';

const ACTION_WIDTH = 65;
const OVERLAP_WIDTH = 12;
const TOTAL_ACTION_WIDTH = ACTION_WIDTH * 2;

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
  hideSwipeActions = false,
  category,
  details,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
      if (isNaN(hours) || isNaN(minutes)) return time;
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
  const visibleActionWidth = showEditAction ? TOTAL_ACTION_WIDTH : ACTION_WIDTH;
  const totalActionWidth = OVERLAP_WIDTH + visibleActionWidth;

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
      actionContainerStyle={
        hideSwipeActions ? styles.hiddenActionContainer : styles.actionContainer
      }
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
                    style={[
                      styles.actionButton,
                      styles.editActionButton,
                      {width: ACTION_WIDTH},
                    ]}
                    onPress={() => {
                      close();
                      onPressEdit?.();
                    }}>
                    <Image source={Images.editIconSlide} style={styles.actionIcon} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.actionButton,
                    styles.viewActionButton,
                    {width: ACTION_WIDTH},
                  ]}
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
          <View style={styles.avatarGroup}>
            {companionAvatar ? (
              <Image
                source={{uri: companionAvatar}}
                style={[styles.avatar, styles.avatarFirst]}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, styles.avatarFirst]}>
                <Text style={styles.avatarInitial}>
                  {companionName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {assignedToName && (
              assignedToAvatar ? (
                <Image
                  source={{uri: assignedToAvatar}}
                  style={[styles.avatar, styles.avatarSubsequent]}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, styles.avatarSubsequent]}>
                  <Text style={styles.avatarInitial}>
                    {assignedToName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )
            )}
          </View>

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
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.completeButton}
            onPress={onPressComplete}>
            <Text style={styles.completeLabel}>Complete</Text>
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
    avatarGroup: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.colors.white,
      resizeMode: 'cover',
    },
    avatarFirst: {
      marginLeft: 0,
    },
    avatarSubsequent: {
      marginLeft: -15,
    },
    avatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.colors.white,
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      ...theme.typography.titleSmall,
      color: theme.colors.primary,
      fontWeight: '700',
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
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
      marginTop: theme.spacing[3],
      backgroundColor: theme.colors.white,
      minHeight: 45,
    },
    completeLabel: {
      ...theme.typography.button,
      color: theme.colors.secondary,
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
  });

export default TaskCard;
