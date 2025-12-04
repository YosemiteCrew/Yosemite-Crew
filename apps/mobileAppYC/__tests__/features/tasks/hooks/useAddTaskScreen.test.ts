import {renderHook, act} from '@testing-library/react-native';
// Path: 4 levels up to project root (was 5)
import {useAddTaskScreen} from '../../../../src/features/tasks/hooks/useAddTaskScreen';
import * as Redux from 'react-redux';
import * as TaskFormHelpers from '../../../../src/features/tasks/utils/taskFormHelpers';
import * as TaskFormSetup from '../../../../src/features/tasks/hooks/useTaskFormSetup';
import * as UseTaskFormHelpers from '../../../../src/features/tasks/hooks/useTaskFormHelpers';
import * as ScreenHandlers from '../../../../src/features/tasks/hooks/useScreenHandlers';

// --- Mocks ---

// 1. Redux
const mockDispatch = jest.fn();
jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
const mockUseSelector = jest.spyOn(Redux, 'useSelector');

// 2. Feature Actions
jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn((id) => ({type: 'SET_COMPANION', payload: id})),
}));

// 3. Utils & Internal Hooks
jest.mock('@/features/tasks/utils/taskFormHelpers', () => ({
  getUpdatedFormDataFromTaskType: jest.fn(),
  getErrorFieldsToClear: jest.fn(),
}));

// Fixed relative paths for mocks (4 levels up)
jest.mock('../../../../src/features/tasks/hooks/useTaskFormSetup', () => ({
  useTaskFormSetup: jest.fn(),
}));

jest.mock('../../../../src/features/tasks/hooks/useTaskFormHelpers', () => ({
  useTaskFormHelpers: jest.fn(),
}));

jest.mock('../../../../src/features/tasks/hooks/useScreenHandlers', () => ({
  useScreenHandlers: jest.fn(),
}));

jest.mock('@/features/tasks/screens/AddTaskScreen/validation', () => ({
    validateTaskForm: jest.fn(),
}));

describe('useAddTaskScreen', () => {
  const mockNavigation = { navigate: jest.fn() };

  // Default mock returns
  const mockFormSetup = {
    formData: { title: '' },
    hasUnsavedChanges: false,
    setErrors: jest.fn(),
    setHasUnsavedChanges: jest.fn(),
    updateField: jest.fn(),
    clearError: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (TaskFormSetup.useTaskFormSetup as jest.Mock).mockReturnValue(mockFormSetup);
    (UseTaskFormHelpers.useTaskFormHelpers as jest.Mock).mockReturnValue(mockTaskFormHelpers);
    (ScreenHandlers.useScreenHandlers as jest.Mock).mockReturnValue(mockScreenHandlers);

    // Default Selector: 1 companion, none selected, loading false
    mockUseSelector.mockImplementation((cb: any) => {
        const state = {
            companion: {
                companions: [{id: 'c1', category: 'cat'}],
                selectedCompanionId: null,
            },
            tasks: { loading: false }
        };
        return cb(state);
    });
  });

  describe('Initialization & Side Effects', () => {
    it('auto-selects the first companion if none is selected (Effect branch coverage)', () => {
      renderHook(() => useAddTaskScreen(mockNavigation));

      expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'SET_COMPANION', payload: 'c1' })
      );
    });

    it('does NOT auto-select if a companion is already selected (Effect branch coverage)', () => {
       mockUseSelector.mockImplementation((cb: any) => cb({
            companion: {
                companions: [{id: 'c1'}, {id: 'c2'}],
                selectedCompanionId: 'c2', // Already selected
            },
            tasks: { loading: false }
        }));

        renderHook(() => useAddTaskScreen(mockNavigation));
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('does NOT auto-select if companion list is empty (Effect branch coverage)', () => {
         mockUseSelector.mockImplementation((cb: any) => cb({
            companion: {
                companions: [], // Empty
                selectedCompanionId: null,
            },
            tasks: { loading: false }
        }));

        renderHook(() => useAddTaskScreen(mockNavigation));
        expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('Selectors & Derived State', () => {
      it('returns correct companion type when companion is found', () => {
          mockUseSelector.mockImplementation((cb: any) => cb({
            companion: {
                companions: [{id: 'c1', category: 'cat'}],
                selectedCompanionId: 'c1',
            },
            tasks: { loading: false }
        }));

        const { result } = renderHook(() => useAddTaskScreen(mockNavigation));
        expect(result.current.companionType).toBe('cat');
      });

      it('defaults companion type to "dog" if not found (Derived state branch coverage)', () => {
          mockUseSelector.mockImplementation((cb: any) => cb({
            companion: {
                companions: [{id: 'c1', category: 'cat'}],
                selectedCompanionId: 'c99', // Does not exist
            },
            tasks: { loading: false }
        }));

        const { result } = renderHook(() => useAddTaskScreen(mockNavigation));
        expect(result.current.companionType).toBe('dog');
      });
  });

  describe('Handlers', () => {
      it('handleCompanionSelect dispatches action if id provided', () => {
          const { result } = renderHook(() => useAddTaskScreen(mockNavigation));

          act(() => {
              result.current.handleCompanionSelect('c2');
          });

          expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({payload: 'c2'}));
      });

      it('handleCompanionSelect ignores null id (Branch coverage)', () => {
          const { result } = renderHook(() => useAddTaskScreen(mockNavigation));
          mockDispatch.mockClear(); // Clear initial auto-select

          act(() => {
              result.current.handleCompanionSelect(null);
          });

          expect(mockDispatch).not.toHaveBeenCalled();
      });

      it('handleTaskTypeSelect updates form, state, and clears errors', () => {
          const { result } = renderHook(() => useAddTaskScreen(mockNavigation));
          const mockSelection: any = { category: 'health', taskType: 'meds' };
          const mockUpdates = { title: 'New Title', category: 'health' };
          const mockFieldsToClear: any[] = ['title', 'category'];

          (TaskFormHelpers.getUpdatedFormDataFromTaskType as jest.Mock).mockReturnValue(mockUpdates);
          (TaskFormHelpers.getErrorFieldsToClear as jest.Mock).mockReturnValue(mockFieldsToClear);

          act(() => {
              result.current.handleTaskTypeSelect(mockSelection);
          });

          // 1. Updates fields
          expect(mockFormSetup.updateField).toHaveBeenCalledWith('title', 'New Title');
          expect(mockFormSetup.updateField).toHaveBeenCalledWith('category', 'health');

          // 2. Sets selection state
          expect(result.current.taskTypeSelection).toEqual(mockSelection);

          // 3. Marks unsaved changes
          expect(mockFormSetup.setHasUnsavedChanges).toHaveBeenCalledWith(true);

          // 4. Clears errors
          expect(mockFormSetup.clearError).toHaveBeenCalledWith('title');
          expect(mockFormSetup.clearError).toHaveBeenCalledWith('category');
      });
  });
});