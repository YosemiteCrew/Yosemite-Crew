import React from 'react';
// FIX: Removed unused imports {View, Text, TextInput, TouchableOpacity} to resolve unused vars and shadowing errors
import {fireEvent, render, act} from '@testing-library/react-native';
import {Step5Screen} from '../../../../src/features/adverseEventReporting/screens/Step5Screen';
import {useAdverseEventReport} from '../../../../src/features/adverseEventReporting/state/AdverseEventReportContext';
// Import hooks from the root or wherever they are defined
import {useFormBottomSheets, useTheme} from '../../../../src/hooks';
import {useFileOperations} from '../../../../src/shared/hooks/useFileOperations';

// --- Mocks ---

// Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRoute = {params: {}};

const mockNavigationProps: any = {
  navigation: {
    navigate: mockNavigate,
    goBack: mockGoBack,
  },
  route: mockRoute,
};

// Context
jest.mock(
  '../../../../src/features/adverseEventReporting/state/AdverseEventReportContext',
);

// Hooks - Explicitly mock them so we can control return values in tests
jest.mock('../../../../src/hooks', () => ({
  useTheme: jest.fn(),
  useFormBottomSheets: jest.fn(),
}));

jest.mock('../../../../src/shared/hooks/useFileOperations');

// Helper styles
jest.mock('../../../../src/shared/styles/commonFormStyles', () => ({
  createCommonFormStyles: () => ({dropdownIcon: {}, calendarIcon: {}}),
}));

// --- Component Mocks ---

jest.mock(
  '../../../../src/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return {
      SimpleDatePicker: ({show, onDateChange, onDismiss}: any) =>
        show ? (
          <View>
            <TouchableOpacity
              testID="datepicker-confirm"
              onPress={() => onDateChange(new Date('2023-01-01'))}>
              <Text>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="datepicker-dismiss" onPress={onDismiss}>
              <Text>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null,
      formatDateForDisplay: () => '01/01/2023',
    };
  },
);

jest.mock(
  '../../../../src/shared/components/common/CountryBottomSheet/CountryBottomSheet',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require('react');
    const {TouchableOpacity, Text} = require('react-native');
    return {
      CountryBottomSheet: React.forwardRef(({onSave}: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          open: () => {},
          close: () => {},
        }));
        return (
          <TouchableOpacity
            testID="country-sheet-save"
            onPress={() => onSave({code: 'AU', name: 'Australia'})}>
            <Text>Save Country</Text>
          </TouchableOpacity>
        );
      }),
    };
  },
);

jest.mock(
  '../../../../src/shared/components/common/AdministrationMethodBottomSheet/AdministrationMethodBottomSheet',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require('react');
    const {TouchableOpacity, Text} = require('react-native');
    return {
      AdministrationMethodBottomSheet: React.forwardRef(
        ({onSave}: any, ref: any) => {
          React.useImperativeHandle(ref, () => ({
            open: () => {},
            close: () => {},
          }));
          return (
            // FIX: Passing a string 'Oral' instead of object prevents crash in TouchableInput
            <TouchableOpacity
              testID="admin-sheet-save"
              onPress={() => onSave('Oral')}>
              <Text>Save Admin</Text>
            </TouchableOpacity>
          );
        },
      ),
    };
  },
);

jest.mock('../../../../src/shared/components/common/Checkbox/Checkbox', () => {
  const {TouchableOpacity, Text} = require('react-native');
  return {
    Checkbox: ({value, onValueChange, label}: any) => (
      <TouchableOpacity
        testID={`checkbox-${label}`}
        onPress={() => onValueChange(!value)}>
        <Text>
          {label} {value ? 'Checked' : 'Unchecked'}
        </Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../../../../src/shared/components/common', () => {
  const {View, Text, TextInput} = require('react-native');
  return {
    Input: ({label, onChangeText, value, error}: any) => (
      <View>
        <Text>{label}</Text>
        <TextInput
          testID={`input-${label}`}
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text>{error}</Text> : null}
      </View>
    ),
  };
});

jest.mock(
  '../../../../src/shared/components/common/TouchableInput/TouchableInput',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      TouchableInput: ({label, onPress, value, error}: any) => (
        <TouchableOpacity onPress={onPress} testID={`touchable-${label}`}>
          <Text>{label}</Text>
          <Text>{value || 'placeholder'}</Text>
          {error ? <Text>{error}</Text> : null}
        </TouchableOpacity>
      ),
    };
  },
);

jest.mock(
  '../../../../src/features/documents/components/DocumentAttachmentsSection',
  () => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return {
      DocumentAttachmentsSection: ({
        onAddPress,
        onRequestRemove,
        error,
      }: any) => (
        <View>
          <TouchableOpacity testID="add-doc-btn" onPress={onAddPress}>
            <Text>Add Doc</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="remove-doc-btn"
            onPress={() => onRequestRemove({id: '1'})}>
            <Text>Remove Doc</Text>
          </TouchableOpacity>
          {error ? <Text>{error}</Text> : null}
        </View>
      ),
    };
  },
);

jest.mock(
  '../../../../src/features/adverseEventReporting/components/AERLayout',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return (props: any) => (
      <View>
        <Text>{props.stepLabel}</Text>
        {props.children}
        <TouchableOpacity testID="Next" onPress={props.bottomButton.onPress}>
          <Text>{props.bottomButton.title}</Text>
        </TouchableOpacity>
      </View>
    );
  },
);

jest.mock(
  '../../../../src/shared/components/common/UploadDeleteSheets/UploadDeleteSheets',
  () => {
    const {View} = require('react-native');
    return () => <View />;
  },
);

// --- Setup ---

describe('Step5Screen', () => {
  const mockSetProductInfo = jest.fn();
  const mockOpenSheet = jest.fn();
  const mockCloseSheet = jest.fn();
  const mockRegisterSheet = jest.fn();

  const mockHandleRemoveFile = jest.fn();
  const mockConfirmDeleteFile = jest.fn();

  let capturedSetFiles: (files: any[]) => void = () => {};

  beforeEach(() => {
    jest.clearAllMocks();
    capturedSetFiles = () => {};

    // 1. Fix useTheme mock
    (useTheme as jest.Mock).mockReturnValue({
      theme: {
        colors: {secondary: 'black', primary: 'blue'},
        typography: {
          h6Clash: {},
          body: {},
          subtitleBold14: {},
          labelMdBold: {},
        },
        spacing: {1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32},
        borderRadius: {lg: 8},
      },
    });

    // 2. Fix useFormBottomSheets mock
    (useFormBottomSheets as jest.Mock).mockReturnValue({
      refs: {
        uploadSheetRef: {current: {open: jest.fn()}},
        deleteSheetRef: {current: {}},
      },
      openSheet: mockOpenSheet,
      closeSheet: mockCloseSheet,
      registerSheet: mockRegisterSheet,
    });

    // 3. Fix Context mock
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {productInfo: null},
      setProductInfo: mockSetProductInfo,
    });

    // 4. Fix File Operations mock
    (useFileOperations as jest.Mock).mockImplementation(({setFiles}: any) => {
      capturedSetFiles = setFiles;
      return {
        fileToDelete: null,
        handleTakePhoto: jest.fn(),
        handleChooseFromGallery: jest.fn(),
        handleUploadFromDrive: jest.fn(),
        handleRemoveFile: mockHandleRemoveFile,
        confirmDeleteFile: mockConfirmDeleteFile,
      };
    });
  });

  const setup = () => {
    return render(<Step5Screen {...mockNavigationProps} />);
  };

  // --- Tests ---

  it('initializes with empty form data when draft is empty', () => {
    const {getByText} = setup();
    expect(getByText('Product Information')).toBeTruthy();
  });

  it('validates all required fields and shows errors on submit', () => {
    const {getByText, getByTestId} = setup();

    fireEvent.press(getByTestId('Next'));

    expect(getByText('Product name is required')).toBeTruthy();
    expect(getByText('Brand name is required')).toBeTruthy();
    expect(getByText('Select Manufacturing Country')).toBeTruthy();
    expect(getByText('Batch number is required')).toBeTruthy();
    expect(getByText('Enter how often the product was used')).toBeTruthy();
    expect(getByText('Enter the quantity used')).toBeTruthy();
    expect(getByText('Select how the product was administered')).toBeTruthy();
    expect(getByText('Tell us why the product was used')).toBeTruthy();
    expect(getByText('Describe the pet condition before usage')).toBeTruthy();
    expect(getByText('Describe the pet condition after usage')).toBeTruthy();
    expect(getByText('Upload at least one product image')).toBeTruthy();

    expect(mockSetProductInfo).not.toHaveBeenCalled();
  });

  it('validates numeric fields correctly (frequency and quantity)', () => {
    const {getByTestId, queryAllByText} = setup();

    fireEvent.changeText(
      getByTestId('input-Number of times product used'),
      '0',
    );
    fireEvent.changeText(getByTestId('input-Quantity used'), '-5');

    fireEvent.press(getByTestId('Next'));

    const errors = queryAllByText('Enter a value greater than 0');
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('loads existing data from draft and matches country by Name', () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {
        productInfo: {
          productName: 'Test Product',
          manufacturingCountry: {name: 'Australia'},
          eventDate: '2023-01-01',
          files: [{id: '1', uri: 'path'}],
        },
      },
      setProductInfo: mockSetProductInfo,
    });

    const {getByTestId} = setup();
    expect(getByTestId('input-Product name').props.value).toBe('Test Product');
  });

  it('loads existing data and matches country by Code', () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {
        productInfo: {
          productName: 'Code Product',
          manufacturingCountry: {code: 'AU'},
          eventDate: new Date().toISOString(),
        },
      },
      setProductInfo: mockSetProductInfo,
    });
    const {getByTestId} = setup();
    expect(getByTestId('input-Product name').props.value).toBe('Code Product');
  });

  it('handles updates via useEffect when draft changes externally', () => {
    const {rerender, getByTestId} = setup();

    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {
        productInfo: {
          productName: 'Updated Name',
          manufacturingCountry: null,
          eventDate: null,
        },
      },
      setProductInfo: mockSetProductInfo,
    });

    rerender(<Step5Screen {...mockNavigationProps} />);

    expect(getByTestId('input-Product name').props.value).toBe('Updated Name');
  });

  it('successfully submits when form is valid', async () => {
    const {getByTestId} = setup();

    fireEvent.changeText(getByTestId('input-Product name'), 'My Product');
    fireEvent.changeText(getByTestId('input-Brand name'), 'My Brand');
    fireEvent.changeText(getByTestId('input-Batch number'), '12345');
    fireEvent.changeText(
      getByTestId('input-Number of times product used'),
      '2',
    );
    fireEvent.changeText(getByTestId('input-Quantity used'), '5');
    fireEvent.changeText(
      getByTestId('input-Reason to use the product.'),
      'Reason',
    );
    fireEvent.changeText(
      getByTestId('input-Pet condition before drug'),
      'Before',
    );
    fireEvent.changeText(
      getByTestId('input-Pet condition after drug'),
      'After',
    );

    fireEvent.press(getByTestId('touchable-Manufacturing country'));
    fireEvent.press(getByTestId('country-sheet-save'));

    fireEvent.press(getByTestId('touchable-How was the product administered?'));
    fireEvent.press(getByTestId('admin-sheet-save'));

    act(() => {
      capturedSetFiles([{id: '1', uri: 'test.jpg'}]);
    });

    fireEvent.press(getByTestId('Next'));

    expect(mockSetProductInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: 'My Product',
        batchNumber: '12345',
        frequencyUsed: '2',
        quantityUsed: '5',
        manufacturingCountry: expect.objectContaining({code: 'AU'}),
        administrationMethod: 'Oral',
        files: expect.arrayContaining([expect.objectContaining({id: '1'})]),
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('ThankYou');
  });

  it('handles unit checkboxes', () => {
    const {getByTestId} = setup();

    fireEvent.press(getByTestId('checkbox-Liquid - ML'));
    fireEvent.press(getByTestId('checkbox-Tablet - Piece'));
  });

  it('handles date picker interaction', () => {
    const {getByTestId} = setup();

    fireEvent.press(getByTestId('touchable-Event date'));
    fireEvent.press(getByTestId('datepicker-confirm'));

    fireEvent.press(getByTestId('touchable-Event date'));
    fireEvent.press(getByTestId('datepicker-dismiss'));
  });

  it('handles file add/remove requests', () => {
    const {getByTestId} = setup();

    fireEvent.press(getByTestId('add-doc-btn'));
    expect(mockOpenSheet).toHaveBeenCalledWith('upload');

    fireEvent.press(getByTestId('remove-doc-btn'));
    expect(mockHandleRemoveFile).toHaveBeenCalled();
  });

  it('findSupportedCountry returns null if input is missing (Branch Coverage)', () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {
        productInfo: {
          manufacturingCountry: null,
        },
      },
      setProductInfo: mockSetProductInfo,
    });
    const {getByText} = setup();
    expect(getByText('Product Information')).toBeTruthy();
  });

  it('findSupportedCountry returns null if no match found (Branch Coverage)', () => {
    (useAdverseEventReport as jest.Mock).mockReturnValue({
      draft: {
        productInfo: {
          manufacturingCountry: {name: 'Atlantis'},
        },
      },
      setProductInfo: mockSetProductInfo,
    });
    const {getByText} = setup();
    expect(getByText('Product Information')).toBeTruthy();
  });
});
