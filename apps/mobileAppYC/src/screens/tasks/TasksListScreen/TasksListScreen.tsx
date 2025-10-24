import React, {useMemo} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {TaskCard} from '@/components/tasks';
import {useTheme} from '@/hooks';
import {setSelectedCompanion} from '@/features/companion';
import {markTaskStatus} from '@/features/tasks';
import {selectAllTasksByCategory} from '@/features/tasks/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {Task} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/utils/taskLabels';

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

  const renderTask = ({item}: {item: Task}) => {
    const companion = companions.find(c => c.id === item.companionId);

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
        status={item.status}
        onPressView={() => handleViewTask(item.id)}
        onPressEdit={() => handleEditTask(item.id)}
        onPressComplete={() => handleCompleteTask(item.id)}
        showEditAction={item.status !== 'completed'}
        showCompleteButton={item.status === 'pending'}
        category={item.category}
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
    <SafeArea>
      <Header
        title={`${resolveCategoryLabel(category)} tasks`}
        showBackButton
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={handleCompanionSelect}
          showAddButton={false}
          containerStyle={styles.companionSelector}
        />

        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
        />
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
    },
    companionSelector: {
      marginBottom: theme.spacing[4],
      paddingHorizontal: theme.spacing[4],
    },
    listContent: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[8],
    },
    emptyContainer: {
      paddingVertical: theme.spacing[12],
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
