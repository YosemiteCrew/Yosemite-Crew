import {renderHook} from '@testing-library/react-native';
// Path: 4 levels up to project root
import {useTaskFormHelpers} from '../../../../src/features/tasks/hooks/useTaskFormHelpers';
import * as Redux from 'react-redux';
import * as Utils from '../../../../src/features/tasks/utils/taskFormHelpers';
import type {TaskFormData} from '@/features/tasks/types';

// --- Mocks ---

// 1. Redux
const mockUseSelector = jest.spyOn(Redux, 'useSelector');

// 2. Utils
// We mock the utils to verify the hook calls them correctly and returns their result
jest.mock('../../../../src/features/tasks/utils/taskFormHelpers', () => ({
  isMedicationForm: jest.fn(),
  isObservationalToolForm: jest.fn(),
  isSimpleForm: jest.fn(),
}));

describe('useTaskFormHelpers', () => {
  const mockCompanions = [{id: 'c1', name: 'Buddy'}];
  const mockState = {
    companion: {
      companions: mockCompanions,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default selector behavior
    mockUseSelector.mockImplementation((cb: any) => cb(mockState));

    // Default util behavior (all false initially)
    (Utils.isMedicationForm as jest.Mock).mockReturnValue(false);
    (Utils.isObservationalToolForm as jest.Mock).mockReturnValue(false);
    (Utils.isSimpleForm as jest.Mock).mockReturnValue(false);
  });

  it('returns companions from store', () => {
    const formData = { healthTaskType: null } as unknown as TaskFormData;
    const { result } = renderHook(() => useTaskFormHelpers(formData));

    expect(result.current.companions).toEqual(mockCompanions);
    expect(mockUseSelector).toHaveBeenCalled();
  });

  it('determines isMedicationForm correctly via memoization', () => {
    // Setup mock to return true
    (Utils.isMedicationForm as jest.Mock).mockReturnValue(true);

    const formData = { healthTaskType: 'give-medication' } as unknown as TaskFormData;
    const { result } = renderHook(() => useTaskFormHelpers(formData));

    expect(result.current.isMedicationForm).toBe(true);
    expect(Utils.isMedicationForm).toHaveBeenCalledWith('give-medication');
  });

  it('determines isObservationalToolForm correctly via memoization', () => {
    (Utils.isObservationalToolForm as jest.Mock).mockReturnValue(true);

    const formData = { healthTaskType: 'take-observational-tool' } as unknown as TaskFormData;
    const { result } = renderHook(() => useTaskFormHelpers(formData));

    expect(result.current.isObservationalToolForm).toBe(true);
    expect(Utils.isObservationalToolForm).toHaveBeenCalledWith('take-observational-tool');
  });

  it('determines isSimpleForm correctly via memoization', () => {
    (Utils.isSimpleForm as jest.Mock).mockReturnValue(true);

    const formData = { healthTaskType: 'vaccination' } as unknown as TaskFormData;
    const { result } = renderHook(() => useTaskFormHelpers(formData));

    expect(result.current.isSimpleForm).toBe(true);
    expect(Utils.isSimpleForm).toHaveBeenCalledWith('vaccination');
  });

  it('updates values when healthTaskType changes (Branch/Memo coverage)', () => {
    // Start with medication
    (Utils.isMedicationForm as jest.Mock).mockReturnValue(true);
    (Utils.isSimpleForm as jest.Mock).mockReturnValue(false);

    const initialData = { healthTaskType: 'give-medication' } as unknown as TaskFormData;

    const { result, rerender } = renderHook(
      (props) => useTaskFormHelpers(props),
      {
        initialProps: initialData
      }
    );

    expect(result.current.isMedicationForm).toBe(true);
    expect(result.current.isSimpleForm).toBe(false);

    // Change to simple task
    (Utils.isMedicationForm as jest.Mock).mockReturnValue(false);
    (Utils.isSimpleForm as jest.Mock).mockReturnValue(true);

    const nextData = { healthTaskType: 'vaccination' } as unknown as TaskFormData;

    rerender(nextData);

    expect(result.current.isMedicationForm).toBe(false);
    expect(result.current.isSimpleForm).toBe(true);
  });
});