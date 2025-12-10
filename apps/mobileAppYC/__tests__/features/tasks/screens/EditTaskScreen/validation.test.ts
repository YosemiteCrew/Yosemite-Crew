import {validateTaskForm} from '../../../../../src/features/tasks/screens/EditTaskScreen/validation';
import {validateTaskForm as validateTaskFormUtility} from '@/features/tasks/utils/taskValidation';

// Mock the utility function to verify it's called with the correct parameters
jest.mock('@/features/tasks/utils/taskValidation', () => ({
  validateTaskForm: jest.fn(),
}));

describe('EditTaskScreen Validation', () => {
  it('calls the validation utility with edit-specific options', () => {
    const mockFormData: any = {
        title: 'Test Task',
        category: 'health'
    };

    const mockErrors = {
        title: 'Title is required'
    };

    // Setup mock return value
    (validateTaskFormUtility as jest.Mock).mockReturnValue(mockErrors);

    // Execute
    const result = validateTaskForm(mockFormData);

    // Verify
    expect(validateTaskFormUtility).toHaveBeenCalledWith(
      mockFormData, // passed through
      null, // companionId is null in this wrapper
      expect.objectContaining({
        requireTaskTypeSelection: false, // Critical for edit mode
        checkBackdates: false, // Critical for edit mode
      })
    );

    // Ensure the errors are passed back
    expect(result).toEqual(mockErrors);
  });
});