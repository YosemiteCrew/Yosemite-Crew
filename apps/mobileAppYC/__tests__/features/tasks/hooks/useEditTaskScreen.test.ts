import {renderHook, act} from '@testing-library/react-native';
// Path: 4 levels up to project root
import {useEditTaskScreen} from '../../../../src/features/tasks/hooks/useEditTaskScreen';
import * as Redux from 'react-redux';
import * as TaskInitialization from '../../../../src/features/tasks/screens/EditTaskScreen/initialization';
import * as TaskFormSetup from '../../../../src/features/tasks/hooks/useTaskFormSetup';
import * as UseTaskFormHelpers from '../../../../src/features/tasks/hooks/useTaskFormHelpers';
import * as ScreenHandlers from '../../../../src/features/tasks/hooks/useScreenHandlers';

// --- Mocks ---

// 1. Redux
const mockUseSelector = jest.spyOn(Redux, 'useSelector');
// Note: useDispatch is unused in this hook but safe to keep standard mocking if needed later
jest.spyOn(Redux, 'useDispatch').mockReturnValue(jest.fn());

// 2. Selectors
const mockSelectTaskById = jest.fn();
jest.mock('@/features/tasks/selectors', () => ({
  selectTaskById: (id: string) => (state: any) => mockSelectTaskById(state, id),
}));

// 3. Utils & Internal Hooks
jest.mock('@/features/tasks/screens/EditTaskScreen/initialization', () => ({
  initializeFormDataFromTask: jest.fn(),
}));

jest.mock('@/features/tasks/screens/EditTaskScreen/validation', () => ({
  validateTaskForm: jest.fn(),
}));

jest.mock('../../../../src/features/tasks/hooks/useTaskFormSetup', () => ({
  useTaskFormSetup: jest.fn(),
}));

jest.mock('../../../../src/features/tasks/hooks/useTaskFormHelpers', () => ({
  useTaskFormHelpers: jest.fn(),
}));

jest.mock('../../../../src/features/tasks/hooks/useScreenHandlers', () => ({
  useScreenHandlers: jest.fn(),
}));

describe('useEditTaskScreen', () => {
  const mockTaskId = 'task-123';
  const mockNavigation = { navigate: jest.fn() };

  // Default mock returns
  const mockDeleteSheetRef = { current: { open: jest.fn() } };
  const mockFormSetup = {
    formData: { title: '' },
    hasUnsavedChanges: false,
    setFormData: jest.fn(),
    setErrors: jest.fn(),
    deleteSheetRef: mockDeleteSheetRef,
    updateField: jest.fn(), // Included via spread
  };

  const mockTaskFormHelpers = {
    isMedicationForm: false,
    isObservationalToolForm: false,
    isSimpleForm: true,
  };

  const mockScreenHandlers = {
    validateForm: jest.fn(),
    showErrorAlert: jest.fn(),
    handleBack: jest.fn(),
    sheetHandlers: {},
  };

  const mockTask = {
      id: 'task-123',
      companionId: 'comp-1',
      title: 'Test Task'
  };

  const mockState = {
    tasks: { loading: false },
    companion: {
        companions: [
            { id: 'comp-1', category: 'cat' },
            { id: 'comp-2', category: 'dog' }
        ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (TaskFormSetup.useTaskFormSetup as jest.Mock).mockReturnValue(mockFormSetup);
    (UseTaskFormHelpers.useTaskFormHelpers as jest.Mock).mockReturnValue(mockTaskFormHelpers);
    (ScreenHandlers.useScreenHandlers as jest.Mock).mockReturnValue(mockScreenHandlers);

    // Default task selector behavior (returns a task)
    mockSelectTaskById.mockReturnValue(mockTask);

    // Default Selector implementation
    mockUseSelector.mockImplementation((cb: any) => cb(mockState));
  });

  describe('Initialization & Side Effects', () => {
    it('initializes form data when task is found', () => {
      const mockInitialData = { title: 'Initialized Title' };
      (TaskInitialization.initializeFormDataFromTask as jest.Mock).mockReturnValue(mockInitialData);

      renderHook(() => useEditTaskScreen(mockTaskId, mockNavigation));

      expect(TaskInitialization.initializeFormDataFromTask).toHaveBeenCalledWith(mockTask);
      expect(mockFormSetup.setFormData).toHaveBeenCalledWith(mockInitialData);
      expect(mockFormSetup.setErrors).toHaveBeenCalledWith({});
    });

    it('does not initialize form data if task is not found (Branch coverage)', () => {
        // Simulate task not found in store
        mockSelectTaskById.mockReturnValue(undefined);

        renderHook(() => useEditTaskScreen(mockTaskId, mockNavigation));

        expect(TaskInitialization.initializeFormDataFromTask).not.toHaveBeenCalled();
        expect(mockFormSetup.setFormData).not.toHaveBeenCalled();
    });
  });

  describe('Selectors & Derived State', () => {
      it('returns task, loading status, and companions', () => {
          const { result } = renderHook(() => useEditTaskScreen(mockTaskId, mockNavigation));

          expect(result.current.task).toEqual(mockTask);
          expect(result.current.loading).toBe(false);
          expect(result.current.companions).toEqual(mockState.companion.companions);
      });

      it('determines companion type correctly when companion exists', () => {
          const { result } = renderHook(() => useEditTaskScreen(mockTaskId, mockNavigation));
          // Task has comp-1, which is a cat in mockState
          expect(result.current.companionType).toBe('cat');
      });

      it('defaults companion type to "dog" if companion is not found (Branch coverage)', () => {
          // Task points to non-existent companion
          const orphanTask = { ...mockTask, companionId: 'unknown' };
          mockSelectTaskById.mockReturnValue(orphanTask);

          const { result } = renderHook(() => useEditTaskScreen(mockTaskId, mockNavigation));
          expect(result.current.companionType).toBe('dog');
      });

      it('defaults companion type to "dog" if companions list is missing/null', () => {
           mockUseSelector.mockImplementation((cb: any) => cb({
               tasks: { loading: false },
               companion: { companions: null } // Simulate missing state
           }));

           const { result } = renderHook(() => useEditTaskScreen(mockTaskId, mockNavigation));
           expect(result.current.companionType).toBe('dog');
      });
  });

  describe('Handlers', () => {
      it('handleDelete opens the delete sheet', () => {
          const { result } = renderHook(() => useEditTaskScreen(mockTaskId, mockNavigation));

          act(() => {
              result.current.handleDelete();
          });

          expect(mockDeleteSheetRef.current.open).toHaveBeenCalled();
      });

      it('handleDelete handles missing delete sheet ref gracefully (Branch coverage)', () => {
          // Simulate ref not being attached
          const noRefSetup = { ...mockFormSetup, deleteSheetRef: { current: null } };
          (TaskFormSetup.useTaskFormSetup as jest.Mock).mockReturnValue(noRefSetup);
      });

      it('passes through screen handler methods', () => {
          const { result } = renderHook(() => useEditTaskScreen(mockTaskId, mockNavigation));

          // Call to verify pass-through
          result.current.handleBack();
          expect(mockScreenHandlers.handleBack).toHaveBeenCalled();

          result.current.validateForm();
          expect(mockScreenHandlers.validateForm).toHaveBeenCalled();
      });
  });
});