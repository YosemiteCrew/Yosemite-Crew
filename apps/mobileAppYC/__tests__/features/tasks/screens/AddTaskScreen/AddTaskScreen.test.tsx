import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {AddTaskScreen} from '../../../../../src/features/tasks/screens/AddTaskScreen/AddTaskScreen';
import {useAddTaskScreen} from '../../../../../src/features/tasks/hooks/useAddTaskScreen';
import {addTask} from '../../../../../src/features/tasks';
import {buildTaskTypeBreadcrumb} from '../../../../../src/features/tasks/utils/taskLabels';
import {mockTheme} from '../../../../setup/mockTheme';

// --- Mocks ---

// 1. Navigation
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

// 2. Redux
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

// 3. Hooks & Theme
jest.mock('../../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 4. Feature Actions
// We mock the module, but define the implementation in beforeEach to avoid hoisting issues
jest.mock('../../../../../src/features/tasks', () => ({
  addTask: jest.fn(),
}));

// 5. Custom Hook Mock
jest.mock('../../../../../src/features/tasks/hooks/useAddTaskScreen');

// 6. Utils & Builders
jest.mock('../../../../../src/features/tasks/utils/taskLabels', () => ({
  buildTaskTypeBreadcrumb: jest.fn(),
}));

jest.mock(
  '../../../../../src/features/tasks/screens/AddTaskScreen/taskBuilder',
  () => ({
    buildTaskFromForm: jest.fn(() => ({title: 'New Task'})),
  }),
);

jest.mock('../../../../../src/features/tasks/utils/createFileHandlers', () => ({
  createFileHandlers: jest.fn(() => ({})),
}));

jest.mock(
  '../../../../../src/features/tasks/utils/getTaskFormSheetProps',
  () => ({
    getTaskFormSheetProps: jest.fn(() => ({})),
  }),
);

jest.mock('../../../../../src/features/tasks/screens/styles', () => ({
  createTaskFormStyles: jest.fn(() => ({
    container: {},
    contentContainer: {},
    companionSelector: {},
  })),
}));

// 7. Components - Use standard Views instead of custom tags to ensure props like disabled are passed correctly
jest.mock('../../../../../src/shared/components/common', () => {
  const {View} = require('react-native');
  return {
    SafeArea: ({children}: any) => <View testID="safe-area">{children}</View>,
  };
});

jest.mock('../../../../../src/shared/components/common/Header/Header', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, onBack}: any) => (
      <View testID="header">
        <Text>{title}</Text>
        {onBack && (
          <TouchableOpacity testID="header-back" onPress={onBack}>
            <Text>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
  };
});

jest.mock(
  '../../../../../src/shared/components/common/CompanionSelector/CompanionSelector',
  () => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return {
      CompanionSelector: ({onSelect}: any) => (
        <View testID="companion-selector">
          <TouchableOpacity onPress={() => onSelect('c1')}>
            <Text>Select Companion</Text>
          </TouchableOpacity>
        </View>
      ),
    };
  },
);

// Mock feature components
jest.mock('../../../../../src/features/tasks/components/form', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    TaskFormContent: ({taskTypeSelectorProps}: any) => (
      <View testID="task-form-content">
        <Text>{taskTypeSelectorProps?.value}</Text>
        <TouchableOpacity
          onPress={taskTypeSelectorProps?.onPress}
          testID="selector-trigger">
          <Text>Open Selector</Text>
        </TouchableOpacity>
      </View>
    ),
    TaskFormFooter: ({onSave, disabled}: any) => (
      <View testID="task-form-footer">
        {/* Pass disabled prop through to TouchableOpacity for testing */}
        <TouchableOpacity
          onPress={onSave}
          disabled={disabled}
          testID="save-button"
          accessibilityState={{disabled}}>
          <Text>Save</Text>
        </TouchableOpacity>
      </View>
    ),
    TaskFormSheets: () => (
      <View testID="task-form-sheets" />
    ),
  };
});

describe('AddTaskScreen', () => {
  const mockOpenTaskSheet = jest.fn();
  const mockTaskTypeSheetRef = {current: {open: jest.fn()}};
  const mockUnwrap = jest.fn();

  const defaultHookData = {
    companions: [],
    selectedCompanionId: 'c1',
    loading: false,
    companionType: 'dog',
    formData: {category: 'health'},
    errors: {},
    taskTypeSelection: {category: 'health', taskType: 'vaccination'},
    isMedicationForm: false,
    isObservationalToolForm: false,
    isSimpleForm: true,
    handleTaskTypeSelect: jest.fn(),
    handleCompanionSelect: jest.fn(),
    handleBack: jest.fn(),
    sheetHandlers: {},
    validateForm: jest.fn(),
    showErrorAlert: jest.fn(),
    updateField: jest.fn(),
    taskTypeSheetRef: mockTaskTypeSheetRef,
    uploadSheetRef: {current: null},
    handleRemoveFile: jest.fn(),
    openSheet: jest.fn(),
    openTaskSheet: mockOpenTaskSheet,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAddTaskScreen as jest.Mock).mockReturnValue(defaultHookData);
    (buildTaskTypeBreadcrumb as jest.Mock).mockReturnValue('Breadcrumb String');

    // Setup mockAsyncThunk return value
    mockUnwrap.mockResolvedValue({});
    (addTask as unknown as jest.Mock).mockReturnValue({
      unwrap: mockUnwrap,
      type: 'tasks/addTask',
    });

    // IMPORTANT: mockDispatch must return the action object so .unwrap() can be called on it
    mockDispatch.mockImplementation(action => action);
  });

  it('renders correctly with initial state', () => {
    render(<AddTaskScreen />);

    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.getByTestId('companion-selector')).toBeTruthy();
    expect(screen.getByTestId('task-form-content')).toBeTruthy();
    expect(screen.getByTestId('task-form-footer')).toBeTruthy();
    expect(screen.getByTestId('task-form-sheets')).toBeTruthy();
  });

  it('renders navigation back button action', () => {
    const handleBackMock = jest.fn();
    (useAddTaskScreen as jest.Mock).mockReturnValue({
      ...defaultHookData,
      handleBack: handleBackMock,
    });

    render(<AddTaskScreen />);
    const backBtn = screen.getByTestId('header-back');
    fireEvent.press(backBtn);
    expect(handleBackMock).toHaveBeenCalled();
  });

  describe('Task Form Footer (Disabled State)', () => {
    it('is enabled when loading is false and taskTypeSelection is set', () => {
      render(<AddTaskScreen />);
      const footer = screen.getByTestId('save-button');
      // In RNTL, 'disabled' prop check might vary, checking accessibilityState is reliable
      expect(footer.props.accessibilityState.disabled).toBe(false);
    });

    it('is disabled when loading is true', () => {
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        loading: true,
      });
      render(<AddTaskScreen />);
      const footer = screen.getByTestId('save-button');
      expect(footer.props.accessibilityState.disabled).toBe(true);
    });

    it('is disabled when taskTypeSelection is missing', () => {
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        taskTypeSelection: null,
      });
      render(<AddTaskScreen />);
      const footer = screen.getByTestId('save-button');
      expect(footer.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('Task Type Selector Logic', () => {
    it('passes formatted breadcrumb value when selection exists', () => {
      render(<AddTaskScreen />);

      expect(screen.getByText('Breadcrumb String')).toBeTruthy();

      expect(buildTaskTypeBreadcrumb).toHaveBeenCalledWith(
        'health',
        undefined,
        undefined,
        undefined,
        'vaccination',
      );
    });

    it('passes undefined value when selection is null', () => {
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        taskTypeSelection: null,
      });
      render(<AddTaskScreen />);

      expect(screen.queryByText('Breadcrumb String')).toBeNull();
    });

    it('opens task sheet when selector is pressed', () => {
      render(<AddTaskScreen />);

      const trigger = screen.getByTestId('selector-trigger');
      fireEvent.press(trigger);

      expect(mockOpenTaskSheet).toHaveBeenCalledWith('task-type');
      expect(mockTaskTypeSheetRef.current.open).toHaveBeenCalled();
    });
  });

  describe('Save Action', () => {
    it('saves successfully when validation passes', async () => {
      const validateFormMock = jest.fn().mockReturnValue(true);
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        validateForm: validateFormMock,
      });

      render(<AddTaskScreen />);

      const saveBtn = screen.getByTestId('save-button');
      await fireEvent.press(saveBtn);

      expect(validateFormMock).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalled();
      expect(addTask).toHaveBeenCalled();
      expect(mockUnwrap).toHaveBeenCalled(); // Ensures .unwrap() was called
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('aborts save if validation fails', async () => {
      const validateFormMock = jest.fn().mockReturnValue(false);
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        validateForm: validateFormMock,
      });

      render(<AddTaskScreen />);

      const saveBtn = screen.getByTestId('save-button');
      await fireEvent.press(saveBtn);

      expect(validateFormMock).toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('shows error if no companion is selected', async () => {
      const validateFormMock = jest.fn().mockReturnValue(true);
      const showErrorAlertMock = jest.fn();
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        selectedCompanionId: null,
        validateForm: validateFormMock,
        showErrorAlert: showErrorAlertMock,
      });

      render(<AddTaskScreen />);

      const saveBtn = screen.getByTestId('save-button');
      await fireEvent.press(saveBtn);

      expect(showErrorAlertMock).toHaveBeenCalledWith(
        'Error',
        expect.any(Error),
      );
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('shows error if API call fails', async () => {
      const validateFormMock = jest.fn().mockReturnValue(true);
      const showErrorAlertMock = jest.fn();
      mockUnwrap.mockRejectedValue(new Error('API Error'));

      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        validateForm: validateFormMock,
        showErrorAlert: showErrorAlertMock,
      });

      render(<AddTaskScreen />);

      const saveBtn = screen.getByTestId('save-button');
      await fireEvent.press(saveBtn);

      expect(mockDispatch).toHaveBeenCalled();
      expect(showErrorAlertMock).toHaveBeenCalledWith(
        'Unable to add task',
        expect.any(Error),
      );
    });
  });

  describe('Interactions', () => {
    it('calls handleCompanionSelect when companion is selected', () => {
      const handleSelectMock = jest.fn();
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        handleCompanionSelect: handleSelectMock,
      });

      render(<AddTaskScreen />);

      const selectorBtn = screen.getByText('Select Companion');
      fireEvent.press(selectorBtn);

      expect(handleSelectMock).toHaveBeenCalledWith('c1');
    });
  });
});
