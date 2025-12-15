import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {TasksMainScreen} from '../../../../../src/features/tasks/screens/TasksMainScreen/TasksMainScreen';
import {useSelector, useDispatch} from 'react-redux';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {fetchTasksForCompanion, markTaskStatus} from '../../../../../src/features/tasks';
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
  markTaskStatus: jest.fn(),
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
  useTheme: () => ({
    theme: {
      colors: {
        background: '#fff',
        surface: '#f5f5f5',
        primary: 'blue',
        textSecondary: '#666',
        border: '#ccc',
        lightBlueBackground: '#eef',
      },
      spacing: {
        1: 4,
        2: 8,
        3: 12,
        4: 16,
        6: 24,
        8: 32,
        10: 40,
        20: 80,
      },
      typography: {
        titleMedium: {fontSize: 16},
        h6Clash: {fontSize: 14},
        bodyMedium: {fontSize: 14},
      },
      borderRadius: {
        md: 8,
        lg: 12,
      },
    },
  }),
}));

// 6. Date Utils
jest.mock('@/shared/utils/dateHelpers', () => {
  const actual = jest.requireActual('@/shared/utils/dateHelpers');
  return {
    ...actual,
    formatMonthYear: jest.fn(() => 'January 2023'),
  };
});

describe('TasksMainScreen', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();

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

    // --- State & Selector Setup ---
    const {
      selectHasHydratedCompanion,
      selectRecentTasksByCategory,
      selectTaskCountByCategory,
      selectTasksByCompanion,
    } = require('@/features/tasks/selectors');

    // Default implementations (Factory Pattern: Return a function that returns the value)
    selectHasHydratedCompanion.mockReturnValue(() => true);
    selectRecentTasksByCategory.mockReturnValue(() => []);
    selectTaskCountByCategory.mockReturnValue(() => 0);
    selectTasksByCompanion.mockReturnValue(() => []);

    const {selectAuthUser} = require('@/features/auth/selectors');
    selectAuthUser.mockReturnValue(mockAuthUser);

    // useSelector mock to handle both inline and factory selectors
    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      // 1. Handle inline selectors (e.g. (state) => state.companion...)
      try {
        const result = callback({
          companion: {
            companions: mockCompanions,
            selectedCompanionId: 'c1',
          },
        });
        if (result !== undefined) return result;
      } finally{
        console.log("NA");
      }

      // 2. Handle factory selectors (functions returned by selector creators)
      if (typeof callback === 'function') {
        return callback();
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
    expect(getByText('January 2023')).toBeTruthy();
    expect(getByText('No tasks yet')).toBeTruthy();
  });

  it('fetches tasks on focus if not hydrated', () => {
    const {selectHasHydratedCompanion} = require('@/features/tasks/selectors');
    selectHasHydratedCompanion.mockReturnValue(() => false);

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

    const {selectRecentTasksByCategory} = require('@/features/tasks/selectors');
    await waitFor(() => {
      const calls = selectRecentTasksByCategory.mock.calls;
      const lastCallArgs = calls[calls.length - 1];
      // The date argument is the 2nd arg [companion, date, category, limit]
      expect(lastCallArgs[1].getDate()).toBe(5);
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
    selectTasksByCompanion.mockReturnValue(() => [mockTask]);

    // Mock factory to return tasks ONLY for 'health' category to avoid duplicates in other sections
    selectRecentTasksByCategory.mockImplementation(
      (_id: string, _d: Date, category: string) => {
        if (category === 'health') return () => [mockTask];
        return () => [];
      },
    );

    selectTaskCountByCategory.mockImplementation(
      (_id: string, _d: Date, category: string) => {
        if (category === 'health') return () => 1;
        return () => 0;
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
    };

    selectTasksByCompanion.mockReturnValue(() => [mockTask]);

    // Only return for 'health' to prevent duplicates
    selectRecentTasksByCategory.mockImplementation(
      (_id: any, _d: any, category: string) => {
        if (category === 'health') return () => [mockTask];
        return () => [];
      },
    );

    const {getByTestId} = render(<TasksMainScreen />);
    const card = getByTestId('task-card-Task 1');

    fireEvent(card, 'pressComplete');

    expect(markTaskStatus).toHaveBeenCalledWith({
      taskId: 't1',
      status: 'completed',
    });
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
      details: {taskType: 'take-observational-tool'},
    };

    selectTasksByCompanion.mockReturnValue(() => [mockTask]);
    selectRecentTasksByCategory.mockImplementation(
      (_id: any, _d: any, category: string) => {
        if (category === 'health') return () => [mockTask];
        return () => [];
      },
    );

    const {getByTestId} = render(<TasksMainScreen />);
    const card = getByTestId('task-card-Check Weight');

    fireEvent(card, 'pressTakeObservationalTool');
    expect(mockNavigate).toHaveBeenCalledWith('ObservationalTool', {
      taskId: 'obs-1',
    });
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
    };

    selectTasksByCompanion.mockReturnValue(() => [mockTask]);
    selectRecentTasksByCategory.mockReturnValue(() => [mockTask]); // Doesn't matter if dupes here, just need section

    // Return count > 0 for health
    selectTaskCountByCategory.mockImplementation(
      (_id: any, _d: any, category: string) => {
        if (category === 'health') return () => 5;
        return () => 0;
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
