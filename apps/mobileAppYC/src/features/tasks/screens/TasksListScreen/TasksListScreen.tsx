import React, {useMemo} from 'react';
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
import {selectAllTasksByCategory} from '@/features/tasks/selectors';
import {selectAuthUser} from '@/features/auth/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {Task} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/features/tasks/utils/taskLabels';
import {createEmptyStateStyles} from '@/shared/utils/screenStyles';
import {formatDateToISODate} from '@/shared/utils/dateHelpers';
import {useTaskDateSelection} from '@/features/tasks/hooks/useTaskDateSelection';
import {getTaskCardMeta} from '@/features/tasks/utils/taskCardHelpers';
import {useTaskNavigationActions} from '@/features/tasks/hooks/useTaskNavigationActions';

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

  const {selectedDate, currentMonth, handleDateSelect, handleMonthChange} =
    useTaskDateSelection();
  const {handleViewTask, handleEditTask, handleCompleteTask, handleStartObservationalTool} =
    useTaskNavigationActions(navigation, dispatch);

  // Get all tasks for the category
  const allCategoryTasks = useSelector(selectAllTasksByCategory(selectedCompanionId, category));

  const selectedDateKey = useMemo(
    () => formatDateToISODate(selectedDate),
    [selectedDate],
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

  const renderTask = ({item}: {item: Task}) => {
    const companion = companions.find(c => c.id === item.companionId);
    const {isPending, isCompleted, assignedToData, isObservationalToolTask} =
      getTaskCardMeta(item, authUser);

    if (!companion) return null;

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

const createStyles = (theme: any) => {
  const emptyStyles = createEmptyStateStyles(theme);
  return StyleSheet.create({
    ...emptyStyles,
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
      ...emptyStyles.emptyContainer,
      paddingVertical: theme.spacing['12'],
    },
  });
};

export default TasksListScreen;
