import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
// Path: 5 levels up from __tests__/features/tasks/screens/TasksListScreen/ to project root
import {TasksListScreen} from '../../../../../src/features/tasks/screens/TasksListScreen/TasksListScreen';
import * as Redux from 'react-redux';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRouteParams = {category: 'health'};

jest.mock('@react-navigation/native', () => {
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
  };
});

// 2. Redux
const mockDispatch = jest.fn();
jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
const mockUseSelector = jest.spyOn(Redux, 'useSelector');

// 3. Hooks & Utils
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        textSecondary: 'grey',
      },
      spacing: {
        4: 16,
        8: 32,
        12: 48,
      },
      typography: {
        bodyMedium: {fontSize: 14},
      },
    },
  }),
}));

jest.mock('@/features/tasks/utils/taskLabels', () => ({
  resolveCategoryLabel: (cat: string) => cat.toUpperCase(),
}));

// 4. Actions & Selectors
jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({type: 'SET_COMPANION', payload: id})),
}));

jest.mock('@/features/tasks', () => ({
  markTaskStatus: jest.fn(payload => ({type: 'MARK_STATUS', payload})),
}));

jest.mock('@/features/tasks/selectors', () => ({
  selectAllTasksByCategory: () => (state: any) => {
    // Return mocked tasks from state based on category
    return state.mockTasks || [];
  },
}));

jest.mock('@/features/auth/selectors', () => ({
  selectAuthUser: (state: any) => state.authUser,
}));

// 5. Components
jest.mock('@/shared/components/common', () => ({
  SafeArea: ({children}: any) => children,
}));

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {TouchableOpacity, Text, View} = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back-btn" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => ({
    CompanionSelector: ({onSelect, companions}: any) => {
      const {View, TouchableOpacity, Text} = require('react-native');
      return (
        <View testID="companion-selector">
          {companions.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              testID={`select-companion-${c.id}`}
              onPress={() => onSelect(c.id)}>
              <Text>{c.name}</Text>
            </TouchableOpacity>
          ))}
          {/* Hidden button to test null selection branch */}
          <TouchableOpacity
            testID="deselect-companion"
            onPress={() => onSelect(null)}>
            <Text>Deselect</Text>
          </TouchableOpacity>
        </View>
      );
    },
  }),
);

jest.mock('@/features/tasks/components', () => ({
  TaskCard: ({
    title,
    onPressView,
    onPressEdit,
    onPressComplete,
    onPressTakeObservationalTool,
    showEditAction,
    showCompleteButton,
    assignedToName,
  }: any) => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return (
      <View testID={`task-card-${title}`}>
        <Text>{title}</Text>
        {assignedToName && (
          <Text testID={`assigned-${title}`}>{assignedToName}</Text>
        )}
        <TouchableOpacity testID={`view-${title}`} onPress={onPressView}>
          <Text>View</Text>
        </TouchableOpacity>

        {showEditAction && (
          <TouchableOpacity testID={`edit-${title}`} onPress={onPressEdit}>
            <Text>Edit</Text>
          </TouchableOpacity>
        )}

        {showCompleteButton && (
          <TouchableOpacity
            testID={`complete-${title}`}
            onPress={onPressComplete}>
            <Text>Complete</Text>
          </TouchableOpacity>
        )}

        {onPressTakeObservationalTool && (
          <TouchableOpacity
            testID={`start-ot-${title}`}
            onPress={onPressTakeObservationalTool}>
            <Text>Start OT</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

describe('TasksListScreen', () => {
  const mockState = {
    companion: {
      companions: [
        {id: 'c1', name: 'Buddy', profileImage: 'img1'},
        {id: 'c2', name: 'Lucy', profileImage: 'img2'},
      ],
      selectedCompanionId: 'c1',
    },
    authUser: {id: 'u1', firstName: 'Owner', profilePicture: 'p1'},
    mockTasks: [
      {
        id: 't1',
        title: 'Regular Task',
        category: 'health',
        companionId: 'c1',
        status: 'pending',
        date: '2023-01-01',
        time: '10:00',
        assignedTo: 'u1', // Matches auth user
      },
      {
        id: 't2',
        title: 'OT Task',
        category: 'health',
        companionId: 'c1',
        status: 'completed', // Completed, so no complete button
        date: '2023-01-02',
        time: '12:00',
        details: {taskType: 'take-observational-tool'},
      },
      {
        id: 't3',
        title: 'Missing Companion Task',
        category: 'health',
        companionId: 'c99', // Does not exist
        status: 'pending',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSelector.mockImplementation((cb: any) => cb(mockState));
  });

  it('renders correctly with list of tasks', () => {
    const {getByText, queryByTestId} = render(<TasksListScreen />);

    expect(getByText('HEALTH tasks')).toBeTruthy();
    expect(getByText('Regular Task')).toBeTruthy();
    expect(getByText('OT Task')).toBeTruthy();

    // t3 should be filtered out because companion c99 doesn't exist
    expect(queryByTestId('task-card-Missing Companion Task')).toBeNull();
  });

  it('renders empty state when no tasks exist', () => {
    mockUseSelector.mockImplementation((cb: any) =>
      cb({
        ...mockState,
        mockTasks: [],
      }),
    );

    const {getByText} = render(<TasksListScreen />);
    expect(getByText('No health tasks yet')).toBeTruthy();
  });

  it('handles navigation back', () => {
    const {getByTestId} = render(<TasksListScreen />);
    fireEvent.press(getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles companion selection', () => {
    const {getByTestId} = render(<TasksListScreen />);
    fireEvent.press(getByTestId('select-companion-c2'));

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_COMPANION',
        payload: 'c2',
      }),
    );
  });

  it('does not dispatch selection change if companion id is null (branch coverage)', () => {
    const {getByTestId} = render(<TasksListScreen />);
    fireEvent.press(getByTestId('deselect-companion'));
    // Should NOT dispatch SET_COMPANION because companionId is null
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('handles view task navigation', () => {
    const {getByTestId} = render(<TasksListScreen />);
    fireEvent.press(getByTestId('view-Regular Task'));
    expect(mockNavigate).toHaveBeenCalledWith('TaskView', {taskId: 't1'});
  });

  it('handles edit task navigation', () => {
    const {getByTestId} = render(<TasksListScreen />);
    fireEvent.press(getByTestId('edit-Regular Task')); // t1 is pending, showEdit=true
    expect(mockNavigate).toHaveBeenCalledWith('EditTask', {taskId: 't1'});
  });

  it('handles complete task action', () => {
    const {getByTestId} = render(<TasksListScreen />);
    fireEvent.press(getByTestId('complete-Regular Task')); // t1 is pending
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MARK_STATUS',
        payload: {taskId: 't1', status: 'completed'},
      }),
    );
  });

  it('handles start observational tool action', () => {
    const {getByTestId} = render(<TasksListScreen />);
    // t2 is an OT task
    fireEvent.press(getByTestId('start-ot-OT Task'));
    expect(mockNavigate).toHaveBeenCalledWith('ObservationalTool', {
      taskId: 't2',
    });
  });

  it('correctly hides actions for completed tasks', () => {
    const {getByTestId, queryByTestId} = render(<TasksListScreen />);
    // t2 is completed.
    // Logic: showEditAction={item.status !== 'completed'} -> false
    // showCompleteButton={item.status === 'pending'} -> false

    expect(queryByTestId('edit-OT Task')).toBeNull();
    expect(queryByTestId('complete-OT Task')).toBeNull();

    // But it is an OT task, so it might show Start OT depending on logic?
    // Code: onPressTakeObservationalTool is passed if it matches criteria.
    expect(getByTestId('start-ot-OT Task')).toBeTruthy();
  });

  it('filters out tasks with missing companions safely', () => {
    // t3 has companionId 'c99' which is not in the companions list.
    // renderTask returns null.
    const {queryByText} = render(<TasksListScreen />);
    expect(queryByText('Missing Companion Task')).toBeNull();
  });

  it('handles tasks assigned to other users (coverage for assignedToData)', () => {
    // Modify t1 to be assigned to someone else
    const otherUserState = {
      ...mockState,
      mockTasks: [
        {
          ...mockState.mockTasks[0],
          assignedTo: 'u99',
        },
      ],
    };
    mockUseSelector.mockImplementation((cb: any) => cb(otherUserState));

    const {getByText} = render(<TasksListScreen />);
    expect(getByText('Regular Task')).toBeTruthy();
    // If not auth user, assignedToData is undefined.
  });

  it('uses default "User" name when authUser has no first name (branch coverage)', () => {
    const noNameState = {
      ...mockState,
      authUser: {...mockState.authUser, firstName: null},
      mockTasks: [
        {
          id: 't1',
          title: 'Task No Name',
          category: 'health',
          companionId: 'c1',
          status: 'pending',
          date: '2023-01-01',
          time: '10:00',
          assignedTo: 'u1',
        },
      ],
    };
    mockUseSelector.mockImplementation((cb: any) => cb(noNameState));

    const {getByTestId} = render(<TasksListScreen />);
    // 'User' is the fallback string in the code: `name: authUser?.firstName || 'User'`
    const assignedText = getByTestId('assigned-Task No Name');
    expect(assignedText.props.children).toBe('User');
  });
});
