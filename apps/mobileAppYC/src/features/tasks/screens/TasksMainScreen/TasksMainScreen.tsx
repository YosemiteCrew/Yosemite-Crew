import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {TaskCard} from '@/features/tasks/components';
import {TaskMonthDateSelector} from '@/features/tasks/components/shared/TaskMonthDateSelector';
import {EmptyTasksScreen} from '../EmptyTasksScreen/EmptyTasksScreen';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';
import {fetchTasksForCompanion, markTaskStatus} from '@/features/tasks';
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

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'TasksMain'>;

const TASK_CATEGORIES: TaskCategory[] = ['health', 'hygiene', 'dietary', 'custom'];

export const TasksMainScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const authUser = useSelector(selectAuthUser);
  const selectedCompanion = useMemo(
    () => companions.find(c => c.id === selectedCompanionId),
    [companions, selectedCompanionId],
  );

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const hasHydrated = useSelector(
    selectHasHydratedCompanion(selectedCompanionId ?? null),
  );

  // Get all tasks for the selected companion
  const allTasks = useSelector(selectTasksByCompanion(selectedCompanionId ?? null));

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
    selectRecentTasksByCategory(selectedCompanionId, selectedDate, 'hygiene', 1),
  );
  const hygieneCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, selectedDate, 'hygiene'),
  );
  const dietaryTasks = useSelector(
    selectRecentTasksByCategory(selectedCompanionId, selectedDate, 'dietary', 1),
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
    [healthTasks, healthCount, hygieneTasks, hygieneCount, dietaryTasks, dietaryCount, customTasks, customCount],
  );

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

  const handleCompanionSelect = (companionId: string | null) => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
  };

  const handleMonthChange = useCallback((newMonth: Date) => {
    setCurrentMonth(newMonth);
    const firstDay = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
    setSelectedDate(firstDay);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleAddTask = () => {
    navigation.navigate('AddTask');
  };

  const handleViewMore = (category: TaskCategory) => {
    navigation.navigate('TasksList', {category});
  };

  const handleViewTask = (taskId: string) => {
    navigation.navigate('TaskView', {taskId});
  };

  const handleEditTask = (taskId: string) => {
    navigation.navigate('EditTask', {taskId});
  };

  const handleCompleteTask = (taskId: string) => {
    dispatch(markTaskStatus({taskId, status: 'completed'}));
  };

  const handleStartObservationalTool = (taskId: string) => {
    navigation.navigate('ObservationalTool', {taskId});
  };

  const renderCategorySection = (category: TaskCategory) => {
    const data = categoryData[category];
    const recentTasks = data.recentTasks;
    const taskCount = data.taskCount;
    const task = recentTasks[0];
    const companion = companions.find(c => c.id === task?.companionId);
    const statusUpper = task ? String(task.status).toUpperCase() : '';
    const isPending = statusUpper === 'PENDING';
    const isCompleted = statusUpper === 'COMPLETED';

    // Get assigned user's profile image and name
    const selfId = authUser?.parentId ?? authUser?.id;
    const assignedToData = task?.assignedTo === selfId ? {
      avatar: authUser?.profilePicture,
      name: authUser?.firstName || 'User',
    } : undefined;

    const isObservationalToolTask =
      task?.category === 'health' &&
      task.details &&
      'taskType' in task.details &&
      task.details.taskType === 'take-observational-tool';

    return (
      <View key={category} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{resolveCategoryLabel(category)}</Text>
          {taskCount > 0 && (
            <View style={styles.viewMoreShadowWrapper}>
              <LiquidGlassButton
                onPress={() => handleViewMore(category)}
                size="small"
                compact
                glassEffect="clear"
                borderRadius="full"
                style={styles.viewMoreButton}
                textStyle={styles.viewMoreText}
                shadowIntensity="none"
                title="View more"
              />
            </View>
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
            assignedToName={assignedToData?.name}
            assignedToAvatar={assignedToData?.avatar}
            status={task.status}
            onPressView={() => handleViewTask(task.id)}
            onPressEdit={() => handleEditTask(task.id)}
            onPressComplete={() => handleCompleteTask(task.id)}
        onPressTakeObservationalTool={
          isObservationalToolTask ? () => handleStartObservationalTool(task.id) : undefined
        }
        showEditAction={!isCompleted}
        showCompleteButton={isPending}
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
              Start by adding a task for {selectedCompanion?.name || 'your companion'}
            </Text>
          </View>
        ) : (
          TASK_CATEGORIES.map(category => renderCategorySection(category))
        )}
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingTop: theme.spacing['2'],
      paddingBottom: theme.spacing['28'],
    },
    companionSelectorTask: {
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
      paddingHorizontal: theme.spacing['4'],
    },
    categorySection: {
      marginBottom: theme.spacing['6'],
      paddingHorizontal: theme.spacing['4'],
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing['3'],
    },
    categoryTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      fontWeight: '600',
    },
    viewMoreText: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.primary,
    },
    viewMoreButton: {
      alignSelf: 'flex-start',
      flexGrow: 0,
      flexShrink: 0,
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['1'],
      minHeight: theme.spacing['7'],
      minWidth: 0,
      borderWidth: 0,
      borderColor: 'transparent',
      ...theme.shadows.sm,
      shadowColor: theme.colors.neutralShadow,
    },
    viewMoreShadowWrapper: {
      borderRadius: theme.borderRadius.full,
      ...(Platform.OS === 'ios' ? theme.shadows.sm : null),
    },
    emptyCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      paddingVertical: theme.spacing['6'],
      paddingHorizontal: theme.spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    emptyStateContainer: {
      marginHorizontal: theme.spacing['4'],
      marginVertical: theme.spacing['8'],
      paddingVertical: theme.spacing['10'],
      paddingHorizontal: theme.spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyStateTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['2'],
      fontWeight: '600',
    },
    emptyStateText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
