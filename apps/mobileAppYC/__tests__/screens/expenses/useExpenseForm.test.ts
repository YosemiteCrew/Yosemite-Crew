import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  useExpenseForm,
  DEFAULT_FORM,
} from '@/features/expenses/hooks/useExpenseForm';

// --- Mock Dependencies ---

// FIX: Mock the Alert module to prevent native module errors
jest.mock('react-native/Libraries/Alert/Alert');

// We must mock the types that are imported, as the test runner doesn't
// have access to the actual file at '@/features/expenses/components'.
// We can define local types for this test file based on the hook's usage.
type ExpenseFormData = {
  category: string | null;
  subcategory: string | null;
  visitType: string | null;
  title: string;
  date: Date | null;
  amount: string;
  attachments: any[]; // Based on DEFAULT_FORM
  providerName?: string; // <-- FIX: Made providerName optional
};

// Removed unused ExpenseFormErrors type to fix lint error

// Spy on Alert.alert to ensure it's called when validation fails
// This will now spy on the mock we defined above
jest.spyOn(Alert, 'alert');

// --- Test Suite ---

describe('useExpenseForm', () => {
  // Clear all mocks after each test to ensure isolation
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default form data when no initial data is provided', () => {
    const { result } = renderHook(() => useExpenseForm());

    expect(result.current.formData).toEqual(DEFAULT_FORM);
    expect(result.current.errors).toEqual({});
  });

  it('should initialize with provided initial data', () => {
    const initialData: ExpenseFormData = {
      ...DEFAULT_FORM,
      title: 'Initial Test Expense',
      amount: '100.00',
      category: 'Test',
    };
    const { result } = renderHook(() => useExpenseForm(initialData));

    expect(result.current.formData).toEqual(initialData);
  });

  it('should update a specific form field on handleChange', () => {
    const { result } = renderHook(() => useExpenseForm());

    // Test updating the title
    act(() => {
      result.current.handleChange('title', 'New Title');
    });
    expect(result.current.formData?.title).toBe('New Title');

    // Test updating the amount
    act(() => {
      result.current.handleChange('amount', '123.45');
    });
    expect(result.current.formData?.amount).toBe('123.45');

    // Test updating the date
    const testDate = new Date();
    act(() => {
      result.current.handleChange('date', testDate);
    });
    expect(result.current.formData?.date).toBe(testDate);
  });

  it('should clear a specific error field on handleErrorClear', () => {
    const { result } = renderHook(() => useExpenseForm());

    // First, run validation on an empty form to populate errors
    act(() => {
      result.current.validate('some-companion-id');
    });

    // Check that errors exist
    expect(result.current.errors.title).toBe('Expense name is required');
    expect(result.current.errors.category).toBe('Please choose a category');

    // Clear the title error
    act(() => {
      result.current.handleErrorClear('title');
    });

    // Check that the title error is gone, but others remain
    expect(result.current.errors.title).toBeUndefined();
    expect(result.current.errors.category).toBe('Please choose a category');
  });

  describe('Validation', () => {
    it('should fail validation and show alert if companion is required and not provided', () => {
      const { result } = renderHook(() => useExpenseForm(DEFAULT_FORM, true)); // requireCompanion = true

      let isValid = false;
      act(() => {
        isValid = result.current.validate(null);
      });

      expect(isValid).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Select companion',
        'Please select a companion before saving the expense.',
      );
      expect(Alert.alert).toHaveBeenCalledTimes(1);
    });

    it('should pass companion check if companion is not required and not provided', () => {
      const { result } = renderHook(() => useExpenseForm(DEFAULT_FORM, false)); // requireCompanion = false

      let isValid = false;
      act(() => {
        // Validation will still fail for *other* fields, but not the companion check
        isValid = result.current.validate(null);
      });

      // Still false because other fields are empty
      expect(isValid).toBe(false);
      // Crucially, no alert was shown
      expect(Alert.alert).not.toHaveBeenCalled();
      // And errors should be for form fields
      expect(result.current.errors.title).toBe('Expense name is required');
    });

    it('should fail validation and set all errors if fields are missing', () => {
      const { result } = renderHook(() => useExpenseForm());

      let isValid = false;
      act(() => {
        // Provide a companion ID to pass that check
        isValid = result.current.validate('companion-123');
      });

      expect(isValid).toBe(false);
      const errors = result.current.errors;
      expect(errors.category).toBe('Please choose a category');
      expect(errors.subcategory).toBe('Please choose a sub category');
      expect(errors.visitType).toBe('Visit type is required');
      expect(errors.title).toBe('Expense name is required');
      expect(errors.date).toBe('Pick a date');
      expect(errors.amount).toBe('Enter a valid amount');
    });

    it('should fail validation for invalid amount (NaN)', () => {
      const formData: ExpenseFormData = {
        ...DEFAULT_FORM,
        category: 'Test',
        subcategory: 'Test',
        visitType: 'Test',
        title: 'Test Title',
        date: new Date(),
        amount: 'not-a-number',
      };
      const { result } = renderHook(() => useExpenseForm(formData));

      let isValid = false;
      act(() => {
        isValid = result.current.validate('companion-123');
      });

      expect(isValid).toBe(false);
      expect(result.current.errors.amount).toBe('Enter a valid amount');
    });

    it('should fail validation for empty title (whitespace)', () => {
      const formData: ExpenseFormData = {
        ...DEFAULT_FORM,
        category: 'Test',
        subcategory: 'Test',
        visitType: 'Test',
        title: '   ', // Whitespace
        date: new Date(),
        amount: '100',
      };
      const { result } = renderHook(() => useExpenseForm(formData));

      let isValid = false;
      act(() => {
        isValid = result.current.validate('companion-123');
      });

      expect(isValid).toBe(false);
      expect(result.current.errors.title).toBe('Expense name is required');
    });

    it('should pass validation when all fields are valid (companion required)', () => {
      const validData: ExpenseFormData = {
        category: 'Health',
        subcategory: 'Checkup',
        visitType: 'Virtual',
        title: 'Annual Checkup',
        date: new Date(),
        amount: '150.00',
        attachments: [],
        providerName: 'Dr. Smith',
      };
      const { result } = renderHook(() => useExpenseForm(validData, true)); // requireCompanion = true

      let isValid = false;
      act(() => {
        isValid = result.current.validate('companion-123');
      });

      expect(isValid).toBe(true);
      expect(result.current.errors).toEqual({});
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should pass validation when all fields are valid (companion not required)', () => {
      const validData: ExpenseFormData = {
        category: 'Health',
        subcategory: 'Checkup',
        visitType: 'Virtual',
        title: 'Annual Checkup',
        date: new Date(),
        amount: '150.00',
        attachments: [],
        providerName: 'Dr. Smith',
      };
      const { result } = renderHook(() => useExpenseForm(validData, false)); // requireCompanion = false

      let isValid = false;
      act(() => {
        isValid = result.current.validate(null); // Pass null for companion
      });

      expect(isValid).toBe(true);
      expect(result.current.errors).toEqual({});
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });
});

