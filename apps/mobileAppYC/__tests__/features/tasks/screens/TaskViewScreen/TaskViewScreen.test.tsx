import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {TaskViewScreen} from '@/features/tasks/screens/TaskViewScreen/TaskViewScreen';
import * as Redux from 'react-redux';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockGetParent = jest.fn().mockReturnValue({
  reset: mockReset,
});

// Mutable route params to allow changing per test
let mockRouteParams = {taskId: 'task-med', source: 'tasks'};

jest.mock('@react-navigation/native', () => {
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      reset: mockReset,
      getParent: mockGetParent,
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
  };
});

// 2. Redux
const mockUseSelector = jest.spyOn(Redux, 'useSelector');

// 3. Mock Hooks & Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        text: 'black',
        secondary: 'blue',
        success: 'green',
        error: 'red',
        white: 'white',
        borderMuted: 'gray',
        primary: 'red',
        textSecondary: 'gray',
      },
      spacing: new Array(30).fill(4),
      borderRadius: {lg: 8, md: 4},
      typography: {
        bodyMedium: {fontSize: 14},
        titleMedium: {fontSize: 16},
        bodySmall: {fontSize: 12},
        buttonH6Clash19: {fontSize: 19},
        inputLabel: {fontSize: 12},
        labelXsBold: {fontSize: 10},
      },
    },
  }),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    editIcon: {uri: 'edit'},
    dropdownIcon: {uri: 'dropdown'},
    clockIcon: {uri: 'clock'},
    calendarIcon: {uri: 'calendar'},
  },
}));

// 4. Mock Components

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack, onRightPress}: any) => {
    const {TouchableOpacity, Text, View} = require('react-native');
    return (
      <View>
        <TouchableOpacity testID="header-back" onPress={onBack}>
          <Text>{title}</Text>
        </TouchableOpacity>
        {onRightPress && (
          <TouchableOpacity testID="header-right" onPress={onRightPress}>
            <Text>Right</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity testID={`btn-${title}`} onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => children,
}));

// Mocking the common index
jest.mock('@/shared/components/common', () => {
  const {View, Text} = require('react-native');
  const Input = ({label, value}: any) => (
    <View testID={`input-${label}`}>
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
  const TouchableInput = ({label, value}: any) => (
    <View testID={`touchable-${label}`}>
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
  const SafeArea = ({children}: any) => <View>{children}</View>;
  return {
    SafeArea,
    Input,
    TouchableInput,
  };
});

jest.mock('@/features/documents/components/DocumentAttachmentsSection', () => ({
  DocumentAttachmentsSection: () => {
    const {View, Text} = require('react-native');
    return (
      <View>
        <Text>Attachments Section</Text>
      </View>
    );
  },
}));

// Use the alias path for local components to ensure correct module resolution
jest.mock(
  '@/features/tasks/screens/TaskViewScreen/components/ViewField',
  () => ({
    ViewField: ({label, value}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID={`view-field-${label}`}>
          <Text>{value}</Text>
        </View>
      );
    },
    ViewTouchField: ({label, value}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID={`view-touch-${label}`}>
          <Text>{value}</Text>
        </View>
      );
    },
  }),
);

jest.mock(
  '@/features/tasks/screens/TaskViewScreen/components/ViewDateTimeRow',
  () => ({
    ViewDateTimeRow: () => {
      const {View, Text} = require('react-native');
      return (
        <View>
          <Text>DateTimeRow</Text>
        </View>
      );
    },
  }),
);

// 5. Mock Selectors and Utils
jest.mock('@/features/tasks/selectors', () => ({
  selectTaskById: (id: string) => (state: any) => {
    // Return specific task based on ID to facilitate different test scenarios
    const tasks = state.tasks;
    return tasks[id] || null;
  },
}));

jest.mock('@/features/auth/selectors', () => ({
  selectAuthUser: (state: any) => state.auth.user,
}));

jest.mock('@/features/tasks/utils/taskLabels', () => ({
  resolveCategoryLabel: (cat: string) => `Category: ${cat}`,
  resolveMedicationTypeLabel: (type: string) => `Type: ${type}`,
  resolveMedicationFrequencyLabel: () => 'Daily',
  resolveTaskFrequencyLabel: () => 'Weekly',
  resolveObservationalToolLabel: () => 'Pain Scale',
  buildTaskTypeBreadcrumb: () => 'Medication > Flea',
}));

jest.mock(
  '@/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => ({
    formatDateForDisplay: (date: Date) => {
      if (!date || Number.isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    },
  }),
);

// Silence warnings
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('TaskViewScreen', () => {
  const mockState = {
    auth: {
      user: {id: 'user-1', firstName: 'John', email: 'john@test.com'},
    },
    companion: {
      companions: [{id: 'comp-1', name: 'Buddy'}],
    },
    tasks: {
      'task-med': {
        id: 'task-med',
        status: 'pending',
        title: 'Give pill',
        category: 'medication',
        companionId: 'comp-1',
        date: '2025-01-01',
        time: '09:00:00',
        frequency: 'daily',
        reminderEnabled: true,
        reminderOptions: '10 mins before',
        syncWithCalendar: true,
        calendarProvider: 'google',
        attachDocuments: true,
        attachments: ['doc1'],
        additionalNote: 'With food',
        assignedTo: 'user-1',
        details: {
          taskType: 'give-medication',
          medicineName: 'Apoquel',
          medicineType: 'pill',
          dosages: [{id: 'd1', label: '1 pill', time: '09:00:00'}],
          startDate: '2025-01-01',
          endDate: '2025-01-10',
          frequency: {type: 'daily'},
        },
      },
      'task-ot': {
        id: 'task-ot',
        status: 'pending',
        title: 'Check pain',
        category: 'health',
        subcategory: 'none', // Test subcategory === 'none' branch
        companionId: 'comp-1',
        date: '2025-01-02',
        time: '2025-01-02T14:30:00.000Z', // ISO Format time
        frequency: 'weekly',
        assignedTo: 'user-2', // Assigned to someone else
        details: {
          taskType: 'take-observational-tool',
          toolType: 'pain-scale',
          chronicConditionType: 'arthritis',
        },
        reminderEnabled: false,
        syncWithCalendar: false,
        attachDocuments: false,
        attachments: [],
      },
      'task-simple': {
        id: 'task-simple',
        status: 'pending',
        title: 'Walk',
        category: 'general',
        subcategory: 'daily-routine',
        companionId: 'comp-1',
        date: '2025-01-03',
        time: 'bad-time', // Invalid time string
        frequency: 'daily',
        details: {
          taskType: 'custom',
          description: 'Long walk',
        },
      },
      'task-completed': {
        id: 'task-completed',
        status: 'completed',
        title: 'Done Task',
        category: 'medication',
        companionId: 'comp-1',
        date: '2025-01-01',
        completedAt: '2025-01-01T10:00:00.000Z',
        details: {
          taskType: 'take-observational-tool',
          toolType: 'pain-scale',
        },
      },
      'task-invalid-time': {
        id: 'task-invalid-time',
        status: 'pending',
        title: 'Weird Time',
        category: 'general',
        companionId: 'comp-1',
        date: '2025-01-01',
        time: 'aa:bb', // NaN time
        details: {taskType: 'custom'},
      },
      'task-iso-no-colon': {
        id: 'task-iso-no-colon',
        status: 'pending',
        title: 'Date Only',
        category: 'general',
        companionId: 'comp-1',
        date: '2025-01-01',
        time: '2025/01/01', // ISO-like but no colons, should trigger fallback block
        details: {taskType: 'custom'},
      },
      'task-icloud': {
        id: 'task-icloud',
        status: 'pending',
        title: 'iCloud Task',
        category: 'general',
        companionId: 'comp-1',
        date: '2025-01-01',
        syncWithCalendar: true,
        calendarProvider: 'apple',
        details: {taskType: 'custom'},
      },
      'task-no-reminder': {
        id: 'task-no-reminder',
        status: 'pending',
        title: 'No Rem',
        category: 'general',
        companionId: 'comp-1',
        date: '2025-01-01',
        reminderEnabled: true,
        reminderOptions: null, // Null reminder options
        details: {taskType: 'custom'},
      },
      'task-unassigned': {
        id: 'task-unassigned',
        status: 'pending',
        title: 'Unassigned',
        category: 'general',
        companionId: 'comp-1',
        assignedTo: null,
        details: {taskType: 'custom'},
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {taskId: 'task-med', source: 'tasks'};
    mockUseSelector.mockImplementation((cb: any) => cb(mockState));
  });

  it('renders medication task details correctly', () => {
    const {getByTestId, getByText} = render(<TaskViewScreen />);

    expect(getByText('Task')).toBeTruthy();
    expect(getByTestId('view-field-Companion')).toBeTruthy();
    expect(getByTestId('view-touch-Task type')).toBeTruthy();

    // Medication specific
    expect(getByTestId('view-field-Task name')).toBeTruthy();
    expect(getByTestId('view-field-Medicine name')).toBeTruthy();
    expect(getByTestId('view-touch-Medication type')).toBeTruthy();
    expect(getByTestId('view-touch-Dosage')).toBeTruthy();

    // Dosage row
    expect(getByTestId('input-Dosage')).toBeTruthy();
    expect(getByTestId('input-Time')).toBeTruthy();

    // Toggles/Sections
    expect(getByText('Reminder')).toBeTruthy();
    expect(getByText('10 mins before')).toBeTruthy();

    expect(getByText('Sync with Calendar')).toBeTruthy();
    expect(getByTestId('touchable-Calendar provider')).toBeTruthy();

    expect(getByText('Attach document')).toBeTruthy();
    expect(getByText('Attachments Section')).toBeTruthy();

    expect(getByTestId('input-Additional note')).toBeTruthy();

    // Medication tasks use Input for assignment
    expect(getByTestId('input-Assign task')).toBeTruthy();
  });

  it('renders observational tool task correctly', () => {
    mockRouteParams = {taskId: 'task-ot', source: 'tasks'};
    const {getByText, getByTestId} = render(<TaskViewScreen />);

    expect(getByText('Time for an observational tool !')).toBeTruthy();
    expect(getByTestId('btn-Start Now')).toBeTruthy();

    expect(getByTestId('view-touch-Select observational tool')).toBeTruthy();
    expect(getByTestId('view-touch-Date')).toBeTruthy();
    expect(getByTestId('view-touch-Time')).toBeTruthy();

    // Assignment (Unknown User) - Observational Tool uses ViewField for assignment
    // And this task is assigned to user-2 (Unknown)
    expect(getByTestId('view-field-Assign task')).toBeTruthy();
    expect(getByText('Unknown')).toBeTruthy();
  });

  it('renders simple task correctly', () => {
    mockRouteParams = {taskId: 'task-simple', source: 'tasks'};
    const {getByTestId, getByText} = render(<TaskViewScreen />);

    expect(getByTestId('view-field-Task name')).toBeTruthy();
    expect(getByTestId('view-field-Task description')).toBeTruthy();
    expect(getByText('DateTimeRow')).toBeTruthy();
  });

  it('renders completed state correctly', () => {
    mockRouteParams = {taskId: 'task-completed', source: 'tasks'};
    const {getByText, queryByTestId} = render(<TaskViewScreen />);

    expect(getByText('Completed on 2025-01-01')).toBeTruthy();
    expect(getByText('Observational tool completed')).toBeTruthy();

    expect(queryByTestId('header-right')).toBeNull();
    expect(queryByTestId('btn-Start Now')).toBeNull();
  });

  it('handles navigation - back from Tasks', () => {
    mockRouteParams = {taskId: 'task-med', source: 'tasks'};
    const {getByTestId} = render(<TaskViewScreen />);

    fireEvent.press(getByTestId('header-back'));

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'TasksMain'}],
    });
  });

  it('handles navigation - back from Home', () => {
    mockRouteParams = {taskId: 'task-med', source: 'home'};
    const {getByTestId} = render(<TaskViewScreen />);

    fireEvent.press(getByTestId('header-back'));

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'HomeStack'}],
    });
  });

  it('handles navigation - Edit', () => {
    mockRouteParams = {taskId: 'task-med', source: 'home'};
    const {getByTestId} = render(<TaskViewScreen />);

    fireEvent.press(getByTestId('header-right'));

    expect(mockNavigate).toHaveBeenCalledWith('EditTask', {
      taskId: 'task-med',
      source: 'home',
    });
  });

  it('handles navigation - Start OT', () => {
    mockRouteParams = {taskId: 'task-ot', source: 'tasks'};
    const {getByTestId} = render(<TaskViewScreen />);

    fireEvent.press(getByTestId('btn-Start Now'));

    expect(mockNavigate).toHaveBeenCalledWith('ObservationalTool', {
      taskId: 'task-ot',
    });
  });

  it('renders error when task not found', () => {
    mockRouteParams = {taskId: 'task-unknown', source: 'tasks'};
    const {getByText, getByTestId} = render(<TaskViewScreen />);

    expect(getByText('Task not found')).toBeTruthy();

    fireEvent.press(getByTestId('header-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  // --- Coverage specific checks ---

  it('handles formatTime edge cases (invalid/missing time)', () => {
    mockRouteParams = {taskId: 'task-simple', source: 'tasks'};
    render(<TaskViewScreen />);
    // Implicit: Should render without crash, time will be empty string in ViewDateTimeRow
  });

  it('handles HH:mm parsing edge cases (invalid hours)', () => {
    // "25:00:00" -> invalid hour -> returns ''
    mockRouteParams = {taskId: 'task-invalid-time', source: 'tasks'};
    render(<TaskViewScreen />);
    // Component handles it gracefully
  });

  it('handles ISO fallback in formatTime (no colon)', () => {
    // task-iso-no-colon uses '2025/01/01' which falls through the first if (no ':')
    // It falls into new Date('2025/01/01') which is valid
    mockRouteParams = {taskId: 'task-iso-no-colon', source: 'tasks'};
    render(<TaskViewScreen />);
  });

  it('handles iCloud calendar provider label', () => {
    mockRouteParams = {taskId: 'task-icloud', source: 'tasks'};
    const {getByTestId} = render(<TaskViewScreen />);
    expect(getByTestId('touchable-Calendar provider')).toBeTruthy();
  });

  it('handles undefined reminder option gracefully', () => {
    mockRouteParams = {taskId: 'task-no-reminder', source: 'tasks'};
    render(<TaskViewScreen />);
    // Implicit: Should render without crash
  });

  it('handles unassigned task', () => {
    mockRouteParams = {taskId: 'task-unassigned', source: 'tasks'};
    const {getByTestId} = render(<TaskViewScreen />);
    // For custom tasks, it uses ViewField
    expect(getByTestId('view-field-Assign task')).toBeTruthy();
  });

  it('handles user name fallbacks in assignment (Email Only)', () => {
    // 1. User with only email
    const emailOnlyState = {
      ...mockState,
      auth: {user: {id: 'user-1', email: 'test@test.com'}}, // No firstName
    };
    mockUseSelector.mockImplementation((cb: any) => cb(emailOnlyState));

    mockRouteParams = {taskId: 'task-med', source: 'tasks'};
    const {getByText} = render(<TaskViewScreen />);
    expect(getByText('test@test.com')).toBeTruthy();
  });

  it('handles user with no name/email fallback (You)', () => {
    // 2. User with just ID
    const idOnlyState = {
      ...mockState,
      auth: {user: {id: 'user-1'}}, // No firstName, no email
    };
    mockUseSelector.mockImplementation((cb: any) => cb(idOnlyState));

    mockRouteParams = {taskId: 'task-med', source: 'tasks'};
    const {getByText} = render(<TaskViewScreen />);
    expect(getByText('You')).toBeTruthy();
  });

  it('handles null auth user (Unknown)', () => {
    const nullAuthState = {
      ...mockState,
      auth: {user: null},
    };
    mockUseSelector.mockImplementation((cb: any) => cb(nullAuthState));

    mockRouteParams = {taskId: 'task-med', source: 'tasks'};
    const {getByText} = render(<TaskViewScreen />);
    expect(getByText('Unknown')).toBeTruthy();
  });
});
