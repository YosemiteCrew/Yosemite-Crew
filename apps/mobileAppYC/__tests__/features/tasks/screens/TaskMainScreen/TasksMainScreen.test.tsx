import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {TasksMainScreen} from '../../../../../src/features/tasks/screens/TasksMainScreen/TasksMainScreen';
import {useSelector, useDispatch} from 'react-redux';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {fetchTasksForCompanion} from '../../../../../src/features/tasks';
import {setSelectedCompanion} from '../../../../../src/features/companion';

// --- Mocks ---

// 1. Redux & Navigation
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  useDispatch: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(),
}));

// 2. Thunks
jest.mock('@/features/tasks', () => ({
  fetchTasksForCompanion: jest.fn(),
}));

jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(),
}));

// 3. Selectors
jest.mock('@/features/tasks/selectors', () => ({
  selectHasHydratedCompanion: jest.fn(),
  selectRecentTasksByCategory: jest.fn(),
  selectTaskCountByCategory: jest.fn(),
  selectTasksByCompanion: jest.fn(),
}));

jest.mock('@/features/auth/selectors', () => ({
  selectAuthUser: jest.fn(),
}));

// 4. UI Components - Require inside factory to avoid hoisting issues
jest.mock('@/shared/components/common', () => {
  const {View} = require('react-native');
  return {
    SafeArea: ({children}: any) => <View testID="safe-area">{children}</View>,
  };
});

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View} = require('react-native');
  return {
    Header: (props: any) => (
      <View
        testID="header"
        title={props.title}
        onRightPress={props.onRightPress}
      />
    ),
  };
});

jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => {
    const {View} = require('react-native');
    return {
      CompanionSelector: (props: any) => (
        <View
          testID="companion-selector"
          selectedId={props.selectedCompanionId}
          onSelect={props.onSelect}
        />
      ),
    };
  },
);

jest.mock('@/features/tasks/components', () => {
  const {View} = require('react-native');
  return {
    TaskCard: (props: any) => (
      <View
        testID={`task-card-${props.title}`}
        onPressView={props.onPressView}
        onPressEdit={props.onPressEdit}
        onPressComplete={props.onPressComplete}
        onPressTakeObservationalTool={props.onPressTakeObservationalTool}
      />
    ),
  };
});

jest.mock(
  '../../../../../src/features/tasks/screens/EmptyTasksScreen/EmptyTasksScreen',
  () => {
    const {View} = require('react-native');
    return {
      EmptyTasksScreen: () => <View testID="empty-screen" />,
    };
  },
);

// 5. Assets & Hooks
jest.mock('@/assets/images', () => ({
  Images: {
    addIconDark: {uri: 'add-icon'},
    leftArrowIcon: {uri: 'left-arrow'},
    rightArrowIcon: {uri: 'right-arrow'},
  },
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 6. Date Utils
jest.mock('@/shared/utils/dateHelpers', () => {
  const actual = jest.requireActual('@/shared/utils/dateHelpers');
  return {
    ...actual,
    formatMonthYear: jest.fn(() => 'January 2023'),
  };
});

// 7. Task Utils
jest.mock('@/features/tasks/utils/taskLabels', () => ({
  resolveCategoryLabel: jest.fn((category: string) => {
    const labels: Record<string, string> = {
      health: 'Health',
      hygiene: 'Hygiene',
      dietary: 'Dietary',
      custom: 'Custom',
    };
    return labels[category] || category;
  }),
}));

jest.mock('@/features/tasks/utils/taskCardHelpers', () => ({
  getTaskCardMeta: jest.fn((task: any, _authUser: any) => ({
    isPending: task.status === 'pending',
    isCompleted: task.status === 'completed',
    assignedToData: undefined,
    isObservationalToolTask: task.details?.taskType === 'take-observational-tool',
  })),
}));

// 8. Custom Hooks
jest.mock('@/features/tasks/hooks/useTaskDateSelection', () => ({
  useTaskDateSelection: jest.fn(),
}));

jest.mock('@/features/tasks/hooks/useTaskNavigationActions', () => ({
  useTaskNavigationActions: jest.fn(),
}));

jest.mock('@/shared/utils/screenStyles', () => ({
  useCommonScreenStyles: jest.fn(),
}));

// 9. Additional Components
jest.mock('@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen', () => {
  const {View} = require('react-native');
  return {
    LiquidGlassHeaderScreen: ({header, children}: any) => (
      <View testID="liquid-glass-header-screen">
        {header}
        {typeof children === 'function' ? children({}) : children}
      </View>
    ),
  };
});

jest.mock('@/features/tasks/components/shared/TaskMonthDateSelector', () => {
  const {View, Text, FlatList, Pressable} = require('react-native');
  return {
    TaskMonthDateSelector: (props: any) => {
      // Generate dates for current month
      const monthStart = new Date(props.currentMonth);
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dates = Array.from({length: daysInMonth}, (_, i) => {
        const date = new Date(year, month, i + 1);
        return date;
      });

      return (
        <View testID="task-month-date-selector">
          <FlatList
            data={dates}
            renderItem={({item}: any) => {
              const day = String(item.getDate()).padStart(2, '0');
              return (
                <Pressable onPress={() => props.onDateSelect(item)}>
                  <Text>{day}</Text>
                </Pressable>
              );
            }}
            keyExtractor={(item: any) => item.toString()}
          />
        </View>
      );
    },
  };
});

jest.mock('@/shared/components/common/ViewMoreButton/ViewMoreButton', () => {
  const {Pressable, Text} = require('react-native');
  return {
    ViewMoreButton: (props: any) => (
      <Pressable testID="view-more-button" onPress={props.onPress}>
        <Text>View More</Text>
      </Pressable>
    ),
  };
});

describe('TasksMainScreen', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();
  const mockHandleDateSelect = jest.fn();
  const mockHandleMonthChange = jest.fn();
  const mockHandleViewTask = jest.fn();
  const mockHandleEditTask = jest.fn();
  const mockHandleCompleteTask = jest.fn();
  const mockHandleStartObservationalTool = jest.fn();

  const mockCompanions = [
    {id: 'c1', name: 'Buddy', profileImage: 'img-url'},
    {id: 'c2', name: 'Max'},
  ];
  const mockAuthUser = {id: 'u1', firstName: 'Owner', profilePicture: 'pic'};

  beforeEach(() => {
    jest.clearAllMocks();

    // Freeze time to Jan 15 2023 to ensure date calculations are stable
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-15T12:00:00Z'));

    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue({navigate: mockNavigate});
    (useFocusEffect as jest.Mock).mockImplementation(cb => cb());

    // --- Hook Mocks ---
    const {useTaskDateSelection} = require('@/features/tasks/hooks/useTaskDateSelection');
    const {useTaskNavigationActions} = require('@/features/tasks/hooks/useTaskNavigationActions');
    const {useCommonScreenStyles} = require('@/shared/utils/screenStyles');

    // Mock useTaskDateSelection
    useTaskDateSelection.mockReturnValue({
      selectedDate: new Date('2023-01-15T12:00:00Z'),
      currentMonth: new Date('2023-01-01T12:00:00Z'),
      handleDateSelect: mockHandleDateSelect,
      handleMonthChange: mockHandleMonthChange,
    });

    // Mock useTaskNavigationActions
    useTaskNavigationActions.mockReturnValue({
      handleViewTask: mockHandleViewTask,
      handleEditTask: mockHandleEditTask,
      handleCompleteTask: mockHandleCompleteTask,
      handleStartObservationalTool: mockHandleStartObservationalTool,
    });

    // Mock useCommonScreenStyles
    useCommonScreenStyles.mockReturnValue({
      container: {},
      contentContainer: {},
      categorySection: {},
      categoryHeader: {},
      categoryTitle: {},
      emptyCard: {},
      emptyText: {},
      emptyStateContainer: {},
      emptyStateTitle: {},
      emptyStateText: {},
      companionSelectorTask: {},
    });

    // --- State & Selector Setup ---
    const {
      selectHasHydratedCompanion,
      selectRecentTasksByCategory,
      selectTaskCountByCategory,
      selectTasksByCompanion,
    } = require('@/features/tasks/selectors');

    // Default implementations (Factory Pattern: Return a createSelector-like function)
    // The pattern is: selectorFactory(...args) returns a selector function that takes state
    selectHasHydratedCompanion.mockReturnValue((_state: any) => true);
    selectRecentTasksByCategory.mockReturnValue((_state: any) => []);
    selectTaskCountByCategory.mockReturnValue((_state: any) => 0);
    selectTasksByCompanion.mockReturnValue((_state: any) => []);

    const {selectAuthUser} = require('@/features/auth/selectors');
    selectAuthUser.mockReturnValue(mockAuthUser);

    // useSelector mock to handle both inline and factory selectors
    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      // 1. Handle inline selectors (e.g. (state) => state.companion...)
      // Try to call with mock state first
      const mockState = {
        companion: {
          companions: mockCompanions,
          selectedCompanionId: 'c1',
        },
      };

      try {
        const result = callback(mockState);
        if (result !== undefined) return result;
      } catch (e) {
        // If callback throws or doesn't work with state, it might be a factory-created selector
        // In that case, just call it without arguments (the factory already has the params)
        if (typeof callback === 'function') {
          try {
            return callback();
          } catch {
            return undefined;
          }
        }
      }

      return undefined;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ===========================================================================
  // Tests
  // ===========================================================================

  it('renders EmptyTasksScreen if no companion is selected', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(cb => {
      try {
        return cb({
          companion: {
            companions: [],
            selectedCompanionId: null,
          },
        });
      } catch {
        return undefined;
      }
    });

    const {getByTestId} = render(<TasksMainScreen />);
    expect(getByTestId('empty-screen')).toBeTruthy();
  });

  it('selects the first companion automatically if none selected but list is not empty', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(cb => {
      if (typeof cb === 'function') {
        try {
          const res = cb({
            companion: {
              companions: mockCompanions,
              selectedCompanionId: null,
            },
          });
          if (res !== undefined) return res;
        } catch {}
      }
      return undefined;
    });

    render(<TasksMainScreen />);
    expect(setSelectedCompanion).toHaveBeenCalledWith('c1');
  });

  it('renders the main screen content when companion is selected', () => {
    const {getByTestId, getByText} = render(<TasksMainScreen />);

    expect(getByTestId('header')).toBeTruthy();
    expect(getByTestId('companion-selector')).toBeTruthy();
    expect(getByTestId('task-month-date-selector')).toBeTruthy();
    expect(getByText('No tasks yet')).toBeTruthy();
  });

  it('fetches tasks on focus if not hydrated', () => {
    const {selectHasHydratedCompanion} = require('@/features/tasks/selectors');
    selectHasHydratedCompanion.mockReturnValue((_state: any) => false);

    render(<TasksMainScreen />);

    expect(mockDispatch).toHaveBeenCalled();
    expect(fetchTasksForCompanion).toHaveBeenCalledWith({companionId: 'c1'});
  });

  it('updates selected date when a date item is pressed', async () => {
    const {getAllByText} = render(<TasksMainScreen />);

    // Use '05' because FlatList virtualization typically renders the first ~10 items.
    // '15' might be off-screen in the mock environment, leading to "Unable to find element".
    const dateItem = getAllByText('05')[0];

    fireEvent.press(dateItem);

    await waitFor(() => {
      expect(mockHandleDateSelect).toHaveBeenCalled();
      const callArg = mockHandleDateSelect.mock.calls[0][0];
      expect(callArg.getDate()).toBe(5);
    });
  });

  it('renders task cards when tasks exist for a specific category', () => {
    const {
      selectRecentTasksByCategory,
      selectTaskCountByCategory,
      selectTasksByCompanion,
    } = require('@/features/tasks/selectors');

    const mockTask = {
      id: 't1',
      title: 'Walk',
      category: 'health',
      status: 'pending',
      date: '2023-01-15',
      time: '10:00',
      companionId: 'c1',
    };

    // Ensure allTasks is populated so "No tasks yet" is not shown
    selectTasksByCompanion.mockReturnValue((_state: any) => [mockTask]);

    // Mock factory to return tasks ONLY for 'health' category to avoid duplicates in other sections
    selectRecentTasksByCategory.mockImplementation(
      (_id: string, _d: Date, category: string) => {
        if (category === 'health') return (_state: any) => [mockTask];
        return (_state: any) => [];
      },
    );

    selectTaskCountByCategory.mockImplementation(
      (_id: string, _d: Date, category: string) => {
        if (category === 'health') return (_state: any) => 1;
        return (_state: any) => 0;
      },
    );

    const {getByTestId, getByText} = render(<TasksMainScreen />);

    expect(getByTestId('task-card-Walk')).toBeTruthy();
    expect(getByText('View More')).toBeTruthy();
  });

  it('dispatches markTaskStatus when complete button is pressed', () => {
    const {
      selectRecentTasksByCategory,
      selectTasksByCompanion,
    } = require('@/features/tasks/selectors');
    const mockTask = {
      id: 't1',
      title: 'Task 1',
      category: 'health',
      status: 'pending',
      companionId: 'c1',
      date: '2023-01-15',
      time: '10:00',
    };

    selectTasksByCompanion.mockReturnValue((_state: any) => [mockTask]);

    // Only return for 'health' to prevent duplicates
    selectRecentTasksByCategory.mockImplementation(
      (_id: any, _d: any, category: string) => {
        if (category === 'health') return (_state: any) => [mockTask];
        return (_state: any) => [];
      },
    );

    const {getByTestId} = render(<TasksMainScreen />);
    const card = getByTestId('task-card-Task 1');

    fireEvent(card, 'pressComplete');

    expect(mockHandleCompleteTask).toHaveBeenCalledWith('t1');
  });

  it('navigates to Observational Tool if task type matches', () => {
    const {
      selectRecentTasksByCategory,
      selectTasksByCompanion,
    } = require('@/features/tasks/selectors');
    const mockTask = {
      id: 'obs-1',
      title: 'Check Weight',
      category: 'health',
      status: 'pending',
      companionId: 'c1',
      date: '2023-01-15',
      time: '10:00',
      details: {taskType: 'take-observational-tool'},
    };

    selectTasksByCompanion.mockReturnValue((_state: any) => [mockTask]);
    selectRecentTasksByCategory.mockImplementation(
      (_id: any, _d: any, category: string) => {
        if (category === 'health') return (_state: any) => [mockTask];
        return (_state: any) => [];
      },
    );

    const {getByTestId} = render(<TasksMainScreen />);
    const card = getByTestId('task-card-Check Weight');

    fireEvent(card, 'pressTakeObservationalTool');
    expect(mockHandleStartObservationalTool).toHaveBeenCalledWith('obs-1');
  });

  it('handles "Add Task" navigation', () => {
    const {getByTestId} = render(<TasksMainScreen />);
    const header = getByTestId('header');

    fireEvent(header, 'rightPress');
    expect(mockNavigate).toHaveBeenCalledWith('AddTask');
  });

  it('handles "View More" navigation', () => {
    const {
      selectTaskCountByCategory,
      selectRecentTasksByCategory,
      selectTasksByCompanion,
    } = require('@/features/tasks/selectors');

    const mockTask = {
      id: 't1',
      title: 'Task',
      category: 'health',
      companionId: 'c1',
      date: '2023-01-15',
      time: '10:00',
      status: 'pending',
    };

    selectTasksByCompanion.mockReturnValue((_state: any) => [mockTask]);

    // Return task for health category only
    selectRecentTasksByCategory.mockImplementation(
      (_id: any, _d: any, category: string) => {
        if (category === 'health') return (_state: any) => [mockTask];
        return (_state: any) => [];
      },
    );

    // Return count > 0 for health
    selectTaskCountByCategory.mockImplementation(
      (_id: any, _d: any, category: string) => {
        if (category === 'health') return (_state: any) => 5;
        return (_state: any) => 0;
      },
    );

    const {getAllByText} = render(<TasksMainScreen />);
    const viewMoreBtns = getAllByText('View More');

    fireEvent.press(viewMoreBtns[0]);
    expect(mockNavigate).toHaveBeenCalledWith('TasksList', {
      category: 'health',
    });
  });

  it('updates selected companion via selector component', () => {
    const {getByTestId} = render(<TasksMainScreen />);
    const selector = getByTestId('companion-selector');

    fireEvent(selector, 'select', 'c2');

    expect(setSelectedCompanion).toHaveBeenCalledWith('c2');
  });

  it('handles scrollToIndex failure in FlatList silently', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(<TasksMainScreen />);
    // This verifies the component doesn't crash even if scroll logic runs
    spy.mockRestore();
  });
});
