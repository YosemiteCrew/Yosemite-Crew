import React, {useEffect, useMemo, useCallback} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {StyleProp, ViewStyle, TextStyle} from 'react-native';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {ViewMoreButton} from '@/shared/components/common/ViewMoreButton/ViewMoreButton';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {TaskCard} from '@/features/tasks/components';
import {TaskMonthDateSelector} from '@/features/tasks/components/shared/TaskMonthDateSelector';
import {EmptyTasksScreen} from '../EmptyTasksScreen/EmptyTasksScreen';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';
import {fetchTasksForCompanion} from '@/features/tasks';
import {
  selectHasHydratedCompanion,
  selectRecentTasksByCategory,
  selectTaskCountByCategory,
  selectTasksByCompanion,
  selectTasksLoadFailure,
  taskOccursOnDate,
} from '@/features/tasks/selectors';
import {ListErrorState} from '@/shared/components/common/ListErrorState/ListErrorState';
import {resolveListPhase} from '@/shared/utils/listPhase';
import {selectAuthUser} from '@/features/auth/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {Task, TaskCategory} from '@/features/tasks/types';
import type {Companion} from '@/features/companion/types';
import type {User} from '@/features/auth/types';
import type {Theme} from '@/theme';
import {resolveCategoryLabel} from '@/features/tasks/utils/taskLabels';
import {useCommonScreenStyles} from '@/shared/utils/screenStyles';
import {useTaskDateSelection} from '@/features/tasks/hooks/useTaskDateSelection';
import {getTaskCardMeta} from '@/features/tasks/utils/taskCardHelpers';
import {useTaskNavigationActions} from '@/features/tasks/hooks/useTaskNavigationActions';
import {formatDateToISODate, isToday} from '@/shared/utils/dateHelpers';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'TasksMain'>;
type Route = RouteProp<TaskStackParamList, 'TasksMain'>;

const parseAutoSelectDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsedLocal = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      0,
      0,
      0,
      0,
    );
    return Number.isNaN(parsedLocal.getTime()) ? null : parsedLocal;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const TASK_CATEGORIES: TaskCategory[] = [
  'health',
  'hygiene',
  'dietary',
  'custom',
];
const CATEGORY_ORDER_INDEX: Record<TaskCategory, number> = {
  health: 0,
  hygiene: 1,
  dietary: 2,
  custom: 3,
};

export const TasksMainScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const summaryStyles = useMemo(() => createSummaryStyles(theme), [theme]);
  const styles = useCommonScreenStyles(theme, createTaskScreenStyles);

  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const authUser = useSelector(selectAuthUser);
  const selectedCompanion = useMemo(
    () => companions.find(c => c.id === selectedCompanionId),
    [companions, selectedCompanionId],
  );

  const {
    selectedDate,
    currentMonth,
    handleDateSelect,
    handleMonthChange,
    setCurrentMonth,
  } = useTaskDateSelection();
  const taskActions = useTaskNavigationActions(navigation, dispatch);

  const hasHydrated = useSelector(
    selectHasHydratedCompanion(selectedCompanionId ?? null),
  );

  // Get all tasks for the selected companion
  const tasksLoadFailure = useSelector(
    selectTasksLoadFailure(selectedCompanionId),
  );
  const tasksLoading = useSelector((state: RootState) => state.tasks.loading);
  const allTasks = useSelector(
    selectTasksByCompanion(selectedCompanionId ?? null),
  );

  // Get dates with tasks for the selected companion (respects recurrence patterns)
  const datesWithTasks = useMemo(() => {
    const dateSet = new Set<string>();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (const task of allTasks) {
      if (task.frequency === 'once' || !task.frequency) {
        dateSet.add(task.date);
      } else {
        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(year, month, day);
          const dateStr = formatDateToISODate(d);
          if (taskOccursOnDate(task, dateStr)) {
            dateSet.add(dateStr);
          }
        }
      }
    }
    return dateSet;
  }, [allTasks, currentMonth]);

  // Fetch tasks and counts for all categories at component level
  const healthTasks = useSelector(
    selectRecentTasksByCategory(selectedCompanionId, selectedDate, 'health', 1),
  );
  const healthCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, selectedDate, 'health'),
  );
  const hygieneTasks = useSelector(
    selectRecentTasksByCategory(
      selectedCompanionId,
      selectedDate,
      'hygiene',
      1,
    ),
  );
  const hygieneCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, selectedDate, 'hygiene'),
  );
  const dietaryTasks = useSelector(
    selectRecentTasksByCategory(
      selectedCompanionId,
      selectedDate,
      'dietary',
      1,
    ),
  );
  const dietaryCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, selectedDate, 'dietary'),
  );
  const customTasks = useSelector(
    selectRecentTasksByCategory(selectedCompanionId, selectedDate, 'custom', 1),
  );
  const customCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, selectedDate, 'custom'),
  );

  const categoryData = useMemo(
    () => ({
      health: {recentTasks: healthTasks, taskCount: healthCount},
      hygiene: {recentTasks: hygieneTasks, taskCount: hygieneCount},
      dietary: {recentTasks: dietaryTasks, taskCount: dietaryCount},
      custom: {recentTasks: customTasks, taskCount: customCount},
    }),
    [
      healthTasks,
      healthCount,
      hygieneTasks,
      hygieneCount,
      dietaryTasks,
      dietaryCount,
      customTasks,
      customCount,
    ],
  );

  const orderedCategories = useMemo(() => {
    return [...TASK_CATEGORIES].sort((firstCategory, secondCategory) => {
      const firstHasTasks = categoryData[firstCategory].taskCount > 0;
      const secondHasTasks = categoryData[secondCategory].taskCount > 0;

      if (firstHasTasks === secondHasTasks) {
        return (
          CATEGORY_ORDER_INDEX[firstCategory] -
          CATEGORY_ORDER_INDEX[secondCategory]
        );
      }

      return firstHasTasks ? -1 : 1;
    });
  }, [categoryData]);

  // Progress summary for the selected date, derived from real task data.
  const tasksForSelectedDate = useMemo(() => {
    const dateStr = formatDateToISODate(selectedDate);
    return allTasks.filter(task => taskOccursOnDate(task, dateStr));
  }, [allTasks, selectedDate]);

  const {doneCount, totalCount, progressPercent} = useMemo(() => {
    const total = tasksForSelectedDate.length;
    const done = tasksForSelectedDate.filter(
      task => String(task.status).toUpperCase() === 'COMPLETED',
    ).length;
    return {
      doneCount: done,
      totalCount: total,
      progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [tasksForSelectedDate]);

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  // Four states, not two. An empty `allTasks` used to mean "no tasks yet" no
  // matter why it was empty, so a failed fetch rendered the same "add your
  // first task" prompt as a brand new companion.
  const taskListPhase = useMemo(
    () =>
      resolveListPhase({
        loading: tasksLoading,
        loadError: tasksLoadFailure,
        hasLoaded: hasHydrated,
        itemCount: allTasks.length,
      }),
    [tasksLoading, tasksLoadFailure, hasHydrated, allTasks.length],
  );

  const refetchTasks = useCallback(() => {
    if (!selectedCompanionId) {
      return;
    }
    dispatch(fetchTasksForCompanion({companionId: selectedCompanionId}));
  }, [dispatch, selectedCompanionId]);

  useFocusEffect(
    useCallback(() => {
      if (!selectedCompanionId || hasHydrated) {
        return;
      }
      refetchTasks();
    }, [selectedCompanionId, hasHydrated, refetchTasks]),
  );

  useEffect(() => {
    const dateFromRoute = parseAutoSelectDate(route.params?.autoSelectDate);
    if (!dateFromRoute) {
      return;
    }
    handleDateSelect(dateFromRoute);
    setCurrentMonth(
      new Date(dateFromRoute.getFullYear(), dateFromRoute.getMonth(), 1),
    );
    navigation.setParams({autoSelectDate: undefined});
  }, [
    handleDateSelect,
    navigation,
    route.params?.autoSelectDate,
    setCurrentMonth,
  ]);

  const handleCompanionSelect = (companionId: string | null) => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
  };

  const handleAddTask = () => {
    navigation.navigate('AddTask', {
      prefillDate: formatDateToISODate(selectedDate),
    });
  };

  const handleViewMore = (category: TaskCategory) => {
    navigation.navigate('TasksList', {category});
  };

  // Show empty screen if no companion is selected
  if (!selectedCompanionId) {
    return <EmptyTasksScreen />;
  }

  return (
    <LiquidGlassHeaderScreen
      header={<TasksScreenHeader onAddTask={handleAddTask} />}
      contentPadding={theme.spacing['3']}>
      {contentPaddingStyle => (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}>
          <CompanionSelector
            companions={companions}
            selectedCompanionId={selectedCompanionId}
            onSelect={handleCompanionSelect}
            showAddButton={false}
            containerStyle={styles.companionSelectorTask}
            requiredPermission="tasks"
            permissionLabel="tasks"
          />

          <TaskMonthDateSelector
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            datesWithTasks={datesWithTasks}
            onDateSelect={handleDateSelect}
            onMonthChange={handleMonthChange}
            theme={theme}
            autoScroll={true}
          />

          {/* Category Sections */}
          {taskListPhase === 'error' && (
            <ListErrorState testID="tasks-load-error" onRetry={refetchTasks} />
          )}
          {taskListPhase === 'empty' ? (
            <NoTasksEmptyState
              companionName={selectedCompanion?.name}
              styles={styles}
            />
          ) : null}
          {taskListPhase === 'ready' ? (
            <>
              {totalCount > 0 && (
                <TaskProgressSummary
                  styles={summaryStyles}
                  selectedDate={selectedDate}
                  doneCount={doneCount}
                  totalCount={totalCount}
                  progressPercent={progressPercent}
                />
              )}
              {orderedCategories.map(category => (
                <CategorySection
                  key={category}
                  category={category}
                  recentTasks={categoryData[category].recentTasks}
                  taskCount={categoryData[category].taskCount}
                  companions={companions}
                  authUser={authUser}
                  styles={styles}
                  onViewMore={handleViewMore}
                  taskActions={taskActions}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

interface TasksScreenHeaderProps {
  onAddTask: () => void;
}

const TasksScreenHeader: React.FC<TasksScreenHeaderProps> = ({onAddTask}) => (
  <Header
    title="Tasks"
    variant="root"
    showBackButton={false}
    rightIcon={Images.addIconDark}
    onRightPress={onAddTask}
    glass={false}
  />
);

interface NoTasksEmptyStateProps {
  companionName?: string;
  styles: {
    emptyStateContainer: StyleProp<ViewStyle>;
    emptyStateTitle: StyleProp<TextStyle>;
    emptyStateText: StyleProp<TextStyle>;
  };
}

const NoTasksEmptyState: React.FC<NoTasksEmptyStateProps> = ({
  companionName,
  styles,
}) => (
  <View style={styles.emptyStateContainer}>
    <Text style={styles.emptyStateTitle}>No tasks yet</Text>
    <Text style={styles.emptyStateText}>
      Start by adding a task for {companionName || 'your companion'}
    </Text>
  </View>
);

interface TaskProgressSummaryProps {
  styles: ReturnType<typeof createSummaryStyles>;
  selectedDate: Date;
  doneCount: number;
  totalCount: number;
  progressPercent: number;
}

const TaskProgressSummary: React.FC<TaskProgressSummaryProps> = ({
  styles,
  selectedDate,
  doneCount,
  totalCount,
  progressPercent,
}) => {
  const leadLabel = isToday(selectedDate)
    ? 'Today'
    : selectedDate.toLocaleDateString('en-US', {weekday: 'long'});
  const dateLabel = `${selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
  })} ${selectedDate.getDate()} ${selectedDate.toLocaleDateString('en-US', {
    month: 'short',
  })}`;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryLeft}>
        <Text style={styles.summaryHeadline}>
          {`${leadLabel}, ${doneCount} of ${totalCount} done`}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${progressPercent}%`}]} />
        </View>
      </View>
      <Text style={styles.summaryMeta}>{dateLabel}</Text>
    </View>
  );
};

interface CategorySectionProps {
  category: TaskCategory;
  recentTasks: Task[];
  taskCount: number;
  companions: Companion[];
  authUser: User | null;
  styles: {
    categorySection: StyleProp<ViewStyle>;
    categoryHeader: StyleProp<ViewStyle>;
    categoryTitle: StyleProp<TextStyle>;
    emptyCard: StyleProp<ViewStyle>;
    emptyText: StyleProp<TextStyle>;
  };
  onViewMore: (category: TaskCategory) => void;
  taskActions: ReturnType<typeof useTaskNavigationActions>;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  recentTasks,
  taskCount,
  companions,
  authUser,
  styles,
  onViewMore,
  taskActions,
}) => {
  const task = recentTasks[0];
  const companion = companions.find(c => c.id === task?.companionId);
  const taskMeta = task ? getTaskCardMeta(task, authUser) : null;

  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryTitle}>
          {resolveCategoryLabel(category)}
        </Text>
        {taskCount > 0 && (
          <ViewMoreButton onPress={() => onViewMore(category)} />
        )}
      </View>

      {task && companion ? (
        <TaskCard
          title={task.title}
          categoryLabel={resolveCategoryLabel(task.category)}
          subcategoryLabel={task.subcategory ? task.subcategory : undefined}
          date={task.date}
          time={task.time}
          companionName={companion.name}
          companionAvatar={companion.profileImage ?? undefined}
          assignedToName={taskMeta?.assignedToData?.name}
          assignedToAvatar={taskMeta?.assignedToData?.avatar}
          status={task.status}
          onPressView={() => taskActions.handleViewTask(task.id)}
          onPressEdit={() => taskActions.handleEditTask(task.id)}
          onPressComplete={() => taskActions.handleCompleteTask(task.id)}
          onPressTakeObservationalTool={
            taskMeta?.isObservationalToolTask
              ? () => taskActions.handleStartObservationalTool(task.id)
              : undefined
          }
          showEditAction={!taskMeta?.isCompleted && !taskMeta?.isCancelled}
          showCompleteButton={Boolean(taskMeta?.isPending)}
          category={task.category}
          details={task.details}
        />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No {resolveCategoryLabel(category).toLowerCase()} tasks
          </Text>
        </View>
      )}
    </View>
  );
};

const createTaskScreenStyles = (theme: Theme) => ({
  contentContainer: {
    paddingTop: theme.spacing['2'],
    paddingBottom: theme.spacing['28'],
  },
  companionSelectorTask: {
    marginTop: theme.spacing['2'],
    marginBottom: theme.spacing['1'],
    paddingHorizontal: theme.spacing['5'],
  },
  categorySection: {
    marginTop: theme.spacing['4.5'],
    paddingHorizontal: theme.spacing['5'],
  },
  categoryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: theme.spacing['2'],
  },
  categoryTitle: {
    ...theme.typography.eyebrow,
    color: theme.colors.inkMuted,
  },
  emptyCard: {
    backgroundColor: theme.colors.screen,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    paddingVertical: theme.spacing['5'],
    paddingHorizontal: theme.spacing['4'],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyText: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkMuted,
  },
  emptyStateContainer: {
    marginHorizontal: theme.spacing['5'],
    marginTop: theme.spacing['8'],
    paddingVertical: theme.spacing['10'],
    paddingHorizontal: theme.spacing['5'],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyStateTitle: {
    ...theme.typography.emptyStateTitle,
    color: theme.colors.ink,
    marginBottom: theme.spacing['2'],
    textAlign: 'center' as const,
  },
  emptyStateText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.inkMuted,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
});

const createSummaryStyles = (theme: any) =>
  StyleSheet.create({
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['1'],
      marginBottom: theme.spacing['2'],
      marginHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['4'],
      backgroundColor: theme.colors.screen,
      borderRadius: theme.borderRadius.cardSmall,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      ...theme.shadows.card,
    },
    summaryLeft: {
      flex: 1,
    },
    summaryHeadline: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.inkBody,
    },
    progressTrack: {
      height: 6,
      marginTop: theme.spacing['2'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.inset,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blue,
    },
    summaryMeta: {
      ...theme.typography.caption,
      color: theme.colors.inkMuted,
    },
  });
