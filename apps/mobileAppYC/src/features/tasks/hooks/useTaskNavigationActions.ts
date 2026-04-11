import {useCallback} from 'react';
import type {NavigationProp} from '@react-navigation/native';
import type {AppDispatch} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import {markTaskStatus} from '@/features/tasks';

type Navigation = NavigationProp<TaskStackParamList>;

export const useTaskNavigationActions = (
  navigation: Navigation,
  dispatch: AppDispatch,
) => {
  const handleViewTask = useCallback(
    (taskId: string) => {
      navigation.navigate('TaskView', {taskId});
    },
    [navigation],
  );

  const handleEditTask = useCallback(
    (taskId: string) => {
      navigation.navigate('EditTask', {taskId});
    },
    [navigation],
  );

  const handleCompleteTask = useCallback(
    (taskId: string) => {
      dispatch(markTaskStatus({taskId, status: 'completed'}));
    },
    [dispatch],
  );

  const handleStartObservationalTool = useCallback(
    (taskId: string) => {
      navigation.navigate('ObservationalTool', {taskId});
    },
    [navigation],
  );

  return {
    handleViewTask,
    handleEditTask,
    handleCompleteTask,
    handleStartObservationalTool,
  };
};
