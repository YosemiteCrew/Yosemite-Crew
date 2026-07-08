import {renderHook} from '@testing-library/react-native';
import {useTaskNavigationActions} from '@/features/tasks/hooks/useTaskNavigationActions';
import {markTaskStatus} from '@/features/tasks';

jest.mock('@/features/tasks', () => ({
  markTaskStatus: jest.fn(payload => ({type: 'tasks/markTaskStatus', payload})),
}));

describe('useTaskNavigationActions', () => {
  const navigation = {navigate: jest.fn()} as any;
  const dispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handleViewTask navigates to TaskView with the taskId', () => {
    const {result} = renderHook(() =>
      useTaskNavigationActions(navigation, dispatch),
    );
    result.current.handleViewTask('task-1');
    expect(navigation.navigate).toHaveBeenCalledWith('TaskView', {
      taskId: 'task-1',
    });
  });

  it('handleEditTask navigates to EditTask with the taskId', () => {
    const {result} = renderHook(() =>
      useTaskNavigationActions(navigation, dispatch),
    );
    result.current.handleEditTask('task-2');
    expect(navigation.navigate).toHaveBeenCalledWith('EditTask', {
      taskId: 'task-2',
    });
  });

  it('handleCompleteTask dispatches markTaskStatus with a completed status', () => {
    const {result} = renderHook(() =>
      useTaskNavigationActions(navigation, dispatch),
    );
    result.current.handleCompleteTask('task-3');

    expect(markTaskStatus).toHaveBeenCalledWith({
      taskId: 'task-3',
      status: 'completed',
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'tasks/markTaskStatus',
      payload: {taskId: 'task-3', status: 'completed'},
    });
  });

  it('handleStartObservationalTool navigates to ObservationalTool with the taskId', () => {
    const {result} = renderHook(() =>
      useTaskNavigationActions(navigation, dispatch),
    );
    result.current.handleStartObservationalTool('task-4');
    expect(navigation.navigate).toHaveBeenCalledWith('ObservationalTool', {
      taskId: 'task-4',
    });
  });
});
