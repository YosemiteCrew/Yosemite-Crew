import React from 'react';
import {render, fireEvent, screen, act} from '@testing-library/react-native';
import ContactUsScreen from '../../../../src/features/support/screens/ContactUsScreen';

// --- 1. Setup & Global Mocks ---

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
const mockUseSelector = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
  useRoute: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: any) => mockUseSelector(selector),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    contactHero: {uri: 'hero-img'},
    dropdownIcon: {uri: 'dropdown'},
  },
}));

// --- 2. Hook Mocks (Capture internal state setters) ---

let capturedSetFiles: ((files: any[]) => void) | undefined;
let capturedClearError: (() => void) | undefined;
let capturedCloseSheet: (() => void) | undefined; // Capture the function passed to the hook

const mockHandleTakePhoto = jest.fn();
const mockHandleChooseFromGallery = jest.fn();
const mockHandleUploadFromDrive = jest.fn();
const mockHandleRemoveFile = jest.fn();
const mockConfirmDeleteFile = jest.fn();
const mockOpenSheet = jest.fn();

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
        text: 'black',
        textSecondary: 'gray',
        border: '#ddd',
        cardBackground: '#f9f9f9',
        borderMuted: '#ccc',
        secondary: 'blue',
        white: '#fff',
        error: 'red',
        primary: 'green',
        primarySurface: '#eeffee',
      },
      spacing: {
        '0': 0,
        '1': 4,
        '2': 8,
        '3': 12,
        '4': 16,
        '5': 20,
        '6': 24,
        '10': 40,
      },
      typography: {
        h3: {fontSize: 24},
        bodySmall: {fontSize: 12},
        titleSmall: {fontSize: 16, fontFamily: 'Arial'},
        paragraph: {fontSize: 14},
        paragraphBold: {fontSize: 14, fontWeight: 'bold'},
        labelXsBold: {fontSize: 10},
        subtitleRegular14: {fontSize: 14},
        subtitleBold14: {fontSize: 14, fontWeight: 'bold'},
        labelSmall: {fontSize: 12},
        button: {fontSize: 16},
      },
      borderRadius: {lg: 12},
    },
  }),
  useFileOperations: (config: any) => {
    if (config) {
      capturedSetFiles = config.setFiles;
      capturedClearError = config.clearError;
      capturedCloseSheet = config.closeSheet;

      if (config.openSheet) mockOpenSheet.mockImplementation(config.openSheet);
    }
    return {
      fileToDelete: {id: 'file1', name: 'test.jpg'},
      handleTakePhoto: mockHandleTakePhoto,
      handleChooseFromGallery: mockHandleChooseFromGallery,
      handleUploadFromDrive: mockHandleUploadFromDrive,
      handleRemoveFile: mockHandleRemoveFile,
      confirmDeleteFile: mockConfirmDeleteFile,
    };
  },
}));

// --- 3. Component Mocks (Scoped Requires) ---

jest.mock('@/shared/components/common', () => {
  const {View, Text, TextInput, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, onBack}: any) => (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity onPress={onBack} testID="header-back">
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    ),
    Input: ({label, value, onChangeText, error}: any) => (
      <View>
        <Text>{label}</Text>
        <TextInput
          testID={`input-${label}`}
          value={value}
          onChangeText={onChangeText}
        />
        {error && <Text testID={`error-${label}`}>{error}</Text>}
      </View>
    ),
    TouchableInput: ({label, value, onPress, error}: any) => (
      <TouchableOpacity onPress={onPress} testID={`touchable-${label}`}>
        <Text>{label}</Text>
        <Text>{value || 'Select one'}</Text>
        {error && <Text testID={`error-${label}`}>{error}</Text>}
      </TouchableOpacity>
    ),
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    __esModule: true,
    default: ({title, onPress}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity onPress={onPress} testID={`btn-${title}`}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/shared/components/common/Checkbox/Checkbox', () => ({
  Checkbox: ({label, value, onValueChange}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity onPress={onValueChange} testID={`checkbox-${label}`}>
        <Text>
          {label} {value ? '(Checked)' : '(Unchecked)'}
        </Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('@/shared/components/common/PillSelector/PillSelector', () => ({
  PillSelector: ({options, onSelect}: any) => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return (
      <View>
        {options.map((o: any) => (
          <TouchableOpacity
            key={o.id}
            onPress={() => onSelect(o.id)}
            testID={`pill-${o.id}`}>
            <Text>{o.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          testID="pill-invalid"
          onPress={() => onSelect('invalid_tab_id')}
        />
      </View>
    );
  },
}));

jest.mock('@/features/documents/components/DocumentAttachmentsSection', () => ({
  DocumentAttachmentsSection: ({
    onAddPress,
    onRequestRemove,
    files,
    error,
  }: any) => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return (
      <View>
        <TouchableOpacity onPress={onAddPress} testID="add-attachment">
          <Text>Add Attachment</Text>
        </TouchableOpacity>
        {files.map((f: any) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => onRequestRemove(f)}
            testID={`remove-file-${f.id}`}>
            <Text>Remove {f.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          testID="force-remove"
          onPress={() => onRequestRemove({id: 'test-id', name: 'test'})}
        />
        {error && <Text>{error}</Text>}
      </View>
    );
  },
}));

// --- 4. Bottom Sheet Mocks ---
const mockLawSheetOpen = jest.fn();
const mockUploadSheetOpen = jest.fn();
const mockUploadSheetClose = jest.fn();
const mockDeleteSheetOpen = jest.fn();
const mockDeleteSheetClose = jest.fn();

jest.mock(
  '../../../../src/features/support/components/DataSubjectLawBottomSheet',
  () => ({
    __esModule: true,
    default: (function () {
      const ReactModule = require('react');
      const {View, Text, TouchableOpacity} = require('react-native');

      return ReactModule.forwardRef((props: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
          open: mockLawSheetOpen,
          close: jest.fn(),
        }));

        return (
          <View testID="law-sheet">
            <TouchableOpacity
              onPress={() => props.onSelect({id: 'gdpr', label: 'GDPR'})}
              testID="select-gdpr">
              <Text>GDPR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => props.onSelect({id: 'other', label: 'Other Law'})}
              testID="select-other-law">
              <Text>Other Law</Text>
            </TouchableOpacity>
          </View>
        );
      });
    })(),
  }),
);

jest.mock(
  '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet',
  () => ({
    UploadDocumentBottomSheet: (function () {
      const ReactModule = require('react');
      const {View, TouchableOpacity, Text} = require('react-native');

      return ReactModule.forwardRef((props: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
          open: mockUploadSheetOpen,
          close: mockUploadSheetClose,
        }));

        return (
          <View>
            <TouchableOpacity
              onPress={props.onTakePhoto}
              testID="sheet-take-photo">
              <Text>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={props.onChooseGallery}
              testID="sheet-choose-gallery">
              <Text>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={props.onUploadDrive}
              testID="sheet-upload-drive">
              <Text>Drive</Text>
            </TouchableOpacity>
          </View>
        );
      });
    })(),
  }),
);

jest.mock(
  '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
  () => ({
    DeleteDocumentBottomSheet: (function () {
      const ReactModule = require('react');
      const {View, TouchableOpacity, Text} = require('react-native');

      return ReactModule.forwardRef((props: any, ref: any) => {
        ReactModule.useImperativeHandle(ref, () => ({
          open: mockDeleteSheetOpen,
          close: mockDeleteSheetClose,
        }));

        return (
          <View testID="delete-sheet">
            <TouchableOpacity
              onPress={props.onDelete}
              testID="sheet-confirm-delete">
              <Text>Confirm</Text>
            </TouchableOpacity>
          </View>
        );
      });
    })(),
  }),
);

// --- 5. Data Mock ---
jest.mock('../../../../src/features/support/data/contactData', () => ({
  CONTACT_TABS: [
    {id: 'general', label: 'General'},
    {id: 'feature', label: 'Feature'},
    {id: 'data-subject', label: 'DSAR'},
    {id: 'complaint', label: 'Complaint'},
  ],
  DSAR_SUBMITTER_OPTIONS: [{id: 'owner', label: 'Owner'}],
  DSAR_REQUEST_TYPES: [
    {id: 'access', label: 'Access'},
    {id: 'other-request', label: 'Other Request'},
  ],
  CONFIRMATION_CHECKBOXES: [{id: 'confirm1', label: 'I confirm'}],
  DSAR_LAW_OPTIONS: [
    {id: 'gdpr', label: 'GDPR'},
    {id: 'other', label: 'Other Law'},
  ],
}));

// --- 6. Tests ---

describe('ContactUsScreen', () => {
  const mockNavigationProp: any = {goBack: mockGoBack, navigate: mockNavigate};
  const mockRoute: any = {params: {}};
  const mockState = {
    auth: {
      user: {
        email: 'user@test.com',
        phone: '+1234567890',
        firstName: 'Test',
        lastName: 'User',
      },
    },
    companion: {
      companions: [{id: 'comp-1', name: 'Buddy'}],
      selectedCompanionId: 'comp-1',
    },
  };

  const originalURL = globalThis.URL;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedSetFiles = undefined;
    capturedClearError = undefined;
    capturedCloseSheet = undefined;

    mockUseSelector.mockImplementation((selector: any) => selector(mockState));
  });

  afterEach(() => {
    globalThis.URL = originalURL;
  });

  it('renders General tab and handles simple validation errors and clearing', () => {
    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );

    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(screen.getByText('Subject is required')).toBeTruthy();
    expect(screen.getByText('Message is required')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('input-Subject'), 'Test Subject');
    expect(screen.queryByText('Subject is required')).toBeNull();
    expect(screen.getByText('Message is required')).toBeTruthy();

    fireEvent.changeText(
      screen.getByTestId('input-Your message'),
      'Test Message',
    );
    expect(screen.queryByText('Message is required')).toBeNull();

    fireEvent.press(screen.getByTestId('btn-Submit'));
  });

  it('Feature Tab: validates and submits', () => {
    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('pill-feature'));

    expect(screen.getByTestId('btn-Send')).toBeTruthy();

    fireEvent.press(screen.getByTestId('btn-Send'));
    expect(screen.getByText('Subject is required')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('input-Subject'), '  ');
    expect(screen.getByText('Subject is required')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('input-Subject'), 'Feature 1');
    fireEvent.changeText(screen.getByTestId('input-Your message'), 'Details');

    fireEvent.press(screen.getByTestId('btn-Send'));
    expect(screen.queryByText('Subject is required')).toBeNull();
  });

  it('DSAR Form: Full validation flow, conditional fields, and error clearing', () => {
    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('pill-data-subject'));

    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(
      screen.getByText('Please select who is submitting this request.'),
    ).toBeTruthy();
    expect(screen.getByText('Regulation is required.')).toBeTruthy();
    expect(screen.getByText('Please select the request type.')).toBeTruthy();
    expect(screen.getByText('Message is required.')).toBeTruthy();
    expect(screen.getByText('Please confirm all statements.')).toBeTruthy();

    fireEvent.press(screen.getByText('Owner'));
    expect(
      screen.queryByText('Please select who is submitting this request.'),
    ).toBeNull();

    fireEvent.press(screen.getByTestId('touchable-Regulation'));
    expect(mockLawSheetOpen).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('select-other-law'));
    expect(screen.queryByText('Regulation is required.')).toBeNull();
    expect(screen.getByTestId('input-Please specify')).toBeTruthy();

    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(screen.getByText('Please specify the regulation.')).toBeTruthy();

    fireEvent.changeText(
      screen.getByTestId('input-Please specify'),
      'Custom Law',
    );
    expect(screen.queryByText('Please specify the regulation.')).toBeNull();

    fireEvent.press(screen.getByText('Other Request'));
    expect(screen.getByTestId('input-Additional details')).toBeTruthy();

    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(screen.getByText('Please add additional details.')).toBeTruthy();

    fireEvent.changeText(
      screen.getByTestId('input-Additional details'),
      'My Details',
    );
    expect(screen.queryByText('Please add additional details.')).toBeNull();

    fireEvent.changeText(screen.getByTestId('input-Your message'), 'My Data');
    expect(screen.queryByText('Message is required.')).toBeNull();

    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(screen.getByText('Please confirm all statements.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('checkbox-I confirm'));
    expect(screen.queryByText('Please confirm all statements.')).toBeNull();

    fireEvent.press(screen.getByTestId('checkbox-I confirm'));
    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(screen.getByText('Please confirm all statements.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('checkbox-I confirm'));
    fireEvent.press(screen.getByTestId('btn-Submit'));
  });

  it('DSAR Form: Switching from Other to Standard clears conditional fields', () => {
    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('pill-data-subject'));

    fireEvent.press(screen.getByTestId('touchable-Regulation'));
    fireEvent.press(screen.getByTestId('select-other-law'));
    fireEvent.changeText(screen.getByTestId('input-Please specify'), 'Notes');

    fireEvent.press(screen.getByTestId('touchable-Regulation'));
    fireEvent.press(screen.getByTestId('select-gdpr'));
    expect(screen.queryByTestId('input-Please specify')).toBeNull();

    fireEvent.press(screen.getByText('Other Request'));
    fireEvent.changeText(
      screen.getByTestId('input-Additional details'),
      'Notes',
    );

    fireEvent.press(screen.getByText('Access'));
    expect(screen.queryByTestId('input-Additional details')).toBeNull();
  });

  it('Complaint Form: Validation, URL logic, and Error Clearing', () => {
    globalThis.URL = class extends URL {
      static canParse(url: string) {
        return url.includes('http');
      }
    } as unknown as typeof URL;

    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('pill-complaint'));

    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(
      screen.getByText('Please select who is submitting this complaint.'),
    ).toBeTruthy();
    expect(screen.getByText('Complaint details are required.')).toBeTruthy();

    fireEvent.press(screen.getByText('Owner'));
    expect(
      screen.queryByText('Please select who is submitting this complaint.'),
    ).toBeNull();

    fireEvent.changeText(
      screen.getByTestId('input-Your message'),
      'Complaint text',
    );
    expect(screen.queryByText('Complaint details are required.')).toBeNull();

    fireEvent.changeText(
      screen.getByTestId('input-Reference link'),
      'invalid-url',
    );
    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(screen.getByText('Please enter a valid link.')).toBeTruthy();

    fireEvent.changeText(
      screen.getByTestId('input-Reference link'),
      'http://valid.com',
    );
    expect(screen.queryByText('Please enter a valid link.')).toBeNull();

    fireEvent.changeText(screen.getByTestId('input-Reference link'), '');
    expect(screen.queryByText('Please enter a valid link.')).toBeNull();

    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(screen.getByText('Please confirm all statements.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('checkbox-I confirm'));
    expect(screen.queryByText('Please confirm all statements.')).toBeNull();
  });

  it('Complaint Form: URL Validation with legacy try/catch fallback', () => {
    globalThis.URL = class extends URL {
      constructor(url: string) {
        super(url);
        if (!url.includes('http')) throw new Error('Invalid');
      }
      static readonly canParse = undefined as any;
    } as unknown as typeof URL;

    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('pill-complaint'));

    const urlInput = screen.getByTestId('input-Reference link');

    fireEvent.changeText(urlInput, 'bad');
    fireEvent.press(screen.getByTestId('btn-Submit'));
    expect(screen.getByText('Please enter a valid link.')).toBeTruthy();

    fireEvent.changeText(urlInput, 'http://good.com');
    expect(screen.queryByText('Please enter a valid link.')).toBeNull();
  });

  it('File Operations: Triggers callbacks and error clearing', async () => {
    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('pill-complaint'));

    fireEvent.press(screen.getByTestId('add-attachment'));
    expect(mockUploadSheetOpen).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('sheet-take-photo'));
    expect(mockHandleTakePhoto).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('sheet-choose-gallery'));
    expect(mockHandleChooseFromGallery).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('sheet-upload-drive'));
    expect(mockHandleUploadFromDrive).toHaveBeenCalled();

    act(() => {
      capturedSetFiles?.([{id: '1', name: 'test.jpg'}]);
    });
    expect(screen.getByText('Remove test.jpg')).toBeTruthy();

    act(() => {
      capturedClearError?.();
    });
  });

  it('Sheet Management: Correctly closes sheets via hook callback', () => {
    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('pill-complaint'));

    fireEvent.press(screen.getByTestId('add-attachment'));

    act(() => {
      capturedCloseSheet?.();
    });
    expect(mockUploadSheetClose).toHaveBeenCalled();

    act(() => {
      capturedSetFiles?.([{id: '1', name: 'test.jpg'}]);
    });
  });

  it('Sheet Management: Internal openSheet sets active ref correctly for closing', () => {
    let internalOpenSheet: (id: string) => void = () => {};

    const hooksModule = require('@/hooks');

    jest
      .spyOn(hooksModule, 'useFileOperations')
      .mockImplementation((config: any) => {
        if (config) {
          internalOpenSheet = config.openSheet;
          capturedCloseSheet = config.closeSheet;
        }
        return {
          fileToDelete: null,
          handleTakePhoto: jest.fn(),
          handleChooseFromGallery: jest.fn(),
          handleUploadFromDrive: jest.fn(),
          handleRemoveFile: jest.fn(),
          confirmDeleteFile: jest.fn(),
        };
      });

    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );

    fireEvent.press(screen.getByTestId('pill-complaint'));

    act(() => {
      internalOpenSheet('upload');
    });
    expect(mockUploadSheetOpen).toHaveBeenCalled();

    act(() => {
      capturedCloseSheet?.();
    });
    expect(mockUploadSheetClose).toHaveBeenCalled();

    act(() => {
      internalOpenSheet('delete');
    });
    expect(mockDeleteSheetOpen).toHaveBeenCalled();

    act(() => {
      capturedCloseSheet?.();
    });
    expect(mockDeleteSheetClose).toHaveBeenCalled();
  });

  it('Navigation: Back button', () => {
    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('Force unknown tab to test switch default case', () => {
    render(
      <ContactUsScreen navigation={mockNavigationProp} route={mockRoute} />,
    );
    fireEvent.press(screen.getByTestId('pill-invalid'));
    expect(screen.queryByTestId('input-Subject')).toBeNull();
    expect(screen.queryByTestId('pill-data-subject')).toBeTruthy();
  });
});
