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

  const tasks = useSelector(selectAllTasksByCategory(selectedCompanionId, category));

  const handleCompanionSelect = (companionId: string | null) => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
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

  const renderTask = ({item}: {item: Task}) => {
    const companion = companions.find(c => c.id === item.companionId);

    if (!companion) return null;

    // Get assigned user's profile image and name
    const assignedToData = item.assignedTo === authUser?.id ? {
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
        showEditAction={item.status !== 'completed'}
        showCompleteButton={item.status === 'pending'}
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
      contentPadding={theme.spacing['3']}>
      {contentPaddingStyle => (
        <View style={styles.mainContainer}>
          <CompanionSelector
            companions={companions}
            selectedCompanionId={selectedCompanionId}
            onSelect={handleCompanionSelect}
            showAddButton={false}
            containerStyle={styles.companionSelector}
            requiredPermission="tasks"
            permissionLabel="tasks"
          />

          <FlatList
            data={tasks}
            renderItem={renderTask}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, contentPaddingStyle]}
            ListEmptyComponent={renderEmpty}
            style={styles.list}
          />
        </View>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    mainContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    list: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    companionSelector: {
      paddingHorizontal: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
    },
    listContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['8'],
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
