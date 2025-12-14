import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';

const mockHandleTakePhoto = jest.fn();
const mockHandleChooseFromGallery = jest.fn();
const mockHandleUploadFromDrive = jest.fn();
const mockHandleRemoveFile = jest.fn();
const mockConfirmDeleteFile = jest.fn();

jest.mock('@/hooks', () => {
  const mockOpenSheetInternal = jest.fn();
  const mockCloseSheetInternal = jest.fn();

  const mockCategorySheetRef = {current: {open: jest.fn(), close: jest.fn()}};
  const mockSubcategorySheetRef = {
    current: {open: jest.fn(), close: jest.fn()},
  };
  const mockVisitTypeSheetRef = {current: {open: jest.fn(), close: jest.fn()}};
  const mockUploadSheetRef = {current: {open: jest.fn(), close: jest.fn()}};
  const mockDeleteSheetRef = {current: {open: jest.fn(), close: jest.fn()}};

  let mockFileToDelete: string | null = null;

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
        borderRadius: {lg: 8},
        shadows: {md: {}, lg: {}},
      },
    }),
    useFileOperations: jest
      .fn()
      .mockImplementation(
        ({
          files,
          setFiles,
          clearError,
          openSheet,
          closeSheet,
          deleteSheetRef,
        }) => {
          const testCallableSetFiles = (newFiles: any[]) => {
            setFiles(newFiles);
          };
          const testCallableClearError = () => {
            clearError();
          };

          return {
            fileToDelete: mockFileToDelete,
            handleTakePhoto: mockHandleTakePhoto,
            handleChooseFromGallery: mockHandleChooseFromGallery,
            handleUploadFromDrive: mockHandleUploadFromDrive,
            handleRemoveFile: (fileId: string) => {
              mockFileToDelete = fileId;
              openSheet('delete');
              deleteSheetRef.current?.open();
              mockHandleRemoveFile(fileId);
            },
            confirmDeleteFile: () => {
              if (mockFileToDelete) {
                const fileToRemoveId = mockFileToDelete;
                mockConfirmDeleteFile(fileToRemoveId);
                mockFileToDelete = null;
                const updatedFiles = files.filter(
                  (f: any) => f.id !== fileToRemoveId,
                );
                setFiles(updatedFiles);
                closeSheet();
              }
            },
            _testSetFiles: testCallableSetFiles,
            _testClearError: testCallableClearError,
          };
        },
      ),
    useFormBottomSheets: jest.fn(() => ({
      refs: {
        categorySheetRef: mockCategorySheetRef,
        subcategorySheetRef: mockSubcategorySheetRef,
        visitTypeSheetRef: mockVisitTypeSheetRef,
        uploadSheetRef: mockUploadSheetRef,
        deleteSheetRef: mockDeleteSheetRef,
      },
      openSheet: mockOpenSheetInternal,
      closeSheet: mockCloseSheetInternal,
    })),
    useBottomSheetBackHandler: jest.fn(() => ({
      registerSheet: jest.fn(),
      openSheet: mockOpenSheetInternal,
      closeSheet: mockCloseSheetInternal,
    })),
  };
});

jest.mock('@/assets/images', () => ({
  Images: {
    dropdownIcon: 'dropdown.png',
    calendarIcon: 'calendar.png',
    paw: 'paw.png',
    plusIcon: 'plus.png',
  },
}));

jest.mock('@/shared/utils/currency', () => ({
  resolveCurrencySymbol: () => '$',
}));
jest.mock('@/features/expenses/utils/expenseLabels', () => ({
  resolveCategoryLabel: (val: string | null) => (val ? `Label:${val}` : ''),
  resolveSubcategoryLabel: (cat: string | null, sub: string | null) =>
    sub ? `Label:${sub}` : '',
  resolveVisitTypeLabel: (val: string | null) => (val ? `Label:${val}` : ''),
}));

jest.mock('@/shared/components/common/CompanionSelector/CompanionSelector', () => ({
  CompanionSelector: jest.fn(props => {
    const {View: MockView} = require('react-native');
    const handleSelect = (id: string | null) => props.onSelect(id);
    return (
      <MockView
        {...props}
        testID="mock-CompanionSelector"
        onSelect={handleSelect}
      />
    );
  }),
}));
jest.mock('@/shared/components/common/Input/Input', () => ({
  Input: jest.fn(props => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID={`mock-Input-${props.label}`} />;
  }),
}));
jest.mock('@/shared/components/common/TouchableInput/TouchableInput', () => ({
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
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => (props: any) => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID="mock-LiquidGlassButton" />;
  },
);
jest.mock('@/shared/components/common/SimpleDatePicker/SimpleDatePicker', () => ({
  SimpleDatePicker: jest.fn(props => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID="mock-SimpleDatePicker" />;
  }),
  formatDateForDisplay: (date: Date) => date.toISOString().split('T')[0],
}));
jest.mock('@/features/documents/components/DocumentAttachmentsSection', () => ({
  DocumentAttachmentsSection: jest.fn(props => {
    const {View: MockView} = require('react-native');
    return <MockView {...props} testID="mock-DocumentAttachmentsSection" />;
  }),
}));

const mockOpenCategorySheet = jest.fn();
const mockOpenSubcategorySheet = jest.fn();
const mockOpenVisitTypeSheet = jest.fn();
const mockOpenUploadSheet = jest.fn();
const mockOpenDeleteSheet = jest.fn();

jest.mock('@/shared/components/common/CategoryBottomSheet/CategoryBottomSheet', () => {
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
  '@/shared/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet',
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
  '@/shared/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet',
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
  '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet',
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
  '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
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

import {
  ExpenseForm,
  type ExpenseFormData,
  type ExpenseFormProps,
} from '@/features/expenses/components/ExpenseForm/ExpenseForm';
import type {Companion} from '@/features/companion/types';
import type {ExpenseAttachment} from '@/features/expenses';

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
    props: allProps,
  };
};

describe('ExpenseForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all fields correctly', () => {
    const {getByTestId} = renderComponent();
    expect(getByTestId('mock-TouchableInput-Category')).toBeTruthy();
    expect(getByTestId('mock-TouchableInput-Sub category')).toBeTruthy();
    expect(getByTestId('mock-TouchableInput-Visit type')).toBeTruthy();
    expect(getByTestId('mock-Input-Expense name')).toBeTruthy();
    expect(getByTestId('mock-Input-Provider / Business')).toBeTruthy();
    expect(getByTestId('mock-TouchableInput-Date')).toBeTruthy();
    expect(getByTestId('mock-Input-Amount')).toBeTruthy();
    expect(getByTestId('mock-DocumentAttachmentsSection')).toBeTruthy();
    expect(getByTestId('mock-LiquidGlassButton')).toBeTruthy();
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
    act(() => amountInput.props.onChangeText('abc123.45xyz!@#'));
    expect(mockOnFormChange).toHaveBeenCalledWith('amount', '123.45');
    expect(mockOnErrorClear).toHaveBeenCalledWith('amount');

    mockOnFormChange.mockClear();
    mockOnErrorClear.mockClear();
    act(() => amountInput.props.onChangeText('987.65'));
    expect(mockOnFormChange).toHaveBeenCalledWith('amount', '987.65');
    expect(mockOnErrorClear).toHaveBeenCalledWith('amount');
  });

  it('should toggle the date picker', () => {
    const {getByTestId} = renderComponent();
    const datePicker = getByTestId('mock-SimpleDatePicker');

    expect(datePicker.props.show).toBe(false);

    const dateInputTouchable = getByTestId('mock-TouchableInput-Date');
    fireEvent.press(dateInputTouchable);

    expect(getByTestId('mock-SimpleDatePicker').props.show).toBe(true);

    act(() => getByTestId('mock-SimpleDatePicker').props.onDismiss());
    expect(getByTestId('mock-SimpleDatePicker').props.show).toBe(false);
  });

  it('should call onFormChange when date is selected', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const datePicker = getByTestId('mock-SimpleDatePicker');
    const testDate = new Date('2023-10-10T00:00:00.000Z');

    act(() => datePicker.props.onDateChange(testDate));
    expect(mockOnFormChange).toHaveBeenCalledWith('date', testDate);
    expect(mockOnErrorClear).toHaveBeenCalledWith('date');
  });

  it('should open category bottom sheet', () => {
    const {getByTestId} = renderComponent();
    const categoryInput = getByTestId('mock-TouchableInput-Category');
    fireEvent.press(categoryInput);

    const mockedHooks = jest.requireMock('@/hooks');
    expect(
      mockedHooks.useFormBottomSheets().refs.categorySheetRef.current.open,
    ).toHaveBeenCalled();
    expect(mockedHooks.useFormBottomSheets().openSheet).toHaveBeenCalledWith(
      'category',
    );
  });

  it('should open subcategory bottom sheet only if category is selected', () => {
    const {getByTestId, rerender, props} = renderComponent({
      formData: {...defaultFormData, category: null},
    });
    const subCategoryInput = getByTestId('mock-TouchableInput-Sub category');

    expect(subCategoryInput.props.disabled).toBe(true);
    fireEvent.press(subCategoryInput);

    const mockedHooks = jest.requireMock('@/hooks');
    expect(
      mockedHooks.useFormBottomSheets().refs.subcategorySheetRef.current.open,
    ).not.toHaveBeenCalled();
    expect(
      mockedHooks.useFormBottomSheets().openSheet,
    ).not.toHaveBeenCalledWith('subcategory');

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
    expect(
      mockedHooks.useFormBottomSheets().refs.subcategorySheetRef.current.open,
    ).toHaveBeenCalled();
    expect(mockedHooks.useFormBottomSheets().openSheet).toHaveBeenCalledWith(
      'subcategory',
    );
  });

  it('should open visit type bottom sheet', () => {
    const {getByTestId} = renderComponent();
    fireEvent.press(getByTestId('mock-TouchableInput-Visit type'));

    const mockedHooks = jest.requireMock('@/hooks');
    expect(
      mockedHooks.useFormBottomSheets().refs.visitTypeSheetRef.current.open,
    ).toHaveBeenCalled();
    expect(mockedHooks.useFormBottomSheets().openSheet).toHaveBeenCalledWith(
      'visitType',
    );
  });

  it('should call onFormChange and clear subcategory on category save', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const categorySheet = getByTestId('mock-CategoryBottomSheet');

    act(() => categorySheet.props.onSave('health'));

    expect(mockOnFormChange).toHaveBeenCalledWith('category', 'health');
    expect(mockOnFormChange).toHaveBeenCalledWith('subcategory', null);
    expect(mockOnErrorClear).toHaveBeenCalledWith('category');

    const mockedHooks = jest.requireMock('@/hooks');
    expect(mockedHooks.useFormBottomSheets().closeSheet).toHaveBeenCalled();
  });

  it('should call onFormChange on subcategory save', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const subcategorySheet = getByTestId('mock-SubcategoryBottomSheet');

    act(() => subcategorySheet.props.onSave('vaccination'));

    expect(mockOnFormChange).toHaveBeenCalledWith('subcategory', 'vaccination');
    expect(mockOnErrorClear).toHaveBeenCalledWith('subcategory');

    const mockedHooks = jest.requireMock('@/hooks');
    expect(mockedHooks.useFormBottomSheets().closeSheet).toHaveBeenCalled();
  });

  it('should call onFormChange on visit type save', () => {
    const {getByTestId, mockOnFormChange, mockOnErrorClear} = renderComponent();
    const visitTypeSheet = getByTestId('mock-VisitTypeBottomSheet');

    act(() => visitTypeSheet.props.onSave('Hospital'));

    expect(mockOnFormChange).toHaveBeenCalledWith('visitType', 'Hospital');
    expect(mockOnErrorClear).toHaveBeenCalledWith('visitType');

    const mockedHooks = jest.requireMock('@/hooks');
    expect(mockedHooks.useFormBottomSheets().closeSheet).toHaveBeenCalled();
  });

  it('should display category and subcategory labels/values when provided in initial formData', () => {
    const initialData: ExpenseFormData = {
      ...defaultFormData,
      category: 'food',
      subcategory: 'treats',
      date: new Date('2023-05-15T00:00:00.000Z'),
      visitType: 'Checkup',
    };
    const {getByTestId} = renderComponent({formData: initialData});

    const categoryInput = getByTestId('mock-TouchableInput-Category');
    expect(categoryInput.props.label).toBe('Category');
    expect(categoryInput.props.value).toBe('Label:food');

    const subcategoryInput = getByTestId('mock-TouchableInput-Sub category');
    expect(subcategoryInput.props.label).toBe('Sub category');
    expect(subcategoryInput.props.value).toBe('Label:treats');
    expect(subcategoryInput.props.disabled).toBe(false);

    const dateInput = getByTestId('mock-TouchableInput-Date');
    expect(dateInput.props.label).toBe('Date');
    expect(dateInput.props.value).toBe('2023-05-15');

    const visitTypeInput = getByTestId('mock-TouchableInput-Visit type');
    expect(visitTypeInput.props.label).toBe('Visit type');
    expect(visitTypeInput.props.value).toBe('Label:Checkup');
  });

  it('should call onSave when save button is pressed', () => {
    const {getByTestId, mockOnSave} = renderComponent();
    const saveButton = getByTestId('mock-LiquidGlassButton');
    fireEvent.press(saveButton);
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('should show loading state in save button', () => {
    const {getByTestId} = renderComponent({loading: true});
    const saveButton = getByTestId('mock-LiquidGlassButton');
    expect(saveButton.props.title).toBe('Saving...');
    expect(saveButton.props.loading).toBe(true);
    expect(saveButton.props.disabled).toBe(true);
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

    const mockedHooks = jest.requireMock('@/hooks');
    expect(
      mockedHooks.useFormBottomSheets().refs.uploadSheetRef.current.open,
    ).toHaveBeenCalled();
    expect(mockedHooks.useFormBottomSheets().openSheet).toHaveBeenCalledWith(
      'upload',
    );
  });

  it('should call callbacks from useFileOperations', () => {
    const {mockOnFormChange, mockOnErrorClear} = renderComponent();
    const mockAttachment: ExpenseAttachment = {id: 'file-new'} as any;

    const mockedHooks = jest.requireMock('@/hooks');
    expect(mockedHooks.useFileOperations).toHaveBeenCalled();
    const hookInstance = mockedHooks.useFileOperations.mock.results[0]?.value;

    if (!hookInstance) {
      throw new Error('useFileOperations mock did not return an instance');
    }

    act(() => hookInstance._testSetFiles([mockAttachment]));
    expect(mockOnFormChange).toHaveBeenCalledWith('attachments', [
      mockAttachment,
    ]);

    act(() => hookInstance._testClearError());
    expect(mockOnErrorClear).toHaveBeenCalledWith('attachments');
  });

  it('should handle file deletion flow', () => {
    const mockAttachment: ExpenseAttachment = {
      id: 'file1',
      name: 'test.pdf',
      uri: 'file://test.pdf',
    } as any;
    const {getByTestId, mockOnFormChange} = renderComponent({
      formData: {...defaultFormData, attachments: [mockAttachment]},
    });

    const attachmentsSection = getByTestId('mock-DocumentAttachmentsSection');
    act(() => {
      attachmentsSection.props.onRequestRemove(mockAttachment);
    });

    const mockedHooks = jest.requireMock('@/hooks');
    expect(mockedHooks.useFormBottomSheets().openSheet).toHaveBeenCalledWith(
      'delete',
    );
    expect(
      mockedHooks.useFormBottomSheets().refs.deleteSheetRef.current.open,
    ).toHaveBeenCalled();
    expect(mockHandleRemoveFile).toHaveBeenCalledWith('file1');

    const deleteSheet = getByTestId('mock-DeleteDocumentBottomSheet');
    act(() => {
      deleteSheet.props.onDelete();
    });

    expect(mockConfirmDeleteFile).toHaveBeenCalledWith('file1');
    expect(mockOnFormChange).toHaveBeenCalledWith('attachments', []);
    expect(mockedHooks.useFormBottomSheets().closeSheet).toHaveBeenCalled();
  });

  it('should do nothing if confirmDeleteFile is called with no file to delete', () => {
    const {mockOnFormChange} = renderComponent();

    const mockedHooks = jest.requireMock('@/hooks');
    expect(mockedHooks.useFileOperations).toHaveBeenCalled();
    const hookInstance = mockedHooks.useFileOperations.mock.results[0]?.value;

    if (!hookInstance) {
      throw new Error('useFileOperations mock did not return an instance');
    }

    act(() => {
      hookInstance.confirmDeleteFile();
    });

    expect(mockConfirmDeleteFile).not.toHaveBeenCalled();
    expect(mockOnFormChange).not.toHaveBeenCalledWith(
      'attachments',
      expect.anything(),
    );
    expect(mockedHooks.useFormBottomSheets().closeSheet).not.toHaveBeenCalled();
  });
});
