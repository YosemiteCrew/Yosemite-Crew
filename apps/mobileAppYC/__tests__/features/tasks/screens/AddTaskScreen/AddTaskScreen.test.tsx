import React from 'react';
import {render, fireEvent, screen, act} from '@testing-library/react-native';
import {AddTaskScreen} from '../../../../../src/features/tasks/screens/AddTaskScreen/AddTaskScreen';
import {useAddTaskScreen} from '../../../../../src/features/tasks/hooks/useAddTaskScreen';
import {selectTaskById} from '@/features/tasks/selectors';
import {buildTaskTypeBreadcrumb} from '../../../../../src/features/tasks/utils/taskLabels';
import {buildTaskDraftFromForm} from '../../../../../src/features/tasks/services/taskService';
import {mockTheme} from '../../../../setup/mockTheme';

// --- Mocks ---

// 1. Navigation
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
let mockRouteParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    canGoBack: mockCanGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

// 2. Redux
const mockDispatch = jest.fn();
const mockAuthUser = {id: 'user-1', firstName: 'John', email: 'john@test.com'};
const mockCoParents: any[] = [];
const mockState = {
  auth: {
    user: mockAuthUser,
  },
  coParent: {
    coParents: mockCoParents,
  },
  tasks: {},
};
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (cb: any) => cb(mockState),
}));

// Mock selectors
jest.mock('@/features/tasks/selectors', () => ({
  selectTaskById: jest.fn(() => () => null),
}));

jest.mock('@/features/auth/selectors', () => ({
  selectAuthUser: jest.fn(state => state.auth.user),
}));

jest.mock('@/features/coParent/selectors', () => ({
  selectAcceptedCoParents: jest.fn(state => state.coParent.coParents),
}));

// Mock companion actions
jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({
    type: 'companion/setSelected',
    payload: id,
  })),
}));

// 3. Hooks & Theme
jest.mock('../../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 4. Feature Actions
jest.mock('@/features/tasks', () => ({
  addTask: jest.fn(),
  updateTask: jest.fn(),
  setTaskCalendarEventId: jest.fn(() => ({type: 'SET_CALENDAR'})),
}));
const tasksMock = jest.requireMock('@/features/tasks');
const mockAddTask = tasksMock.addTask as jest.Mock;
const mockUpdateTask = tasksMock.updateTask as jest.Mock;

// Mock upload and calendar functions
jest.mock('@/features/documents/documentSlice', () => ({
  uploadDocumentFiles: jest.fn(),
}));
const mockUploadDocumentFiles = jest.requireMock(
  '@/features/documents/documentSlice',
).uploadDocumentFiles as jest.Mock;

jest.mock('@/features/tasks/services/calendarSyncService', () => ({
  createCalendarEventForTask: jest.fn(),
}));

jest.mock('@/features/tasks/utils/userHelpers', () => ({
  getAssignedUserName: jest.fn(() => 'Test User'),
}));

// 5. Custom Hook Mock
jest.mock('../../../../../src/features/tasks/hooks/useAddTaskScreen');

// 6. Utils & Builders
jest.mock('../../../../../src/features/tasks/utils/taskLabels', () => ({
  buildTaskTypeBreadcrumb: jest.fn(),
}));

jest.mock('../../../../../src/features/tasks/services/taskService', () => ({
  buildTaskDraftFromForm: jest.fn(() => ({
    companionId: 'c1',
    category: 'CUSTOM',
    name: 'New Task',
    dueAt: new Date().toISOString(),
  })),
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

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <View testID="liquid-glass-header-screen">
          {header}
          {typeof children === 'function' ? children(null) : children}
        </View>
      ),
    };
  },
);

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
    TaskFormSheets: () => <View testID="task-form-sheets" />,
  };
});

describe('AddTaskScreen', () => {
  const mockOpenTaskSheet = jest.fn();
  const mockTaskTypeSheetRef = {current: {open: jest.fn()}};
  const mockUnwrap = jest.fn();

  const defaultHookData = {
    companions: [{id: 'c1', name: 'Buddy', type: 'dog'}],
    selectedCompanionId: 'c1',
    loading: false,
    companionType: 'dog',
    formData: {
      category: 'health',
      title: 'Test Task',
      attachments: [],
      syncWithCalendar: false,
    },
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
    mockRouteParams = {};
    (selectTaskById as jest.Mock).mockImplementation(() => () => null);
    (useAddTaskScreen as jest.Mock).mockReturnValue(defaultHookData);
    (buildTaskTypeBreadcrumb as jest.Mock).mockReturnValue('Breadcrumb String');

    // Setup mockAsyncThunk return value
    mockUnwrap.mockResolvedValue({id: 'new-task-id', date: '2026-04-10'});
    mockAddTask.mockReturnValue({
      unwrap: mockUnwrap,
      type: 'tasks/addTask',
    });

    // Setup mockUpdateTask return value
    mockUpdateTask.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({id: 'new-task-id'}),
      type: 'tasks/updateTask',
    });

    // Setup mockUploadDocumentFiles return value
    mockUploadDocumentFiles.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue([]),
      type: 'documents/uploadDocumentFiles',
    });

    // IMPORTANT: mockDispatch must return the action object so .unwrap() can be called on it
    mockDispatch.mockImplementation(action => action);
  });

  it('prefills date from navigation params when opening AddTask directly', () => {
    const updateFieldMock = jest.fn();
    mockRouteParams = {prefillDate: '2026-04-10'};
    (useAddTaskScreen as jest.Mock).mockReturnValue({
      ...defaultHookData,
      updateField: updateFieldMock,
    });

    render(<AddTaskScreen />);

    expect(updateFieldMock).toHaveBeenCalledWith('date', expect.any(Date));
    const dateArg = updateFieldMock.mock.calls.find(
      call => call[0] === 'date',
    )?.[1] as Date | undefined;
    const startDateArg = updateFieldMock.mock.calls.find(
      call => call[0] === 'startDate',
    )?.[1] as Date | undefined;
    expect(dateArg?.getFullYear()).toBe(2026);
    expect(dateArg?.getMonth()).toBe(3);
    expect(dateArg?.getDate()).toBe(10);
    expect(startDateArg?.getFullYear()).toBe(2026);
    expect(startDateArg?.getMonth()).toBe(3);
    expect(startDateArg?.getDate()).toBe(10);
  });

  it('uses route prefillDate when reusing an existing task', () => {
    const updateFieldMock = jest.fn();
    const handleTaskTypeSelectMock = jest.fn();
    mockRouteParams = {reuseTaskId: 'task-1', prefillDate: '2026-05-12'};
    (selectTaskById as jest.Mock).mockImplementation(
      (taskId: string) => () =>
        taskId === 'task-1'
          ? {
              id: 'task-1',
              companionId: 'c1',
              category: 'health',
              subcategory: 'none',
              title: 'Reuse me',
              frequency: 'daily',
              additionalNote: 'note',
              assignedTo: null,
              attachments: [],
              details: {},
            }
          : null,
    );
    (useAddTaskScreen as jest.Mock).mockReturnValue({
      ...defaultHookData,
      updateField: updateFieldMock,
      handleTaskTypeSelect: handleTaskTypeSelectMock,
    });

    render(<AddTaskScreen />);

    const dateArg = updateFieldMock.mock.calls.find(
      call => call[0] === 'date',
    )?.[1] as Date | undefined;
    const startDateArg = updateFieldMock.mock.calls.find(
      call => call[0] === 'startDate',
    )?.[1] as Date | undefined;
    expect(dateArg?.getFullYear()).toBe(2026);
    expect(dateArg?.getMonth()).toBe(4);
    expect(dateArg?.getDate()).toBe(12);
    expect(startDateArg?.getFullYear()).toBe(2026);
    expect(startDateArg?.getMonth()).toBe(4);
    expect(startDateArg?.getDate()).toBe(12);
    expect(handleTaskTypeSelectMock).toHaveBeenCalled();
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
      expect(buildTaskDraftFromForm).toHaveBeenCalledWith({
        formData: expect.objectContaining({
          category: 'health',
          title: 'Test Task',
          attachments: [],
        }),
        companionId: 'c1',
        observationToolId: undefined,
      });
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

  describe('Prefill from reuse task — advanced branches', () => {
    it('prefills time and attachments from reuse task', () => {
      const updateFieldMock = jest.fn();
      const handleTaskTypeSelectMock = jest.fn();
      mockRouteParams = {reuseTaskId: 'task-full', prefillDate: '2026-06-01'};
      (selectTaskById as jest.Mock).mockImplementation(
        (taskId: string) => () =>
          taskId === 'task-full'
            ? {
                id: 'task-full',
                companionId: 'c1',
                category: 'health',
                subcategory: 'checkup',
                title: 'Full task',
                frequency: 'daily',
                additionalNote: 'note',
                assignedTo: 'user-1',
                time: '09:30',
                attachments: [{id: 'att1', name: 'file.pdf'}],
                details: {
                  taskType: 'give-medication',
                  medicineName: 'Aspirin',
                  medicineType: 'tablet',
                  dosages: [{id: 'd1', label: '1 tablet'}],
                  description: 'Take with food',
                  chronicConditionType: 'arthritis',
                },
                observationToolId: 'tool-123',
              }
            : null,
      );
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        updateField: updateFieldMock,
        handleTaskTypeSelect: handleTaskTypeSelectMock,
      });

      render(<AddTaskScreen />);

      // time prefill path
      expect(updateFieldMock).toHaveBeenCalledWith('time', expect.any(Date));
      // attachments prefill path
      expect(updateFieldMock).toHaveBeenCalledWith(
        'attachments',
        expect.any(Array),
      );
      expect(updateFieldMock).toHaveBeenCalledWith('attachDocuments', true);
      // medication fields
      expect(updateFieldMock).toHaveBeenCalledWith('medicineName', 'Aspirin');
      expect(updateFieldMock).toHaveBeenCalledWith('medicineType', 'tablet');
      expect(updateFieldMock).toHaveBeenCalledWith(
        'dosages',
        expect.any(Array),
      );
      expect(updateFieldMock).toHaveBeenCalledWith(
        'description',
        'Take with food',
      );
      // observational tool
      expect(updateFieldMock).toHaveBeenCalledWith(
        'observationalTool',
        'tool-123',
      );
    });

    it('prefills without prefillDate using fallback tomorrow date', () => {
      const updateFieldMock = jest.fn();
      mockRouteParams = {reuseTaskId: 'task-nodateprefix'};
      (selectTaskById as jest.Mock).mockImplementation(
        (taskId: string) => () =>
          taskId === 'task-nodateprefix'
            ? {
                id: 'task-nodateprefix',
                companionId: null,
                category: 'custom',
                subcategory: 'none',
                title: 'No date task',
                frequency: 'once',
                additionalNote: '',
                assignedTo: null,
                attachments: [],
                details: {},
              }
            : null,
      );
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        updateField: updateFieldMock,
      });

      render(<AddTaskScreen />);

      // Should still set date to fallback (tomorrow)
      expect(updateFieldMock).toHaveBeenCalledWith('date', expect.any(Date));
    });

    it('handles invalid prefillDate string (falls back to parsePrefillDate ISO)', () => {
      const updateFieldMock = jest.fn();
      // Use an ISO datetime string (not date-only) — triggers the `new Date(value)` path
      mockRouteParams = {prefillDate: '2026-07-15T10:00:00.000Z'};
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        updateField: updateFieldMock,
      });

      render(<AddTaskScreen />);

      expect(updateFieldMock).toHaveBeenCalledWith('date', expect.any(Date));
    });

    it('does not set date when prefillDate is entirely invalid', () => {
      const updateFieldMock = jest.fn();
      mockRouteParams = {prefillDate: 'not-a-date'};
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        updateField: updateFieldMock,
      });

      render(<AddTaskScreen />);

      // parsePrefillDate returns null for invalid, so updateField('date') not called
      // (no reuseTaskId, so prefillFormFromTask not called either)
      expect(updateFieldMock).not.toHaveBeenCalledWith(
        'date',
        expect.any(Date),
      );
    });
  });

  describe('Calendar sync on save', () => {
    // clearAllMocks in outer beforeEach resets jest.fn(() => x) defaults too.
    // Restore critical mocks here so the save handler can complete.
    beforeEach(() => {
      const {buildTaskDraftFromForm: bdf} = jest.requireMock(
        '../../../../../src/features/tasks/services/taskService',
      );
      (bdf as jest.Mock).mockReturnValue({
        companionId: 'c1',
        category: 'health',
        title: 'Test',
        dueAt: new Date().toISOString(),
        syncWithCalendar: true,
        calendarProvider: 'google',
      });

      // mockUnwrap is cleared by clearAllMocks — restore it
      mockUnwrap.mockResolvedValue({
        id: 'new-task-id',
        date: '2026-04-10',
        syncWithCalendar: true,
        calendarProvider: 'google',
      });
      mockAddTask.mockReturnValue({
        unwrap: mockUnwrap,
        type: 'tasks/addTask',
      });
      mockUpdateTask.mockReturnValue({
        unwrap: jest.fn().mockResolvedValue({id: 'new-task-id'}),
        type: 'tasks/updateTask',
      });
      mockDispatch.mockImplementation(action => action);
    });

    it('creates calendar event and persists event ID when syncWithCalendar is true', async () => {
      const calendarMock = jest.requireMock(
        '@/features/tasks/services/calendarSyncService',
      );
      calendarMock.createCalendarEventForTask.mockResolvedValue('event-id-123');

      const validateFormMock = jest.fn().mockReturnValue(true);
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        companions: [{id: 'c1', name: 'Buddy'}],
        formData: {
          ...defaultHookData.formData,
          syncWithCalendar: true,
          calendarProvider: 'google',
          calendarProviderName: 'Google Calendar',
          attachments: [],
        },
        validateForm: validateFormMock,
      });

      render(<AddTaskScreen />);

      const saveBtn = screen.getByTestId('save-button');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      expect(calendarMock.createCalendarEventForTask).toHaveBeenCalled();
    });

    it('handles null eventId from createCalendarEventForTask gracefully', async () => {
      const calendarMock = jest.requireMock(
        '@/features/tasks/services/calendarSyncService',
      );
      calendarMock.createCalendarEventForTask.mockResolvedValue(null);

      const validateFormMock = jest.fn().mockReturnValue(true);
      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        companions: [{id: 'c1', name: 'Buddy'}],
        formData: {
          ...defaultHookData.formData,
          syncWithCalendar: true,
          calendarProvider: 'google',
          attachments: [],
        },
        validateForm: validateFormMock,
      });

      render(<AddTaskScreen />);

      const saveBtn = screen.getByTestId('save-button');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      // eventId null → no setTaskCalendarEventId, but navigation still happens
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({name: 'TasksMain'}),
      );
    });

    it('uploads attachments before saving when present', async () => {
      const validateFormMock = jest.fn().mockReturnValue(true);
      const mockFile = {name: 'file.pdf', uri: 'file://path/to/file.pdf'};

      const uploadedFile = {...mockFile, id: 'uploaded-1'};
      mockUploadDocumentFiles.mockReturnValue({
        unwrap: jest.fn().mockResolvedValue([uploadedFile]),
        type: 'documents/uploadDocumentFiles',
      });

      (useAddTaskScreen as jest.Mock).mockReturnValue({
        ...defaultHookData,
        formData: {
          ...defaultHookData.formData,
          attachments: [mockFile],
          syncWithCalendar: false,
        },
        validateForm: validateFormMock,
      });

      render(<AddTaskScreen />);

      const saveBtn = screen.getByTestId('save-button');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      expect(mockUploadDocumentFiles).toHaveBeenCalledWith(
        expect.objectContaining({companionId: 'c1'}),
      );
    });
  });
});
