import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  ExpenseForm,
  type ExpenseFormData,
  type ExpenseFormProps,
} from '@/components/expenses/ExpenseForm/ExpenseForm';
import type {Companion} from '@/features/companion/types';
import type {ExpenseAttachment} from '@/features/expenses';

// --- MOCK DEPENDENCIES ---

// Define mocks *inside* the factory function to avoid hoisting issues
jest.mock('@/hooks', () => {
  const mockHandleTakePhoto = jest.fn();
  const mockHandleChooseFromGallery = jest.fn();
  const mockHandleUploadFromDrive = jest.fn();

  return {
    useTheme: () => ({
      theme: {
        spacing: {1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 24: 96},
        colors: {
          background: '#FFF',
          secondary: '#000',
          white: '#FFF',
          borderMuted: '#DDD',
          primary: '#123',
        },
        typography: {
          label: {fontSize: 14},
          paragraphBold: {fontSize: 16, fontWeight: 'bold'},
        },
        borderRadius: {
          lg: 8,
        },
        shadows: {
          md: {},
          lg: {},
        },
      },
    }),
    useDocumentFileHandlers: jest.fn(() => ({
      handleTakePhoto: mockHandleTakePhoto,
      handleChooseFromGallery: mockHandleChooseFromGallery,
      handleUploadFromDrive: mockHandleUploadFromDrive,
    })), // Expose the inner mocks if needed by tests (optional, but can be helpful for verification)
    __mockHandleTakePhoto: mockHandleTakePhoto,
    __mockHandleChooseFromGallery: mockHandleChooseFromGallery,
    __mockHandleUploadFromDrive: mockHandleUploadFromDrive,
  };
});

// Mock assets
jest.mock('@/assets/images', () => ({
  Images: {
    dropdownIcon: 'dropdown.png',
    calendarIcon: 'calendar.png',
    paw: 'paw.png',
    plusIcon: 'plus.png',
  },
}));

// Mock utils
jest.mock('@/utils/currency', () => ({
  resolveCurrencySymbol: () => '$',
}));
jest.mock('@/utils/expenseLabels', () => ({
  resolveCategoryLabel: (val: string) => `Label:${val}`,
  resolveSubcategoryLabel: (cat: string, sub: string) => `Label:${sub}`,
  resolveVisitTypeLabel: (val: string) => `Label:${val}`,
}));

// Mock child components with inline requires
jest.mock('@/components/common/CompanionSelector/CompanionSelector', () => ({
  CompanionSelector: jest.fn(props => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID="mock-CompanionSelector" />;
  }),
}));
jest.mock('@/components/common/Input/Input', () => ({
  Input: jest.fn(props => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID={`mock-Input-${props.label}`} />;
  }),
}));
jest.mock('@/components/common/TouchableInput/TouchableInput', () => ({
  TouchableInput: jest.fn(props => {
    const {View: MockView} = require('react-native');
    return (
      <MockView
        {...props}
        testID={`mock-TouchableInput-${props.placeholder}`}
      />
    );
  }),
}));
jest.mock(
  '@/components/common/LiquidGlassButton/LiquidGlassButton',
  () => (props: any) => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID="mock-LiquidGlassButton" />;
  },
);
jest.mock('@/components/common/SimpleDatePicker/SimpleDatePicker', () => ({
  SimpleDatePicker: jest.fn(props => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID="mock-SimpleDatePicker" />;
  }),
  formatDateForDisplay: (date: Date) => date.toISOString().split('T')[0],
}));
jest.mock('@/components/documents/DocumentAttachmentsSection', () => ({
  DocumentAttachmentsSection: jest.fn(props => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID="mock-DocumentAttachmentsSection" />;
  }),
}));

// Mock Bottom Sheets and their Refs
const mockOpenCategorySheet = jest.fn();
const mockOpenSubcategorySheet = jest.fn();
const mockOpenVisitTypeSheet = jest.fn();
const mockOpenUploadSheet = jest.fn();
const mockOpenDeleteSheet = jest.fn();

jest.mock('@/components/common/CategoryBottomSheet/CategoryBottomSheet', () => {
  const MockReact = require('react');
  const {View: MockView} = require('react-native');
  return {
    CategoryBottomSheet: MockReact.forwardRef((props: any, ref: any) => {
      MockReact.useImperativeHandle(ref, () => ({open: mockOpenCategorySheet}));
      return <MockView {...props} testID="mock-CategoryBottomSheet" />;
    }),
  };
});
jest.mock(
  '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet',
  () => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return {
      SubcategoryBottomSheet: MockReact.forwardRef((props: any, ref: any) => {
        MockReact.useImperativeHandle(ref, () => ({
          open: mockOpenSubcategorySheet,
        }));
        return <MockView {...props} testID="mock-SubcategoryBottomSheet" />;
      }),
    };
  },
);
jest.mock(
  '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet',
  () => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return {
      VisitTypeBottomSheet: MockReact.forwardRef((props: any, ref: any) => {
        MockReact.useImperativeHandle(ref, () => ({
          open: mockOpenVisitTypeSheet,
        }));
        return <MockView {...props} testID="mock-VisitTypeBottomSheet" />;
      }),
    };
  },
);
jest.mock(
  '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet',
  () => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return {
      UploadDocumentBottomSheet: MockReact.forwardRef(
        (props: any, ref: any) => {
          MockReact.useImperativeHandle(ref, () => ({
            open: mockOpenUploadSheet,
          }));
          return (
            <MockView {...props} testID="mock-UploadDocumentBottomSheet" />
          );
        },
      ),
    };
  },
);
jest.mock(
  '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
  () => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return {
      DeleteDocumentBottomSheet: MockReact.forwardRef(
        (props: any, ref: any) => {
          MockReact.useImperativeHandle(ref, () => ({
            open: mockOpenDeleteSheet,
          }));
          return (
            <MockView {...props} testID="mock-DeleteDocumentBottomSheet" />
          );
        },
      ),
    };
  },
);
// --- END MOCKS ---

const mockCompanions: Companion[] = [
  {id: 'comp1', name: 'Buddy', category: 'dog'} as Companion,
];

const defaultFormData: ExpenseFormData = {
  category: null,
  subcategory: null,
  visitType: null,
  title: '',
  date: null,
  amount: '',
  attachments: [],
  providerName: '',
};

const renderComponent = (props: Partial<ExpenseFormProps> = {}) => {
  const mockOnFormChange = jest.fn();
  const mockOnErrorClear = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnCompanionSelect = jest.fn();

  const allProps: ExpenseFormProps = {
    companions: mockCompanions,
    selectedCompanionId: 'comp1',
    onCompanionSelect: mockOnCompanionSelect,
    formData: defaultFormData,
    onFormChange: mockOnFormChange,
    errors: {},
    onErrorClear: mockOnErrorClear,
    loading: false,
    onSave: mockOnSave,
    currencyCode: 'USD',
    ...props,
  };

  const utils = render(<ExpenseForm {...allProps} />);
  return {
    ...utils,
    mockOnFormChange,
    mockOnErrorClear,
    mockOnSave,
    mockOnCompanionSelect,
    props: allProps, // Return the props for re-rendering
  };
};

describe('ExpenseForm', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Reset mocks on the hook itself if needed (especially if calls accumulate across tests)
    const mockedHooks = jest.requireMock('@/hooks');
    (mockedHooks.useDocumentFileHandlers as jest.Mock).mockClear();
    // Also clear the inner mock function calls if necessary, accessing via the exported names
    // mockedHooks.__mockHandleTakePhoto.mockClear();
    // mockedHooks.__mockHandleChooseFromGallery.mockClear();
    // mockedHooks.__mockHandleUploadFromDrive.mockClear();
  });

  it('should render all fields correctly', () => {
    const {getByTestId, getByText} = renderComponent();
    expect(getByTestId('mock-TouchableInput-Category')).toBeTruthy();
    expect(getByTestId('mock-TouchableInput-Sub category')).toBeTruthy();
    expect(getByTestId('mock-TouchableInput-Visit type')).toBeTruthy();
    expect(getByTestId('mock-Input-Expense name')).toBeTruthy();
    expect(getByTestId('mock-Input-Provider / Business')).toBeTruthy();
    expect(getByTestId('mock-TouchableInput-Date')).toBeTruthy();
    expect(getByTestId('mock-Input-Amount')).toBeTruthy();
    expect(getByText('$')).toBeTruthy();
    expect(getByTestId('mock-DocumentAttachmentsSection')).toBeTruthy();
    expect(getByTestId('mock-LiquidGlassButton').props.title).toBe('Save');
  });

  it('should hide provider field if showProviderField is false', () => {
    const {queryByTestId} = renderComponent({showProviderField: false});
    expect(queryByTestId('mock-Input-Provider / Business')).toBeNull();
  });

  it('should call onFormChange when typing in expense name', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const nameInput = getByTestId('mock-Input-Expense name');
    act(() => nameInput.props.onChangeText('New Vet Bill'));
    expect(mockOnFormChange).toHaveBeenCalledWith('title', 'New Vet Bill');
    expect(mockOnErrorClear).toHaveBeenCalledWith('title');
  });

  it('should call onFormChange when typing in provider name', () => {
    const {getByTestId, mockOnFormChange} = renderComponent();
    const providerInput = getByTestId('mock-Input-Provider / Business');
    act(() => providerInput.props.onChangeText('Pet Vet'));
    expect(mockOnFormChange).toHaveBeenCalledWith('providerName', 'Pet Vet');
  });

  it('should sanitize and call onFormChange for amount', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const amountInput = getByTestId('mock-Input-Amount');
    act(() => amountInput.props.onChangeText('123.45abc!'));
    expect(mockOnFormChange).toHaveBeenCalledWith('amount', '123.45');
    expect(mockOnErrorClear).toHaveBeenCalledWith('amount');
  });

  it('should toggle the date picker', () => {
    const {getByTestId} = renderComponent();
    const datePicker = getByTestId('mock-SimpleDatePicker'); // Check initial state

    expect(datePicker.props.show).toBe(false); // Open

    fireEvent.press(getByTestId('mock-TouchableInput-Date')); // Re-query the picker after the state update
    expect(getByTestId('mock-SimpleDatePicker').props.show).toBe(true); // Close

    act(() => getByTestId('mock-SimpleDatePicker').props.onDismiss());
    expect(getByTestId('mock-SimpleDatePicker').props.show).toBe(false);
  });

  it('should call onFormChange when date is selected', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const datePicker = getByTestId('mock-SimpleDatePicker');
    act(() =>
      datePicker.props.onDateChange(new Date('2023-10-10T00:00:00.000Z')),
    );
    expect(mockOnFormChange).toHaveBeenCalledWith(
      'date',
      new Date('2023-10-10T00:00:00.000Z'),
    );
    expect(mockOnErrorClear).toHaveBeenCalledWith('date');
  });

  it('should open category bottom sheet', () => {
    const {getByTestId} = renderComponent();
    fireEvent.press(getByTestId('mock-TouchableInput-Category'));
    expect(mockOpenCategorySheet).toHaveBeenCalled();
  });

  it('should open subcategory bottom sheet only if category is selected', () => {
    const {getByTestId, rerender, props} = renderComponent({
      formData: {...defaultFormData, category: null},
    });
    const subCategoryInput = getByTestId('mock-TouchableInput-Sub category');

    expect(subCategoryInput.props.disabled).toBe(true);
    fireEvent.press(subCategoryInput);
    expect(mockOpenSubcategorySheet).not.toHaveBeenCalled();

    rerender(
      <ExpenseForm
        {...props}
        formData={{...defaultFormData, category: 'health'}}
      />,
    );

    const subCategoryInputEnabled = getByTestId(
      'mock-TouchableInput-Sub category',
    );
    expect(subCategoryInputEnabled.props.disabled).toBe(false);
    fireEvent.press(subCategoryInputEnabled);
    expect(mockOpenSubcategorySheet).toHaveBeenCalled();
  });

  it('should open visit type bottom sheet', () => {
    const {getByTestId} = renderComponent();
    fireEvent.press(getByTestId('mock-TouchableInput-Visit type'));
    expect(mockOpenVisitTypeSheet).toHaveBeenCalled();
  });

  it('should call onFormChange and clear subcategory on category save', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const categorySheet = getByTestId('mock-CategoryBottomSheet');
    act(() => categorySheet.props.onSave('health'));
    expect(mockOnFormChange).toHaveBeenCalledWith('category', 'health');
    expect(mockOnFormChange).toHaveBeenCalledWith('subcategory', null);
    expect(mockOnErrorClear).toHaveBeenCalledWith('category');
  });

  it('should call onFormChange on subcategory save', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const subcategorySheet = getByTestId('mock-SubcategoryBottomSheet');
    act(() => subcategorySheet.props.onSave('vaccination'));
    expect(mockOnFormChange).toHaveBeenCalledWith('subcategory', 'vaccination');
    expect(mockOnErrorClear).toHaveBeenCalledWith('subcategory');
  });

  it('should call onFormChange on visit type save', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const visitTypeSheet = getByTestId('mock-VisitTypeBottomSheet');
    act(() => visitTypeSheet.props.onSave('Hospital'));
    expect(mockOnFormChange).toHaveBeenCalledWith('visitType', 'Hospital');
    expect(mockOnErrorClear).toHaveBeenCalledWith('visitType');
  });

  it('should display category and subcategory labels/values when provided in initial formData', () => {
    const initialData: ExpenseFormData = {
      ...defaultFormData,
      category: 'food',
      subcategory: 'treats',
      date: new Date('2023-05-15T00:00:00.000Z'), // Also test date label/value
      visitType: 'Checkup', // Also test visit type label/value
    };
    const {getByTestId} = renderComponent({formData: initialData}); // Check Category input

    const categoryInput = getByTestId('mock-TouchableInput-Category');
    expect(categoryInput.props.label).toBe('Category'); // Label appears
    expect(categoryInput.props.value).toBe('Label:food'); // Value is resolved label // Check Subcategory input

    const subcategoryInput = getByTestId('mock-TouchableInput-Sub category');
    expect(subcategoryInput.props.label).toBe('Sub category'); // Label appears
    expect(subcategoryInput.props.value).toBe('Label:treats'); // Value is resolved label
    expect(subcategoryInput.props.disabled).toBe(false); // Should be enabled // Check Date input

    const dateInput = getByTestId('mock-TouchableInput-Date');
    expect(dateInput.props.label).toBe('Date'); // Label appears
    expect(dateInput.props.value).toBe('2023-05-15'); // Value is formatted date // Check Visit Type input

    const visitTypeInput = getByTestId('mock-TouchableInput-Visit type');
    expect(visitTypeInput.props.label).toBe('Visit type'); // Label appears
    expect(visitTypeInput.props.value).toBe('Label:Checkup'); // Value is resolved label
  });

  it('should call onSave when save button is pressed', () => {
    const {getByTestId, mockOnSave} = renderComponent();
    fireEvent.press(getByTestId('mock-LiquidGlassButton'));
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('should show loading state in save button', () => {
    const {getByTestId} = renderComponent({loading: true});
    expect(getByTestId('mock-LiquidGlassButton').props.title).toBe('Saving...');
  });

  it('should call onCompanionSelect from CompanionSelector', () => {
    const {getByTestId, mockOnCompanionSelect} = renderComponent();
    const selector = getByTestId('mock-CompanionSelector');
    act(() => selector.props.onSelect('comp2'));
    expect(mockOnCompanionSelect).toHaveBeenCalledWith('comp2');
  });

  it('should open upload sheet from DocumentAttachmentsSection', () => {
    const {getByTestId} = renderComponent();
    const attachmentsSection = getByTestId('mock-DocumentAttachmentsSection');
    act(() => attachmentsSection.props.onAddPress());
    expect(mockOpenUploadSheet).toHaveBeenCalled();
  });

  it('should call callbacks from useDocumentFileHandlers', () => {
    const {mockOnFormChange, mockOnErrorClear} = renderComponent();
    const mockAttachment: ExpenseAttachment = {id: 'file-new'} as any; // Access the mocked hook directly

    const mockedHooks = jest.requireMock('@/hooks');
    const hookInstance = mockedHooks.useDocumentFileHandlers as jest.Mock; // Get the arguments passed to the hook mock during the first render

    const hookArgs = hookInstance.mock.calls[0][0];
    expect(hookArgs).toBeDefined(); // Test the setFiles callback

    act(() => hookArgs.setFiles([mockAttachment]));
    expect(mockOnFormChange).toHaveBeenCalledWith('attachments', [
      mockAttachment,
    ]); // Test the clearError callback

    act(() => hookArgs.clearError());
    expect(mockOnErrorClear).toHaveBeenCalledWith('attachments');
  });

  it('should handle file deletion flow', () => {
    const mockAttachment: ExpenseAttachment = {
      id: 'file1',
      name: 'test.pdf',
    } as any;
    const {getByTestId, mockOnFormChange} = renderComponent({
      formData: {...defaultFormData, attachments: [mockAttachment]},
    }); // 1. User requests to remove the file

    const attachmentsSection = getByTestId('mock-DocumentAttachmentsSection');
    act(() => {
      attachmentsSection.props.onRequestRemove(mockAttachment);
    }); // 2. State is set internally, and delete sheet is opened (behavior)

    expect(mockOpenDeleteSheet).toHaveBeenCalled(); // 3. User confirms deletion in the bottom sheet

    const deleteSheet = getByTestId('mock-DeleteDocumentBottomSheet');
    act(() => {
      deleteSheet.props.onDelete(); // This will call confirmDeleteFile
    }); // 4. onFormChange is called with the filtered list

    expect(mockOnFormChange).toHaveBeenCalledWith('attachments', []); // 5. Check that the internal state was cleared // by confirming a second delete does nothing

    mockOnFormChange.mockClear();
    act(() => {
      deleteSheet.props.onDelete();
    });
    expect(mockOnFormChange).not.toHaveBeenCalled();
  });

  it('should do nothing if confirmDeleteFile is called with no file to delete', () => {
    const {getByTestId, mockOnFormChange} = renderComponent(); // fileToDelete is null internally

    const deleteSheet = getByTestId('mock-DeleteDocumentBottomSheet');
    act(() => {
      deleteSheet.props.onDelete();
    });

    expect(mockOnFormChange).not.toHaveBeenCalled();
  });
});
