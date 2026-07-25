import React, {useEffect, useMemo, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {SwipeableActionCard} from '@/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {useTheme} from '@/hooks';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/dateTimeFormat';
import {createCardStyles} from '@/shared/components/common/cardStyles';
import type {
  TaskCategory,
  TaskStatus,
  HygieneTaskType,
  DietaryTaskType,
} from '@/features/tasks/types';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {
  resolveObservationalToolLabel,
  resolveHygieneTaskTypeLabel,
  resolveDietaryTaskTypeLabel,
} from '@/features/tasks/utils/taskLabels';
import {observationToolApi} from '@/features/observationalTools/services/observationToolService';
import type {Theme} from '@/theme';

const calculateNearestDosageTime = (
  dosages: Array<{time: string; dosage: string}>,
): string | null => {
  if (!dosages || dosages.length === 0) return null;

  const now = new Date();
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

  const dosageTimes = dosages
    .map(dosage => {
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
    })
    .filter(
      (dt): dt is {totalMinutes: number; originalTime: string} => dt !== null,
    );

  if (dosageTimes.length === 0) return null;

  const futureItems = dosageTimes.filter(
    dt => dt.totalMinutes > currentTimeInMinutes,
  );
  const upcomingToday =
    futureItems.length > 0
      ? futureItems.reduce(
          (min, dt) => (dt.totalMinutes < min.totalMinutes ? dt : min),
          futureItems[0],
        )
      : undefined;

  if (upcomingToday) return upcomingToday.originalTime;

  const earliestDosage = dosageTimes.reduce(
    (min, dt) => (dt.totalMinutes < min.totalMinutes ? dt : min),
    dosageTimes[0],
  );
  return earliestDosage.originalTime;
};

type TileVisual = {
  icon: string;
  bg: keyof Theme['colors'];
  ink: keyof Theme['colors'];
};

// Warm-bone category tile: the leading 40x40 tinted tile's colour pair + glyph
// come from the task category (and its sub-type for hygiene), mirroring the
// avatar tint vocabulary used across the redesigned mobile surfaces.
const resolveTileVisual = (
  category: TaskCategory,
  taskType: string | undefined,
): TileVisual => {
  if (category === 'health') {
    if (taskType === 'take-observational-tool') {
      return {
        icon: 'pulse-outline',
        bg: 'avatarVioletBg',
        ink: 'avatarVioletInk',
      };
    }
    return {icon: 'medkit-outline', bg: 'avatarAmberBg', ink: 'avatarAmberInk'};
  }

  if (category === 'hygiene') {
    if (taskType === 'take-exercise') {
      return {icon: 'walk-outline', bg: 'avatarGreenBg', ink: 'avatarGreenInk'};
    }
    return {icon: 'sparkles-outline', bg: 'pinkGlow', ink: 'pink'};
  }

  if (category === 'dietary') {
    return {
      icon: 'nutrition-outline',
      bg: 'avatarGreenBg',
      ink: 'avatarGreenInk',
    };
  }

  if (category === 'custom') {
    return {
      icon: 'create-outline',
      bg: 'avatarVioletBg',
      ink: 'avatarVioletInk',
    };
  }

  return {icon: 'checkbox-outline', bg: 'blueSoft', ink: 'blueText'};
};

type TaskCardAvatar = {uri?: string; placeholder?: string; role: string};

// Task-type label for the middle meta segment. Kept at module scope so the
// TaskCard component stays within the cognitive-complexity budget.
const resolveTaskTypeLabel = (
  category: TaskCategory,
  taskType: string | undefined,
  resolvedOtLabel: string | null,
  subcategoryLabel: string | undefined,
): string | null => {
  if (category === 'health') {
    if (taskType === 'give-medication') return 'Give medication';
    if (taskType === 'take-observational-tool') {
      return resolvedOtLabel ?? 'Observational tool';
    }
    if (taskType === 'vaccination') return 'Vaccination';
  }
  if (category === 'hygiene' && taskType) {
    return resolveHygieneTaskTypeLabel(taskType as HygieneTaskType);
  }
  if (category === 'dietary' && taskType) {
    return resolveDietaryTaskTypeLabel(taskType as DietaryTaskType);
  }
  return subcategoryLabel ?? null;
};

// Trailing context segment (done-time / dosage / companion / date). Kept at
// module scope so the TaskCard component stays within the complexity budget.
const resolveContextLabel = (
  isCompleted: boolean,
  formattedTime: string | null,
  isMedicationTask: boolean,
  formattedNearestDosage: string | null,
  companionName: string,
  formattedDate: string,
): string | null => {
  if (isCompleted) {
    return formattedTime ? `done ${formattedTime}` : 'done';
  }
  if (isMedicationTask && formattedNearestDosage) {
    return formattedNearestDosage;
  }
  if (formattedTime) return formattedTime;
  if (companionName) return companionName;
  return formattedDate;
};

// Companion + optional assignee avatars (image or initial placeholder). Kept at
// module scope so the TaskCard component stays within the complexity budget.
const buildTaskCardAvatars = (
  companionAvatar: string | undefined,
  companionName: string,
  assignedToName: string | undefined,
  assignedToAvatar: string | undefined,
): TaskCardAvatar[] => {
  const avatars: TaskCardAvatar[] = [];
  const companionAvatarUri = normalizeImageUri(companionAvatar ?? undefined);
  if (companionAvatarUri) {
    avatars.push({uri: companionAvatarUri, role: 'companion'});
  } else {
    avatars.push({
      placeholder: companionName.charAt(0).toUpperCase(),
      role: 'companion',
    });
  }
  if (assignedToName) {
    const assignedAvatarUri = normalizeImageUri(assignedToAvatar ?? undefined);
    if (assignedAvatarUri) {
      avatars.push({uri: assignedAvatarUri, role: 'assignee'});
    } else {
      avatars.push({
        placeholder: assignedToName.charAt(0).toUpperCase(),
        role: 'assignee',
      });
    }
  }
  return avatars;
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
  categoryLabel,
  subcategoryLabel,
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
  completeButtonVariant: _completeButtonVariant = 'liquid-glass',
  completeButtonLabel = 'Mark complete',
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
  const isMedicationTask =
    category === 'health' && details?.taskType === 'give-medication';
  const nearestDosageTime = useMemo(() => {
    if (!isMedicationTask || !details?.dosages) return null;
    return calculateNearestDosageTime(details.dosages);
  }, [isMedicationTask, details?.dosages]);

  const observationalToolLabel = useMemo(() => {
    if (
      category !== 'health' ||
      details?.taskType !== 'take-observational-tool'
    ) {
      return null;
    }
    const raw = details.toolType;
    const resolved = resolveObservationalToolLabel(raw);
    const looksLikeId =
      typeof resolved === 'string' && /^[a-f0-9]{24}$/i.test(resolved);
    return looksLikeId ? 'Observational tool' : resolved;
  }, [category, details]);

  const [resolvedOtLabel, setResolvedOtLabel] = useState<string | null>(
    observationalToolLabel,
  );

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
      if (
        observationalToolLabel &&
        observationalToolLabel !== 'Observational tool'
      ) {
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
  const isObservationalToolTask =
    category === 'health' && details?.taskType === 'take-observational-tool';
  const handleCompletePress =
    isObservationalToolTask && onPressTakeObservationalTool
      ? onPressTakeObservationalTool
      : onPressComplete;

  // Leading tinted tile (colour pair + glyph) driven by the task category.
  const tileVisual = useMemo(
    () => resolveTileVisual(category, details?.taskType),
    [category, details?.taskType],
  );

  // Task-type label for the middle segment of the meta line.
  const typeLabel = useMemo(
    () =>
      resolveTaskTypeLabel(
        category,
        details?.taskType,
        resolvedOtLabel,
        subcategoryLabel,
      ),
    [category, details?.taskType, resolvedOtLabel, subcategoryLabel],
  );

  // Trailing context segment: done-time when finished, dosage/task time when
  // scheduled, otherwise the companion the task belongs to.
  const contextLabel = useMemo(
    () =>
      resolveContextLabel(
        isCompleted,
        formattedTime,
        isMedicationTask,
        formattedNearestDosage,
        companionName,
        formattedDate,
      ),
    [
      isCompleted,
      formattedTime,
      isMedicationTask,
      formattedNearestDosage,
      companionName,
      formattedDate,
    ],
  );

  const metaLine = [categoryLabel, typeLabel, contextLabel]
    .filter(Boolean)
    .join(' · ');

  const avatars = buildTaskCardAvatars(
    companionAvatar,
    companionName,
    assignedToName,
    assignedToAvatar,
  );

  const showTakePill =
    isObservationalToolTask &&
    showCompleteButton &&
    !isCompleted &&
    Boolean(handleCompletePress);
  const showActionRow =
    showCompleteButton &&
    !isCompleted &&
    !isObservationalToolTask &&
    Boolean(handleCompletePress);

  return (
    <SwipeableActionCard
      cardStyle={[cardStyles.card, isCompleted && styles.completedCard]}
      fallbackStyle={[cardStyles.fallback, isCompleted && styles.completedCard]}
      onPressView={onPressView}
      onPressEdit={onPressEdit}
      showEditAction={showEditAction && !isCompleted}
      hideSwipeActions={hideSwipeActions}>
      <PressableOpacity
        activeOpacity={onPressView ? 0.85 : 1}
        onPress={onPressView}
        style={styles.innerContent}
        accessibilityRole={onPressView ? 'button' : undefined}
        accessibilityLabel={title}>
        <View style={styles.infoRow}>
          <TaskCardTile tileVisual={tileVisual} theme={theme} styles={styles} />

          <View style={styles.textContent}>
            <Text
              style={[styles.title, isCompleted && styles.titleCompleted]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </Text>
            {metaLine.length > 0 && (
              <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
                {metaLine}
              </Text>
            )}
          </View>

          <View style={styles.trailing}>
            <TaskCardTrailing
              isCompleted={isCompleted}
              showTakePill={showTakePill}
              avatars={avatars}
              handleCompletePress={handleCompletePress}
              theme={theme}
              styles={styles}
            />
          </View>
        </View>

        {showActionRow && handleCompletePress && (
          <TaskCardActionRow
            handleCompletePress={handleCompletePress}
            completeButtonLabel={completeButtonLabel}
            showEditAction={showEditAction}
            onPressEdit={onPressEdit}
            theme={theme}
            styles={styles}
          />
        )}
      </PressableOpacity>
    </SwipeableActionCard>
  );
};

type TaskCardStyles = ReturnType<typeof createStyles>;

interface TaskCardTileProps {
  tileVisual: TileVisual;
  theme: Theme;
  styles: TaskCardStyles;
}

// Leading 40x40 tinted category tile (colour pair + glyph).
const TaskCardTile: React.FC<TaskCardTileProps> = ({
  tileVisual,
  theme,
  styles,
}) => (
  <View
    style={[styles.iconTile, {backgroundColor: theme.colors[tileVisual.bg]}]}>
    <Ionicons
      name={tileVisual.icon}
      size={18}
      color={theme.colors[tileVisual.ink]}
    />
  </View>
);

interface TaskCardTrailingProps {
  isCompleted: boolean;
  showTakePill: boolean;
  avatars: TaskCardAvatar[];
  handleCompletePress?: () => void;
  theme: Theme;
  styles: TaskCardStyles;
}

// Trailing slot: completed check-circle, "Take" pill, or the avatar stack.
const TaskCardTrailing: React.FC<TaskCardTrailingProps> = ({
  isCompleted,
  showTakePill,
  avatars,
  handleCompletePress,
  theme,
  styles,
}) => {
  if (isCompleted) {
    return (
      <View style={styles.checkCircle}>
        <Ionicons name="checkmark" size={14} color={theme.colors.white} />
      </View>
    );
  }
  if (showTakePill) {
    return (
      <PressableOpacity
        activeOpacity={0.85}
        onPress={handleCompletePress}
        style={styles.takePill}
        accessibilityRole="button"
        accessibilityLabel="Take">
        <Text style={styles.takePillText}>Take</Text>
      </PressableOpacity>
    );
  }
  if (avatars.length > 0) {
    return (
      <View style={styles.avatarStack}>
        {avatars.map((avatar, index) => {
          const overlapStyle = index === 0 ? null : styles.avatarOverlap;
          if (avatar.uri) {
            return (
              <Image
                key={avatar.role}
                source={{uri: avatar.uri}}
                style={[styles.avatarImage, overlapStyle]}
              />
            );
          }
          return (
            <View
              key={avatar.role}
              style={[styles.avatarPlaceholder, overlapStyle]}>
              <Text style={styles.avatarInitial}>{avatar.placeholder}</Text>
            </View>
          );
        })}
      </View>
    );
  }
  return null;
};

interface TaskCardActionRowProps {
  handleCompletePress: () => void;
  completeButtonLabel: string;
  showEditAction: boolean;
  onPressEdit?: () => void;
  theme: Theme;
  styles: TaskCardStyles;
}

// Bottom action row: the "Mark complete" cta pill and optional edit ellipsis.
const TaskCardActionRow: React.FC<TaskCardActionRowProps> = ({
  handleCompletePress,
  completeButtonLabel,
  showEditAction,
  onPressEdit,
  theme,
  styles,
}) => (
  <View style={styles.actionRow}>
    <PressableOpacity
      activeOpacity={0.85}
      onPress={handleCompletePress}
      style={styles.completePill}
      accessibilityRole="button"
      accessibilityLabel={completeButtonLabel}>
      <Ionicons name="checkmark" size={15} color={theme.colors.ctaText} />
      <Text style={styles.completePillText}>{completeButtonLabel}</Text>
    </PressableOpacity>
    {showEditAction && onPressEdit && (
      <PressableOpacity
        activeOpacity={0.85}
        onPress={onPressEdit}
        style={styles.ellipsisButton}
        accessibilityRole="button"
        accessibilityLabel="More options">
        <Ionicons
          name="ellipsis-horizontal"
          size={16}
          color={theme.colors.inkBody}
        />
      </PressableOpacity>
    )}
  </View>
);

const createStyles = (theme: any) =>
  StyleSheet.create({
    innerContent: {
      width: '100%',
    },
    completedCard: {
      opacity: 0.6,
      ...theme.shadows.none,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    iconTile: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContent: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 14.5,
      fontWeight: '700',
      color: theme.colors.inkBody,
    },
    titleCompleted: {
      textDecorationLine: 'line-through',
    },
    meta: {
      fontSize: 12.5,
      color: theme.colors.inkFaint,
    },
    trailing: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    checkCircle: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    takePill: {
      paddingHorizontal: theme.spacing['3.5'],
      paddingVertical: theme.spacing['2'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blueSoft,
    },
    takePillText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.navActive,
    },
    avatarStack: {
      alignItems: 'center',
    },
    avatarImage: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.colors.screen,
      resizeMode: 'cover',
    },
    avatarPlaceholder: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.colors.screen,
      backgroundColor: theme.colors.avatarVioletBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarOverlap: {
      marginTop: -theme.spacing['2'],
    },
    avatarInitial: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.avatarVioletInk,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
      marginTop: theme.spacing['3'],
    },
    completePill: {
      flex: 1,
      height: theme.spacing['10'],
      borderRadius: 12,
      backgroundColor: theme.colors.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
    },
    completePillText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.ctaText,
    },
    ellipsisButton: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: 12,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default TaskCard;
