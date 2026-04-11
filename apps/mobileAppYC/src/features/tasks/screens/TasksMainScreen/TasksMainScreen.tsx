import React, {useEffect, useMemo, useCallback} from 'react';
import {ScrollView, Text, View} from 'react-native';
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
} from '@/features/tasks/selectors';
import {selectAuthUser} from '@/features/auth/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {TaskCategory} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/features/tasks/utils/taskLabels';
import {useCommonScreenStyles} from '@/shared/utils/screenStyles';
import {useTaskDateSelection} from '@/features/tasks/hooks/useTaskDateSelection';
import {getTaskCardMeta} from '@/features/tasks/utils/taskCardHelpers';
import {useTaskNavigationActions} from '@/features/tasks/hooks/useTaskNavigationActions';
import {formatDateToISODate} from '@/shared/utils/dateHelpers';

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
  const styles = useCommonScreenStyles(theme, themeArg => ({
    contentContainer: {
      paddingTop: themeArg.spacing['2'],
      paddingBottom: themeArg.spacing['28'],
    },
  }));

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
  const {
    handleViewTask,
    handleEditTask,
    handleCompleteTask,
    handleStartObservationalTool,
  } = useTaskNavigationActions(navigation, dispatch);

  const hasHydrated = useSelector(
    selectHasHydratedCompanion(selectedCompanionId ?? null),
  );

  // Get all tasks for the selected companion
  const allTasks = useSelector(
    selectTasksByCompanion(selectedCompanionId ?? null),
  );

  // Get dates with tasks for the selected companion
  const datesWithTasks = useMemo(() => {
    const dateSet = new Set<string>();
    for (const task of allTasks) {
      dateSet.add(task.date); // date is in YYYY-MM-DD format
    }
    return dateSet;
  }, [allTasks]);

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

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (!selectedCompanionId || hasHydrated) {
        return;
      }
      dispatch(fetchTasksForCompanion({companionId: selectedCompanionId}));
    }, [dispatch, selectedCompanionId, hasHydrated]),
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

  const renderCategorySection = (category: TaskCategory) => {
    const data = categoryData[category];
    const recentTasks = data.recentTasks;
    const taskCount = data.taskCount;
    const task = recentTasks[0];
    const companion = companions.find(c => c.id === task?.companionId);
    const taskMeta = task ? getTaskCardMeta(task, authUser) : null;

    return (
      <View key={category} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>
            {resolveCategoryLabel(category)}
          </Text>
          {taskCount > 0 && (
            <ViewMoreButton onPress={() => handleViewMore(category)} />
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
            onPressView={() => handleViewTask(task.id)}
            onPressEdit={() => handleEditTask(task.id)}
            onPressComplete={() => handleCompleteTask(task.id)}
            onPressTakeObservationalTool={
              taskMeta?.isObservationalToolTask
                ? () => handleStartObservationalTool(task.id)
                : undefined
            }
            showEditAction={!taskMeta?.isCompleted}
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

  // Show empty screen if no companion is selected
  if (!selectedCompanionId) {
    return <EmptyTasksScreen />;
  }

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Tasks"
          showBackButton={false}
          rightIcon={Images.addIconDark}
          onRightPress={handleAddTask}
          glass={false}
        />
      }
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
          {allTasks.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>No tasks yet</Text>
              <Text style={styles.emptyStateText}>
                Start by adding a task for{' '}
                {selectedCompanion?.name || 'your companion'}
              </Text>
            </View>
          ) : (
            orderedCategories.map(category => renderCategorySection(category))
          )}
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};
