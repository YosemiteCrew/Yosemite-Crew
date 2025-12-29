import React, {useMemo, useState, useCallback} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {TaskCard} from '@/features/tasks/components';
import {TaskMonthDateSelector} from '@/features/tasks/components/shared/TaskMonthDateSelector';
import {useTheme} from '@/hooks';
import {setSelectedCompanion} from '@/features/companion';
import {markTaskStatus} from '@/features/tasks';
import {selectAllTasksByCategory} from '@/features/tasks/selectors';
import {selectAuthUser} from '@/features/auth/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {Task} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/features/tasks/utils/taskLabels';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'TasksList'>;
type Route = RouteProp<TaskStackParamList, 'TasksList'>;

export const TasksListScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {category} = route.params;

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const authUser = useSelector(selectAuthUser);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get all tasks for the category
  const allCategoryTasks = useSelector(selectAllTasksByCategory(selectedCompanionId, category));

  // Helper function to convert date to YYYY-MM-DD format
  const formatDateToISOString = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const selectedDateKey = useMemo(
    () => formatDateToISOString(selectedDate),
    [selectedDate, formatDateToISOString],
  );

  const listKey = useMemo(
    () => `${selectedCompanionId ?? 'none'}-${selectedDateKey}`,
    [selectedCompanionId, selectedDateKey],
  );

  // Filter tasks by selected date
  const tasks = useMemo(() => {
    return allCategoryTasks.filter(task => task.date === selectedDateKey);
  }, [allCategoryTasks, selectedDateKey]);

  // Get dates with tasks for the selected category
  const datesWithTasks = useMemo(() => {
    const dateSet = new Set<string>();
    for (const task of allCategoryTasks) {
      dateSet.add(task.date);
    }
    return dateSet;
  }, [allCategoryTasks]);

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

  const renderTask = ({item}: {item: Task}) => {
    const companion = companions.find(c => c.id === item.companionId);
    const statusUpper = String(item.status).toUpperCase();
    const isPending = statusUpper === 'PENDING';
    const isCompleted = statusUpper === 'COMPLETED';

    if (!companion) return null;

    // Get assigned user's profile image and name
    const selfId = authUser?.parentId ?? authUser?.id;
    const assignedToData = item.assignedTo === selfId ? {
      avatar: authUser?.profilePicture,
      name: authUser?.firstName || 'User',
    } : undefined;

    const isObservationalToolTask =
      item.category === 'health' &&
      item.details &&
      'taskType' in item.details &&
      item.details.taskType === 'take-observational-tool';

    return (
      <TaskCard
        title={item.title}
        categoryLabel={resolveCategoryLabel(item.category)}
        subcategoryLabel={item.subcategory ? item.subcategory : undefined}
        date={item.date}
        time={item.time}
        companionName={companion.name}
        companionAvatar={companion.profileImage ?? undefined}
        assignedToName={assignedToData?.name}
        assignedToAvatar={assignedToData?.avatar}
        status={item.status}
        onPressView={() => handleViewTask(item.id)}
        onPressEdit={() => handleEditTask(item.id)}
        onPressComplete={() => handleCompleteTask(item.id)}
        onPressTakeObservationalTool={
          isObservationalToolTask ? () => handleStartObservationalTool(item.id) : undefined
        }
        showEditAction={!isCompleted}
        showCompleteButton={isPending}
        category={item.category}
        details={item.details}
      />
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No {resolveCategoryLabel(category).toLowerCase()} tasks yet
      </Text>
    </View>
  );

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title={`${resolveCategoryLabel(category)} tasks`}
          showBackButton
          onBack={() => navigation.goBack()}
          glass={false}
        />
      }
      contentPadding={theme.spacing['1']}>
      {contentPaddingStyle => (
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={item => item.id}
          extraData={listKey}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <CompanionSelector
                companions={companions}
                selectedCompanionId={selectedCompanionId}
                onSelect={handleCompanionSelect}
                showAddButton={false}
                containerStyle={styles.companionSelector}
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
            </>
          }
          contentContainerStyle={[styles.listContent, contentPaddingStyle]}
          ListEmptyComponent={renderEmpty}
          style={styles.list}
        />
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    companionSelector: {
      paddingHorizontal: theme.spacing['4'],
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
    },
    listContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['2'],
      paddingBottom: theme.spacing['16'],
      gap: theme.spacing['3'],
    },
    emptyContainer: {
      paddingVertical: theme.spacing['12'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default TasksListScreen;
