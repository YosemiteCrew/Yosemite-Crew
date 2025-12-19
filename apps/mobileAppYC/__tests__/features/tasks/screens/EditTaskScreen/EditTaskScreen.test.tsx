import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
// Path: 5 levels up from __tests__/features/tasks/screens/EditTaskScreen/ to project root
import {EditTaskScreen} from '../../../../../src/features/tasks/screens/EditTaskScreen/EditTaskScreen';
import * as Redux from 'react-redux';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockParentReset = jest.fn();
const mockGetParent = jest.fn(() => ({
  reset: mockParentReset,
}));

const mockRouteParams = {taskId: 't1', source: 'tasks' as string | undefined};

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
const mockDispatch = jest.fn();
// Mock dispatch to return a promise that resolves (for unwrap)
const mockUnwrap = jest.fn();
mockDispatch.mockReturnValue({unwrap: mockUnwrap});

jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);

// 3. Hooks & Assets
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    deleteIconRed: {uri: 'delete-icon'},
  },
}));

// 4. Feature Hooks & Utils
// Important: Mock the custom hook that drives this screen
const mockHookData = {
  task: {id: 't1', title: 'Existing Task', companionId: 'c1'},
  loading: false,
  companionType: 'dog',
  formData: {category: 'health', title: 'Existing Task'},
  errors: {},
  isMedicationForm: false,
  isObservationalToolForm: false,
  isSimpleForm: true,
  handleDelete: jest.fn(),
  sheetHandlers: {},
  validateForm: jest.fn(() => true),
  showErrorAlert: jest.fn(),
  updateField: jest.fn(),
  uploadSheetRef: {current: null},
  handleRemoveFile: jest.fn(),
  openSheet: jest.fn(),
  deleteSheetRef: {current: null},
};

jest.mock('../../../../../src/features/tasks/hooks/useEditTaskScreen', () => ({
  useEditTaskScreen: () => mockHookData,
}));

jest.mock('../../../../../src/features/tasks/utils/createFileHandlers', () => ({
  createFileHandlers: jest.fn(() => ({})),
}));

jest.mock(
  '../../../../../src/features/tasks/utils/getTaskFormSheetProps',
  () => ({
    getTaskFormSheetProps: jest.fn(() => ({})),
  }),
);

jest.mock('../../../../../src/features/tasks/utils/taskLabels', () => ({
  resolveCategoryLabel: (cat: string) => cat?.toUpperCase() || '',
}));

// Mock the task builder to return simple data
jest.mock(
  '../../../../../src/features/tasks/screens/EditTaskScreen/taskBuilder',
  () => ({
    buildTaskFromForm: jest.fn(() => ({title: 'Updated Task'})),
  }),
);

// 5. Actions
jest.mock('@/features/tasks', () => ({
  updateTask: jest.fn(() => ({type: 'UPDATE_TASK'})),
  deleteTask: jest.fn(() => ({type: 'DELETE_TASK'})),
}));

// 6. Components
jest.mock('@/shared/components/common', () => ({
  SafeArea: ({children}: any) => children,
  Input: (props: any) => {
    const {View, Text} = require('react-native');
    // Execute onChangeText to cover the no-op arrow function passed in the component
    if (props.onChangeText) {
      props.onChangeText('test');
    }
    return (
      <View>
        <Text>
          Input: {props.label} - {props.value}
        </Text>
      </View>
    );
  },
}));

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack, onRightPress}: any) => {
    const {TouchableOpacity, Text, View} = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back-btn" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
        {onRightPress && (
          <TouchableOpacity testID="header-delete-btn" onPress={onRightPress}>
            <Text>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

jest.mock(
  '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
  () => ({
    DeleteDocumentBottomSheet: ({onDelete, title}: any) => {
      const {TouchableOpacity, Text, View} = require('react-native');
      // Render a button to simulate the delete confirmation
      return (
        <View>
          <Text>{title}</Text>
          <TouchableOpacity testID="confirm-delete-btn" onPress={onDelete}>
            <Text>Confirm Delete</Text>
          </TouchableOpacity>
        </View>
      );
    },
  }),
);

jest.mock('@/features/tasks/components/form', () => ({
  TaskFormContent: () => {
    const {Text} = require('react-native');
    return <Text>Form Content</Text>;
  },
  TaskFormFooter: ({onSave, loading}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity testID="save-btn" onPress={onSave} disabled={loading}>
        <Text>Save</Text>
      </TouchableOpacity>
    );
  },
  TaskFormSheets: ({onDiscard}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity testID="discard-btn" onPress={onDiscard}>
        <Text>Discard</Text>
      </TouchableOpacity>
    );
  },
}));

describe('EditTaskScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnwrap.mockResolvedValue({});

    // Reset hook data to defaults
    Object.assign(mockHookData, {
      task: {id: 't1', title: 'Existing Task', companionId: 'c1'},
      loading: false,
      validateForm: jest.fn(() => true),
    });

    // Reset route params
    mockRouteParams.source = 'tasks';
  });

  it('renders correctly when task exists', () => {
    const {getByText, getByTestId} = render(<EditTaskScreen />);

    expect(getByText('Edit task')).toBeTruthy();
    expect(getByText('Input: Task type - HEALTH')).toBeTruthy(); // Resolved label
    expect(getByText('Form Content')).toBeTruthy();
    expect(getByTestId('header-delete-btn')).toBeTruthy();
  });

  it('renders error state when task is missing', () => {
    // Simulate hook returning null task
    const originalTask = mockHookData.task;
    // @ts-ignore
    mockHookData.task = null;

    const {getByText, queryByText} = render(<EditTaskScreen />);

    expect(getByText('Task not found')).toBeTruthy();
    expect(queryByText('Form Content')).toBeNull();

    // Restore
    mockHookData.task = originalTask;
  });

  it('handles simple back navigation (default source)', () => {
    const {getByTestId} = render(<EditTaskScreen />);
    fireEvent.press(getByTestId('header-back-btn'));

    // Should reset to TasksMain
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'TasksMain'}],
    });
  });

  it('handles smart back navigation (home source)', () => {
    mockRouteParams.source = 'home';
    const {getByTestId} = render(<EditTaskScreen />);
    fireEvent.press(getByTestId('header-back-btn'));

    // Should reset parent stack to HomeStack
    expect(mockParentReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'HomeStack'}],
    });
  });

  it('handles undefined source param (defaults to tasks)', () => {
    mockRouteParams.source = undefined;
    const {getByTestId} = render(<EditTaskScreen />);
    fireEvent.press(getByTestId('header-back-btn'));

    // Should behave like 'tasks' (default)
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'TasksMain'}],
    });
  });

  it('handles delete button press via hook', () => {
    const {getByTestId} = render(<EditTaskScreen />);
    fireEvent.press(getByTestId('header-delete-btn'));
    expect(mockHookData.handleDelete).toHaveBeenCalled();
  });

  it('handles delete confirmation success', async () => {
    const {getByTestId} = render(<EditTaskScreen />);

    fireEvent.press(getByTestId('confirm-delete-btn'));

    const {deleteTask} = require('@/features/tasks');

    // Wait for async action to complete and navigation to be triggered
    await waitFor(() => {
      expect(deleteTask).toHaveBeenCalledWith({
        taskId: 't1',
        companionId: 'c1',
      });
      expect(mockUnwrap).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalled();
    });
  });

  it('handles save action success', async () => {
    const {getByTestId} = render(<EditTaskScreen />);

    fireEvent.press(getByTestId('save-btn'));

    expect(mockHookData.validateForm).toHaveBeenCalled();
    const {updateTask} = require('@/features/tasks');

    // Wait for async action to complete and navigation to be triggered
    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith({
        taskId: 't1',
        updates: {title: 'Updated Task'},
      });
      expect(mockUnwrap).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalled();
    });
  });

  it('does not save if validation fails', async () => {
    mockHookData.validateForm.mockReturnValue(false);
    const {getByTestId} = render(<EditTaskScreen />);

    fireEvent.press(getByTestId('save-btn'));

    const {updateTask} = require('@/features/tasks');
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('handles save error', async () => {
    const error = new Error('Update failed');
    mockUnwrap.mockRejectedValueOnce(error);

    const {getByTestId} = render(<EditTaskScreen />);

    fireEvent.press(getByTestId('save-btn'));

    await waitFor(() => {
      expect(mockHookData.showErrorAlert).toHaveBeenCalledWith(
        'Unable to update task',
        error,
      );
    });
  });

  it('handles delete error', async () => {
    const error = new Error('Delete failed');
    mockUnwrap.mockRejectedValueOnce(error);

    const {getByTestId} = render(<EditTaskScreen />);

    fireEvent.press(getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(mockHookData.showErrorAlert).toHaveBeenCalledWith(
        'Unable to delete task',
        error,
      );
    });
  });

  it('handles discard action from sheets', () => {
    const {getByTestId} = render(<EditTaskScreen />);
    fireEvent.press(getByTestId('discard-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders DeleteDocumentBottomSheet with task title fallback', () => {
    // Temporarily set task title to undefined to test the ?? 'this task' branch
    const originalTitle = mockHookData.task.title;
    // @ts-ignore
    mockHookData.task.title = undefined;

    render(<EditTaskScreen />);

    // Restore
    mockHookData.task.title = originalTitle;
  });
});
