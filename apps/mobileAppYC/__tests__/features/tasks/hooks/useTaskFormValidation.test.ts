import {renderHook} from '@testing-library/react-native';
// Path: 4 levels up to project root
import {useTaskFormValidation} from '../../../../src/features/tasks/hooks/useTaskFormValidation';
import {Alert} from 'react-native';

describe('useTaskFormValidation', () => {
  const mockSetErrors = jest.fn();
  const mockValidateTaskForm = jest.fn();
  const mockFormData: any = { title: 'Test Task' };
  const mockTaskTypeSelection: any = { category: 'health' };

  // Spy on Alert.alert to intercept calls without mocking the whole RN module
  const alertSpy = jest.spyOn(Alert, 'alert');

  beforeEach(() => {
    jest.clearAllMocks();
    // Prevent actual alerts (if any) and ensure clean spy state
    alertSpy.mockImplementation(() => {});
  });

  describe('validateForm', () => {
    it('returns true and sets empty errors when validation succeeds', () => {
      // Setup validation to return no errors
      mockValidateTaskForm.mockReturnValue({});

      const { result } = renderHook(() => useTaskFormValidation({
          setErrors: mockSetErrors,
          validateTaskForm: mockValidateTaskForm
      }));

      const isValid = result.current.validateForm(mockFormData, mockTaskTypeSelection);

      expect(mockValidateTaskForm).toHaveBeenCalledWith(mockFormData, mockTaskTypeSelection);
      expect(mockSetErrors).toHaveBeenCalledWith({});
      expect(isValid).toBe(true);
    });

    it('returns false and sets errors when validation fails', () => {
      const mockErrors = { title: 'Title is required' };
      // Setup validation to return errors
      mockValidateTaskForm.mockReturnValue(mockErrors);

      const { result } = renderHook(() => useTaskFormValidation({
          setErrors: mockSetErrors,
          validateTaskForm: mockValidateTaskForm
      }));

      const isValid = result.current.validateForm(mockFormData, mockTaskTypeSelection);

      expect(mockValidateTaskForm).toHaveBeenCalledWith(mockFormData, mockTaskTypeSelection);
      expect(mockSetErrors).toHaveBeenCalledWith(mockErrors);
      expect(isValid).toBe(false);
    });
  });

  describe('showErrorAlert', () => {
    it('displays alert with error message for Error objects', () => {
      const { result } = renderHook(() => useTaskFormValidation({
          setErrors: mockSetErrors,
          validateTaskForm: mockValidateTaskForm
      }));

      const error = new Error('Something went wrong');
      result.current.showErrorAlert('Test Title', error);

      expect(alertSpy).toHaveBeenCalledWith(
          'Test Title',
          'Something went wrong'
      );
    });

    it('displays default message for non-Error objects', () => {
        const { result } = renderHook(() => useTaskFormValidation({
            setErrors: mockSetErrors,
            validateTaskForm: mockValidateTaskForm
        }));

        const error = 'Just a string error';
        result.current.showErrorAlert('Test Title', error);

        expect(alertSpy).toHaveBeenCalledWith(
            'Test Title',
            'Please try again.'
        );
    });
  });
});