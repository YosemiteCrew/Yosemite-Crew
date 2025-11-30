import React from 'react';
import {Image} from 'react-native';
import {render, fireEvent, act} from '@testing-library/react-native';
// Adjust path: 5 levels up from __tests__/features/tasks/screens/TasksMainScreen/ to project root
import {TasksMainScreen} from '../../../../../src/features/tasks/screens/TasksMainScreen/TasksMainScreen';
import * as Redux from 'react-redux';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useFocusEffect: (cb: () => void) => {
      ReactLib.useEffect(cb, []);
    },
  };
});

// 2. Redux
const mockDispatch = jest.fn();
jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
const mockUseSelector = jest.spyOn(Redux, 'useSelector');

// 3. Hooks & Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        border: 'gray',
        primary: 'blue',
        lightBlueBackground: 'lightblue',
        textSecondary: 'grey',
        surface: 'white',
        borderMuted: 'lightgray',
      },
      spacing: new Array(30).fill(8),
      borderRadius: {md: 4, lg: 8},
      typography: {
        h6Clash: {fontSize: 16},
        titleMedium: {fontSize: 18},
        bodyMedium: {fontSize: 14},
      },
    },
  }),
}));

// Mocking assets
jest.mock('@/assets/images', () => ({
  Images: {
    addIconDark: {uri: 'add'},
    leftArrowIcon: {uri: 'left'},
    rightArrowIcon: {uri: 'right'},
  },
}));

jest.mock('../../../../../src/assets/images', () => ({
  Images: {
    addIconDark: {uri: 'add'},
    leftArrowIcon: {uri: 'left'},
    rightArrowIcon: {uri: 'right'},
  },
}));

// 4. Components
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onRightPress}: any) => {
    // Import React Native components inside the mock to avoid hoisting issues
    const {
      TouchableOpacity: MockTouchable,
      Text: MockText,
    } = require('react-native');
    return (
      <MockTouchable onPress={onRightPress}>
        <MockText>{title}</MockText>
        <MockText>HeaderRightBtn</MockText>
      </MockTouchable>
    );
  },
}));

jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => ({
    CompanionSelector: ({onSelect, selectedCompanionId, companions}: any) => {
      const {
        TouchableOpacity: MockTouchable,
        Text: MockText,
        View: MockView,
      } = require('react-native');
      return (
        <MockView>
          <MockText>Selected: {selectedCompanionId}</MockText>
          {companions.map((c: any) => (
            <MockTouchable
              key={c.id}
              testID={`select-companion-${c.id}`}
              onPress={() => onSelect(c.id)}>
              <MockText>{c.name}</MockText>
            </MockTouchable>
          ))}
        </MockView>
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
  }: any) => {
    const {
      TouchableOpacity: MockTouchable,
      Text: MockText,
      View: MockView,
    } = require('react-native');
    return (
      <MockView>
        <MockTouchable onPress={onPressView}>
          <MockText>{title}</MockText>
        </MockTouchable>
        {onPressEdit && (
          <MockTouchable onPress={onPressEdit}>
            <MockText>Edit</MockText>
          </MockTouchable>
        )}
        {onPressComplete && (
          <MockTouchable onPress={onPressComplete}>
            <MockText>Complete</MockText>
          </MockTouchable>
        )}
        {onPressTakeObservationalTool && (
          <MockTouchable onPress={onPressTakeObservationalTool}>
            <MockText>Start OT</MockText>
          </MockTouchable>
        )}
      </MockView>
    );
  },
}));

jest.mock(
  '../../../../../src/features/tasks/screens/EmptyTasksScreen/EmptyTasksScreen',
  () => ({
    EmptyTasksScreen: () => {
      const {View: MockView, Text: MockText} = require('react-native');
      return (
        <MockView>
          <MockText>Empty Screen</MockText>
        </MockView>
      );
    },
  }),
);

// 5. Selectors & Actions
jest.mock('@/features/tasks/selectors', () => ({
  selectHasHydratedCompanion: () => (state: any) => state.mockHydrated,
  selectTasksByCompanion: () => (state: any) => state.mockAllTasks || [],
  selectRecentTasksByCategory:
    (id: string, date: Date, category: string) => (state: any) => {
      return state.mockRecentTasks?.[category] || [];
    },
  selectTaskCountByCategory:
    (id: string, date: Date, category: string) => (state: any) => {
      return state.mockTaskCounts?.[category] || 0;
    },
}));

jest.mock('@/features/auth/selectors', () => ({
  selectAuthUser: (state: any) => state.authUser,
}));

jest.mock('@/features/tasks', () => ({
  fetchTasksForCompanion: jest.fn(() => ({type: 'FETCH_TASKS'})),
  markTaskStatus: jest.fn(payload => ({type: 'MARK_STATUS', payload})),
}));

jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({type: 'SET_COMPANION', payload: id})),
}));

jest.mock('@/features/tasks/utils/taskLabels', () => ({
  resolveCategoryLabel: (cat: string) => cat.toUpperCase(),
}));

// Date helpers mock
jest.mock('@/shared/utils/dateHelpers', () => {
  return {
    getMonthDates: () => {
      return [
        {date: new Date('2023-11-01T00:00:00Z'), dayNumber: 1, dayName: 'Wed'},
        {date: new Date('2023-11-02T00:00:00Z'), dayNumber: 2, dayName: 'Thu'},
        {date: new Date('2023-12-01T00:00:00Z'), dayNumber: 1, dayName: 'Fri'},
      ];
    },
    getPreviousMonth: () => new Date('2023-10-01T00:00:00Z'),
    getNextMonth: () => new Date('2023-12-01T00:00:00Z'),
    formatMonthYear: () => 'Nov 2023',
  };
});

describe('TasksMainScreen', () => {
  const todayStr = '2023-11-01';

  const mockState = {
    companion: {
      companions: [
        {id: 'c1', name: 'Buddy', profileImage: 'img1'},
        {id: 'c2', name: 'Lucy', profileImage: 'img2'},
      ],
      selectedCompanionId: 'c1',
    },
    authUser: {id: 'u1', firstName: 'Owner', profilePicture: 'p1'},
    mockHydrated: true,
    mockAllTasks: [{date: todayStr}],
    mockRecentTasks: {
      health: [],
      hygiene: [],
      dietary: [],
      custom: [],
    },
    mockTaskCounts: {
      health: 0,
      hygiene: 0,
      dietary: 0,
      custom: 0,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSelector.mockImplementation((cb: any) => cb(mockState));
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-11-01T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders correctly with selected companion', () => {
    const {getByText, getAllByText} = render(<TasksMainScreen />);
    expect(getByText('Tasks')).toBeTruthy();
    expect(getAllByText('Selected: c1')).toBeTruthy();
    expect(getByText('HEALTH')).toBeTruthy();
  });

  it('renders EmptyTasksScreen when no companion is selected', () => {
    const emptyState = {
      ...mockState,
      companion: {
        ...mockState.companion,
        selectedCompanionId: null,
      },
    };
    mockUseSelector.mockImplementation((cb: any) => cb(emptyState));
    const {getByText} = render(<TasksMainScreen />);
    expect(getByText('Empty Screen')).toBeTruthy();
  });

  it('auto-selects first companion if none selected but list populated', () => {
    const noSelectionState = {
      ...mockState,
      companion: {
        companions: [{id: 'c1', name: 'Buddy'}],
        selectedCompanionId: null,
      },
    };
    mockUseSelector.mockImplementation((cb: any) => cb(noSelectionState));
    render(<TasksMainScreen />);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_COMPANION',
        payload: 'c1',
      }),
    );
  });

  it('fetches tasks on focus if not hydrated', () => {
    const notHydratedState = {
      ...mockState,
      mockHydrated: false,
    };
    mockUseSelector.mockImplementation((cb: any) => cb(notHydratedState));
    render(<TasksMainScreen />);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FETCH_TASKS',
      }),
    );
  });

  it('handles companion selection change', () => {
    const {getByText} = render(<TasksMainScreen />);
    // In our mock CompanionSelector, the name is clickable.
    fireEvent.press(getByText('Lucy'));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_COMPANION',
        payload: 'c2',
      }),
    );
  });

  it('navigates to AddTask', () => {
    const {getByText} = render(<TasksMainScreen />);
    // In our mock Header, we put 'HeaderRightBtn' as text in the touchable
    fireEvent.press(getByText('HeaderRightBtn'));
    expect(mockNavigate).toHaveBeenCalledWith('AddTask');
  });

  it('handles month navigation (Previous/Next)', () => {
    const {UNSAFE_getAllByType} = render(<TasksMainScreen />);

    // Find Image components by matching the mocked source URI
    const images = UNSAFE_getAllByType(Image);

    const leftArrowImg = images.find(img => img.props.source?.uri === 'left');
    const rightArrowImg = images.find(img => img.props.source?.uri === 'right');

    // Pressing the image propagates to the parent TouchableOpacity
    if (leftArrowImg) fireEvent.press(leftArrowImg);
    if (rightArrowImg) fireEvent.press(rightArrowImg);
  });

  it('renders category sections with correct data', () => {
    const populatedState = {
      ...mockState,
      mockRecentTasks: {
        health: [
          {
            id: 't1',
            title: 'Health Task',
            category: 'health',
            companionId: 'c1',
            status: 'pending',
          },
        ],
        hygiene: [],
        dietary: [],
        custom: [],
      },
      mockTaskCounts: {
        health: 5,
        hygiene: 0,
      },
    };
    mockUseSelector.mockImplementation((cb: any) => cb(populatedState));
    const {getByText} = render(<TasksMainScreen />);
    expect(getByText('Health Task')).toBeTruthy();
    expect(getByText('View More')).toBeTruthy();
    expect(getByText('No hygiene tasks')).toBeTruthy();
  });

  it('handles View More navigation', () => {
    const populatedState = {
      ...mockState,
      mockTaskCounts: {health: 5},
      mockRecentTasks: {
        health: [
          {id: 't1', title: 'T1', category: 'health', companionId: 'c1'},
        ],
      },
    };
    mockUseSelector.mockImplementation((cb: any) => cb(populatedState));

    const {getByText} = render(<TasksMainScreen />);
    const viewMoreBtns = [getByText('View More')];

    fireEvent.press(viewMoreBtns[0]);
    expect(mockNavigate).toHaveBeenCalledWith('TasksList', {
      category: 'health',
    });
  });

  it('handles Task Actions', () => {
    const taskState = {
      ...mockState,
      mockRecentTasks: {
        health: [
          {
            id: 't1',
            title: 'Health Task',
            category: 'health',
            companionId: 'c1',
            status: 'pending',
            details: {taskType: 'take-observational-tool'},
          },
        ],
      },
    };
    mockUseSelector.mockImplementation((cb: any) => cb(taskState));

    const {getByText} = render(<TasksMainScreen />);

    // The mock TaskCard renders these texts inside touchables
    fireEvent.press(getByText('Health Task'));
    expect(mockNavigate).toHaveBeenCalledWith('TaskView', {taskId: 't1'});

    fireEvent.press(getByText('Edit'));
    expect(mockNavigate).toHaveBeenCalledWith('EditTask', {taskId: 't1'});

    fireEvent.press(getByText('Complete'));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MARK_STATUS',
        payload: {taskId: 't1', status: 'completed'},
      }),
    );

    fireEvent.press(getByText('Start OT'));
    expect(mockNavigate).toHaveBeenCalledWith('ObservationalTool', {
      taskId: 't1',
    });
  });

  it('handles date selection and auto-scrolling', () => {
    const {getByText} = render(<TasksMainScreen />);

    // Find text '02' corresponding to the mocked date (Thu, 2nd)
    const dayText = getByText('02');
    fireEvent.press(dayText);

    // Trigger auto-scroll timeout inside useFocusEffect
    act(() => {
      jest.runAllTimers();
    });
  });

  it('exercises FlatList utility functions', () => {
    const {toJSON} = render(<TasksMainScreen />);

    const findNodeWithProp = (node: any, prop: string): any => {
      if (node?.props && node.props[prop]) return node;
      if (node?.children) {
        for (const child of node.children) {
          const found = findNodeWithProp(child, prop);
          if (found) return found;
        }
      }
      return null;
    };

    const flatListNode = findNodeWithProp(toJSON(), 'getItemLayout');
    if (flatListNode) {
      const layout = flatListNode.props.getItemLayout(null, 5);
      expect(layout).toEqual({length: 70.5, offset: 5 * 78.5, index: 5});

      if (flatListNode.props.onScrollToIndexFailed) {
        flatListNode.props.onScrollToIndexFailed({
          index: 0,
          highestMeasuredFrameIndex: 0,
          averageItemLength: 10,
        });
      }
    }
  });
});
