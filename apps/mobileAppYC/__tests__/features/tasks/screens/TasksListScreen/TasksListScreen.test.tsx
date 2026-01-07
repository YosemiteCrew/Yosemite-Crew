import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
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
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/features/tasks/utils/taskLabels', () => ({
  resolveCategoryLabel: (cat: string) => cat.toUpperCase(),
}));

jest.mock('@/shared/utils/dateHelpers', () => ({
  formatDateToISODate: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
}));

// Mock the new hooks
jest.mock('@/features/tasks/hooks/useTaskDateSelection', () => ({
  useTaskDateSelection: () => ({
    selectedDate: new Date('2025-12-31'),
    currentMonth: new Date('2025-12-01'),
    handleDateSelect: jest.fn(),
    handleMonthChange: jest.fn(),
  }),
}));

jest.mock('@/features/tasks/hooks/useTaskNavigationActions', () => ({
  useTaskNavigationActions: () => ({
    handleViewTask: mockNavigate,
    handleEditTask: mockNavigate,
    handleCompleteTask: mockDispatch,
    handleStartObservationalTool: mockNavigate,
  }),
}));

jest.mock('@/features/tasks/utils/taskCardHelpers', () => ({
  getTaskCardMeta: (task: any, authUser: any) => {
    const statusUpper = String(task.status).toUpperCase();
    const isPending = statusUpper === 'PENDING';
    const isCompleted = statusUpper === 'COMPLETED';
    const assignedToData =
      task.assignedTo === authUser?.id
        ? {
            avatar: authUser?.profilePicture,
            name: authUser?.firstName || 'User',
          }
        : undefined;
    const isObservationalToolTask =
      task.category === 'health' &&
      task.details?.taskType === 'take-observational-tool';

    return {
      isPending,
      isCompleted,
      assignedToData,
      isObservationalToolTask,
    };
  },
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

jest.mock('@/shared/utils/screenStyles', () => ({
  createEmptyStateStyles: () => ({
    emptyContainer: {},
    emptyText: {},
  }),
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
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => ({
    LiquidGlassHeaderScreen: ({header, children}: any) => {
      const {View} = require('react-native');
      return (
        <View>
          {header}
          {children(() => ({}))}
        </View>
      );
    },
  }),
);

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

jest.mock(
  '@/features/tasks/components/shared/TaskMonthDateSelector',
  () => ({
    TaskMonthDateSelector: ({
      selectedDate,
      datesWithTasks: _datesWithTasks,
      onDateSelect,
    }: any) => {
      const {View, Text, TouchableOpacity} = require('react-native');
      return (
        <View testID="task-month-date-selector">
          <Text testID="selected-date">
            {selectedDate.toISOString().split('T')[0]}
          </Text>
          <TouchableOpacity
            testID="date-selector-trigger"
            onPress={() => onDateSelect(new Date('2025-12-31'))}>
            <Text>Select Date</Text>
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
        date: '2025-12-31',
        time: '10:00',
        assignedTo: 'u1', // Matches auth user
      },
      {
        id: 't2',
        title: 'OT Task',
        category: 'health',
        companionId: 'c1',
        status: 'completed', // Completed, so no complete button
        date: '2025-12-31',
        time: '12:00',
        details: {taskType: 'take-observational-tool'},
      },
      {
        id: 't3',
        title: 'Different Date Task',
        category: 'health',
        companionId: 'c1',
        status: 'pending',
        date: '2025-12-30', // Different date, should be filtered out
      },
      {
        id: 't4',
        title: 'Missing Companion Task',
        category: 'health',
        companionId: 'c99', // Does not exist
        status: 'pending',
        date: '2025-12-31',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSelector.mockImplementation((cb: any) => cb(mockState));
  });

  it('renders correctly with list of tasks for selected date', () => {
    const {getByText, queryByTestId, getByTestId} = render(
      <TasksListScreen />,
    );

    expect(getByText('HEALTH tasks')).toBeTruthy();
    expect(getByTestId('task-month-date-selector')).toBeTruthy();
    expect(getByText('Regular Task')).toBeTruthy();
    expect(getByText('OT Task')).toBeTruthy();

    // t3 should be filtered out because it has a different date
    expect(queryByTestId('task-card-Different Date Task')).toBeNull();
    // t4 should be filtered out because companion c99 doesn't exist
    expect(queryByTestId('task-card-Missing Companion Task')).toBeNull();
  });

  it('renders empty state when no tasks exist for selected date', () => {
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

  it('filters tasks by selected date', () => {
    const {getByText, queryByText} = render(<TasksListScreen />);

    // Tasks with date 2025-12-31 should be shown
    expect(getByText('Regular Task')).toBeTruthy();
    expect(getByText('OT Task')).toBeTruthy();

    // Task with date 2025-12-30 should not be shown
    expect(queryByText('Different Date Task')).toBeNull();
  });

  it('filters out tasks with missing companions safely', () => {
    // t4 has companionId 'c99' which is not in the companions list.
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
          date: '2025-12-31',
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
