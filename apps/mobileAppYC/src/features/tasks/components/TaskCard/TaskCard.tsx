import React, {useEffect, useMemo, useState} from 'react';
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
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';
import {observationToolApi} from '@/features/observationalTools/services/observationToolService';

const calculateNearestDosageTime = (dosages: Array<{time: string; dosage: string}>): string | null => {
  if (!dosages || dosages.length === 0) return null;

  const now = new Date();
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

  const dosageTimes = dosages.map((dosage) => {
    try {
      const [hours, minutes] = dosage.time.split(':').map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
      return {
        totalMinutes: hours * 60 + minutes,
        originalTime: dosage.time,
      };
    } catch {
      return null;
    }
  }).filter((dt): dt is {totalMinutes: number; originalTime: string} => dt !== null);

  if (dosageTimes.length === 0) return null;

  const upcomingToday = dosageTimes
    .filter((dt) => dt.totalMinutes > currentTimeInMinutes)
    .sort((a, b) => a.totalMinutes - b.totalMinutes)[0];

  if (upcomingToday) return upcomingToday.originalTime;

  const sortedDosages = [...dosageTimes].sort((a, b) => a.totalMinutes - b.totalMinutes);
  const earliestDosage = sortedDosages[0];
  return earliestDosage.originalTime;
};

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
  onPressTakeObservationalTool?: () => void;
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
  onPressTakeObservationalTool,
  showEditAction = true,
  showCompleteButton = false,
  completeButtonVariant = 'liquid-glass',
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

  // Calculate nearest dosage time for medication tasks
  // For medication tasks, always use dosage times instead of task time
  const isMedicationTask = category === 'health' && details?.taskType === 'give-medication';
  const nearestDosageTime = useMemo(() => {
    if (!isMedicationTask || !details?.dosages) return null;
    return calculateNearestDosageTime(details.dosages);
  }, [isMedicationTask, details?.dosages]);

  const observationalToolLabel = useMemo(() => {
    if (category !== 'health' || details?.taskType !== 'take-observational-tool') {
      return null;
    }
    const raw = details.toolType;
    const resolved = resolveObservationalToolLabel(raw);
    const looksLikeId = typeof resolved === 'string' && /^[a-f0-9]{24}$/i.test(resolved);
    return looksLikeId ? 'Observational tool' : resolved;
  }, [category, details]);

  const [resolvedOtLabel, setResolvedOtLabel] = useState<string | null>(observationalToolLabel);

  useEffect(() => {
    let active = true;
    const maybeFetchOt = async () => {
      if (
        category !== 'health' ||
        details?.taskType !== 'take-observational-tool' ||
        !details.toolType
      ) {
        return;
      }
      if (observationalToolLabel && observationalToolLabel !== 'Observational tool') {
        setResolvedOtLabel(observationalToolLabel);
        return;
      }
      try {
        const def = await observationToolApi.get(details.toolType);
        if (active && def?.name) {
          setResolvedOtLabel(def.name);
        }
      } catch {
        if (active) {
          setResolvedOtLabel('Observational tool');
        }
      }
    };
    maybeFetchOt();
    return () => {
      active = false;
    };
  }, [category, details, observationalToolLabel]);

  const formattedNearestDosage = useMemo(() => {
    if (!nearestDosageTime) return null;
    try {
      const [hours, minutes] = nearestDosageTime.split(':').map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
      const timeDate = new Date();
      timeDate.setHours(hours, minutes, 0);
      return timeDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return null;
    }
  }, [nearestDosageTime]);

  const isCompleted = String(status).toUpperCase() === 'COMPLETED';
  const isPending = String(status).toUpperCase() === 'PENDING';
  const isCancelled = String(status).toUpperCase() === 'CANCELLED';
  const isObservationalToolTask =
    category === 'health' && details?.taskType === 'take-observational-tool';
  const handleCompletePress =
    isObservationalToolTask && onPressTakeObservationalTool
      ? onPressTakeObservationalTool
      : onPressComplete;

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
          <Text style={styles.detailLabel}>📋 Tool: {resolvedOtLabel ?? 'Observational tool'}</Text>
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
  const companionAvatarUri = normalizeImageUri(companionAvatar ?? undefined);
  if (companionAvatarUri) {
    avatars.push({uri: companionAvatarUri});
  } else {
    // Show placeholder with companion name initial
    avatars.push({placeholder: companionName.charAt(0).toUpperCase()});
  }
  if (assignedToName) {
    const assignedAvatarUri = normalizeImageUri(assignedToAvatar ?? undefined);
    if (assignedAvatarUri) {
      avatars.push({uri: assignedAvatarUri});
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
              size={theme.spacing['14']}
              overlap={-theme.spacing['2.5']}
              direction="column"
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
              {isMedicationTask && formattedNearestDosage && ` - ${formattedNearestDosage}`}
              {!isMedicationTask && formattedTime && ` - ${formattedTime}`}
            </Text>
            {renderTaskDetails()}
          </View>

          <View style={styles.statusColumn}>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>Completed</Text>
              </View>
            )}
            {isPending && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
            {isCancelled && (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledText}>Cancelled</Text>
              </View>
            )}
          </View>
        </View>

        {showCompleteButton && !isCompleted && handleCompletePress && (
          <>
            {completeButtonVariant === 'liquid-glass' ? (
              <LiquidGlassButton
                title={completeButtonLabel}
                onPress={handleCompletePress}
                tintColor={theme.colors.secondary}
                shadowIntensity="medium"
                height={theme.spacing['12']}
                textStyle={styles.liquidGlassButtonText}
                borderRadius={theme.borderRadius.md}
                style={styles.liquidGlassButton}
              />
            ) : (
              <CardActionButton
                label={completeButtonLabel}
                onPress={handleCompletePress}
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
      gap: theme.spacing['3'],
    },
    textContent: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    title: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    meta: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    statusColumn: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minWidth: theme.spacing['18'],
    },
    completedBadge: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.successSurface,
    },
    completedText: {
      ...theme.typography.labelSmall,
      color: theme.colors.success,
    },
    pendingBadge: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.warningSurface,
    },
    pendingText: {
      ...theme.typography.labelSmall,
      color: theme.colors.warning,
    },
    cancelledBadge: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.errorSurface,
    },
    cancelledText: {
      ...theme.typography.labelSmall,
      color: theme.colors.error,
    },
    detailsSection: {
      marginTop: theme.spacing['2'],
      paddingTop: theme.spacing['2'],
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderMuted,
      gap: theme.spacing['1'],
    },
    detailLabel: {
      ...theme.typography.labelSmall,
      color: theme.colors.secondary,
    },
    detailSmall: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    liquidGlassButton: {
      marginTop: theme.spacing['4'],
    },
    liquidGlassButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
    },
  });

export default TaskCard;
