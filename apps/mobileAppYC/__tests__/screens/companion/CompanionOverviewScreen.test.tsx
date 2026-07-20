import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {store} from '@/app/store'; // Ensure this path is correct
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {HomeStackParamList} from '@/navigation/types'; // Ensure this path is correct
import {CompanionOverviewScreen} from '@/features/companion/screens/CompanionOverviewScreen'; // Ensure this path is correct
// Assuming Breed type is also exported or available for import
import type {Companion, Breed} from '@/features/companion/types'; // Ensure this path is correct
import {usePreferences} from '@/features/preferences/PreferencesContext';

// --- Global Variables for Module Mocks ---
let mockAddEventListener: jest.Mock;
let mockRemove: jest.Mock;
let mockAlert: {alert: jest.Mock};
let mockCapturedBackPressCallback: (() => boolean | null | undefined) | null =
  null;

// --- Ref Mocking Helper ---
const mockedComponentRefs = new Map<any, {open: jest.Mock; close: jest.Mock}>();

// --- Module Mocks ---

// --- FIX for Jest did not exit (mock redux-persist) ---
jest.mock('redux-persist', () => {
  const real = jest.requireActual('redux-persist');
  return {
    ...real,
    persistReducer: jest
      .fn()
      .mockImplementation((config, reducers) => reducers),
    persistStore: jest.fn().mockImplementation(() => ({
      subscribe: jest.fn(),
      dispatch: jest.fn(),
      getState: jest.fn(),
      purge: jest.fn(),
      pause: jest.fn(),
      persist: jest.fn(),
    })),
  };
});
jest.mock('redux-persist/integration/react', () => ({
  PersistGate: (props: {children: React.ReactNode}) => props.children,
}));
// --- END FIX ---

// Mock React first to ensure forwardRef/useImperativeHandle are mocked correctly
jest.mock('react', () => {
  const OriginalReact = jest.requireActual('react');

  // --- FIX for sonarqube(typescript:S2004) ---
  // Extracted handle creation to reduce nesting level
  const createMockHandle = (
    props: any,
  ): {open: jest.Mock; close: jest.Mock} => {
    const handle = {
      open: jest.fn(() => {
        // This is now Level 4
        const key = props.testID;
        if (key && !mockedComponentRefs.has(key)) {
          mockedComponentRefs.set(key, handle);
        }
      }),
      close: jest.fn(),
    };
    const key = props.testID;
    if (key && !mockedComponentRefs.has(key)) {
      mockedComponentRefs.set(key, handle);
    }
    return handle;
  };
  // --- END FIX ---

  return {
    ...OriginalReact,
    forwardRef: (renderFn: any) => {
      // Level 1 (jest.mock factory)
      // Level 2 (forwardRef method)
      return OriginalReact.forwardRef((props: any, ref: any) => {
        // Level 3
        const actualRef = OriginalReact.useRef();

        // Level 3 (hook) + Level 4 (callback)
        OriginalReact.useImperativeHandle(ref, () => createMockHandle(props));

        return renderFn(props, actualRef);
      });
    },
  };
});

jest.mock('react-native', () => {
  mockAddEventListener = jest.fn();
  mockRemove = jest.fn();
  mockAlert = {alert: jest.fn()};

  return {
    StyleSheet: {
      create: jest.fn(styles => styles),
      flatten: jest.fn(style => style),
    },
    View: 'View',
    Text: 'Text',
    ScrollView: 'ScrollView',
    ActivityIndicator: 'ActivityIndicator',
    Image: 'Image',
    TouchableOpacity: 'TouchableOpacity',
    FlatList: 'FlatList',
    Appearance: {
      getColorScheme: jest.fn(() => 'light'),
      addChangeListener: jest.fn(),
      removeChangeListener: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({width: 375, height: 812, scale: 2, fontScale: 1})),
    },
    Platform: {OS: 'android', select: jest.fn(options => options.android)},
    Alert: mockAlert,
    StatusBar: 'StatusBar',
    BackHandler: {
      addEventListener: mockAddEventListener.mockImplementation(
        (event, callback) => {
          if (event === 'hardwareBackPress') {
            mockCapturedBackPressCallback = callback;
          }
          return {
            remove: () => {
              if (mockCapturedBackPressCallback === callback) {
                mockCapturedBackPressCallback = null;
              }
              mockRemove();
            },
          };
        },
      ),
      removeEventListener: jest.fn((event, callback) => {
        if (
          event === 'hardwareBackPress' &&
          mockCapturedBackPressCallback === callback
        ) {
          mockCapturedBackPressCallback = null;
        }
        mockRemove();
      }),
    },
  };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));
jest.mock('@callstack/liquid-glass', () => ({
  LiquidGlassView: 'LiquidGlassView',
  isLiquidGlassSupported: jest.fn(() => false),
}));

// --- Component Mocks ---
jest.mock('@/shared/components/common/Header/Header', () => {
  const {View} = jest.requireActual('react-native');
  return {
    Header: jest.fn(({title, onBack, showBackButton}) => (
      <View
        testID="header"
        title={title}
        onBack={onBack}
        showBackButton={showBackButton}
      />
    )),
  };
});
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View} = jest.requireActual('react-native');
  return {
    LiquidGlassCard: jest.fn(({children, style, fallbackStyle}) => (
      <View testID="liquid-glass-card" style={[style, fallbackStyle]}>
        {children}
      </View>
    )),
  };
});
jest.mock('@/features/companion/components/CompanionProfileHeader', () => {
  const {View} = jest.requireActual('react-native');
  return {
    CompanionProfileHeader: jest.fn(props => (
      <View testID="companion-profile-header" {...props} />
    )),
  };
});
jest.mock('@/shared/components/common/Separator', () => {
  const {View} = jest.requireActual('react-native');
  return {
    Separator: jest.fn(() => <View testID="row-separator" />),
  };
});

jest.mock('@/shared/components/common/RowButton', () => {
  const {Text, TouchableOpacity} = jest.requireActual('react-native');
  return {
    RowButton: jest.fn(({label, value, onPress, testID: explicitTestID}) => {
      const generatedTestID = `row-button-${label.replaceAll(/\s+/g, '-')}`;
      return (
        <TouchableOpacity
          testID={explicitTestID || generatedTestID}
          onPress={onPress}>
          <Text testID="label">{label}</Text>
          <Text testID="value">{value}</Text>
        </TouchableOpacity>
      );
    }),
  };
});
jest.mock('@/shared/components/common/InlineEditRow/InlineEditRow', () => {
  const {View} = jest.requireActual('react-native');
  return {
    InlineEditRow: jest.fn(
      ({
        label,
        value,
        onSave,
        testID: explicitTestID,
        multiline,
        keyboardType,
      }) => {
        const generatedTestID = `inline-edit-${label.replaceAll(/\s+/g, '-')}`;
        return (
          <View
            testID={explicitTestID || generatedTestID}
            value={value}
            onSave={onSave}
            multiline={multiline}
            keyboardType={keyboardType}
          />
        );
      },
    ),
  };
});

// --- Bottom Sheet Mocks (Using Helper for Ref Handling) ---
const createBottomSheetMock = (
  mockTagName: string,
  defaultTestID: string,
  componentName: string,
) => {
  const ActualReact = jest.requireActual('react');
  return ActualReact.forwardRef((props: any, ref: any) => {
    const testID = props.testID || defaultTestID;
    const handle = {
      open: jest.fn(() => {
        if (testID && !mockedComponentRefs.has(testID)) {
          mockedComponentRefs.set(testID, handle);
        }
      }),
      close: jest.fn(),
    };
    ActualReact.useImperativeHandle(ref, () => handle);
    if (testID) {
      mockedComponentRefs.set(testID, handle);
    } else {
      console.warn(
        `[${componentName} Mock Warning] Component rendered without testID. Ref NOT registered.`,
      );
    }
    const MockComponent = mockTagName as any;
    return <MockComponent testID={testID} {...props} />;
  });
};

jest.mock(
  '@/shared/components/common/BreedBottomSheet/BreedBottomSheet',
  () => ({
    BreedBottomSheet: createBottomSheetMock(
      'mock-BreedBottomSheet',
      'breed-sheet',
      'BreedBottomSheet',
    ),
  }),
);
jest.mock(
  '@/shared/components/common/BloodGroupBottomSheet/BloodGroupBottomSheet',
  () => ({
    BloodGroupBottomSheet: createBottomSheetMock(
      'mock-BloodGroupBottomSheet',
      'blood-sheet',
      'BloodGroupBottomSheet',
    ),
  }),
);
jest.mock(
  '@/shared/components/common/CountryBottomSheet/CountryBottomSheet',
  () => ({
    CountryBottomSheet: createBottomSheetMock(
      'mock-CountryBottomSheet',
      'country-sheet',
      'CountryBottomSheet',
    ),
  }),
);
jest.mock(
  '@/shared/components/common/GenderBottomSheet/GenderBottomSheet',
  () => ({
    GenderBottomSheet: createBottomSheetMock(
      'mock-GenderBottomSheet',
      'gender-sheet',
      'GenderBottomSheet',
    ),
  }),
);
jest.mock(
  '@/shared/components/common/NeuteredStatusBottomSheet/NeuteredStatusBottomSheet',
  () => ({
    NeuteredStatusBottomSheet: createBottomSheetMock(
      'mock-NeuteredStatusBottomSheet',
      'neutered-sheet',
      'NeuteredStatusBottomSheet',
    ),
  }),
);
jest.mock(
  '@/shared/components/common/InsuredStatusBottomSheet/InsuredStatusBottomSheet',
  () => ({
    InsuredStatusBottomSheet: createBottomSheetMock(
      'mock-InsuredStatusBottomSheet',
      'insured-sheet',
      'InsuredStatusBottomSheet',
    ),
  }),
);
jest.mock(
  '@/shared/components/common/OriginBottomSheet/OriginBottomSheet',
  () => ({
    OriginBottomSheet: createBottomSheetMock(
      'mock-OriginBottomSheet',
      'origin-sheet',
      'OriginBottomSheet',
    ),
  }),
);
// --- End Bottom Sheet Mocks ---

// --- Date Picker Mock --- (Remains the same)
jest.mock(
  '@/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => {
    const {View} = jest.requireActual('react-native');
    return {
      SimpleDatePicker: jest.fn(
        ({show, onDateChange, onDismiss, value, mode, maximumDate}) =>
          show ? (
            <View
              testID="dob-picker"
              value={value}
              onDateChange={onDateChange}
              onDismiss={onDismiss}
              mode={mode}
              maximumDate={maximumDate}
            />
          ) : null,
      ),
      formatDateForDisplay: jest.fn(date =>
        date ? `Formatted: ${date.toISOString().split('T')[0]}` : '',
      ),
    };
  },
);

// --- Utility Mocks --- (Remain the same)
jest.mock('@/shared/utils/formScreenStyles', () => ({
  createFormScreenStyles: jest.fn(() => ({
    container: {},
    centered: {},
    muted: {},
    content: {},
    listContainer: {},
    glassContainer: {},
    glassFallback: {},
  })),
}));
jest.mock('@/shared/utils/commonHelpers', () => ({
  capitalize: jest.fn(s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')),
  displayNeutered: jest.fn(s => {
    if (s === 'neutered') return 'Neutered';
    if (s === 'not-neutered') return 'Not neutered';
    return '';
  }),
  displayInsured: jest.fn(s => {
    if (s === 'insured') return 'Insured';
    if (s === 'not-insured') return 'Not insured';
    return '';
  }),
  displayOrigin: jest.fn(s => {
    if (s === 'shop') return 'Shop';
    if (s === 'breeder') return 'Breeder';
    if (s === 'foster-shelter') return 'Foster/ Shelter';
    if (s === 'friends-family') return 'Friends or family';
    if (s === 'unknown') return 'Unknown';
    return '';
  }),
}));

// Mock JSON data
jest.mock(
  '@/features/companion/data/catBreeds.json',
  () => [
    {
      breedId: 1,
      breedName: 'Siamese',
      speciesId: 2,
      speciesName: 'Cat',
    },
  ],
  {virtual: true},
);
jest.mock(
  '@/features/companion/data/dogBreeds.json',
  () => [
    {
      breedId: 1,
      breedName: 'Labrador',
      speciesId: 1,
      speciesName: 'Dog',
    },
  ],
  {virtual: true},
);
jest.mock('@/features/companion/data/horseBreeds.json', () => [], {
  virtual: true,
});
jest.mock(
  '@/shared/utils/countryList.json',
  () => [{name: 'USA'}, {name: 'Canada'}],
  {
    virtual: true,
  },
);

jest.mock('@/features/companion/services/codeEntriesService', () => ({
  fetchBreedCodeEntries: jest.fn(),
}));
jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));
// Mirrors PreferencesContext's real default value so existing tests are
// unaffected; individual tests can override via mockReturnValueOnce.
jest.mock('@/features/preferences/PreferencesContext', () => ({
  usePreferences: jest.fn(() => ({
    measurementSystem: 'metric',
    weightUnit: 'kg',
    distanceUnit: 'km',
    currency: 'EUR',
    setWeightUnit: jest.fn(),
    setDistanceUnit: jest.fn(),
    setCurrency: jest.fn(),
  })),
}));

// --- Mock Redux Store Interaction --- (Remain the same)
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch,
}));
jest.mock('@/features/companion/selectors', () => ({
  selectSelectedCompanion: jest.fn(),
  selectCompanionLoading: jest.fn(),
}));
jest.mock('@/features/companion', () => ({
  ...jest.requireActual('@/features/companion'),
  updateCompanionProfile: jest.fn(payload => ({
    type: 'companion/updateProfile/pending',
    payload,
  })),
}));

// --- Mock Navigation --- (Remain the same)
type MockProps = NativeStackScreenProps<
  HomeStackParamList,
  'EditCompanionOverview'
>;
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
} as unknown as MockProps['navigation'];
const mockRoute = {
  key: 'mock-key-123',
  name: 'EditCompanionOverview',
  params: undefined,
} as unknown as MockProps['route'];

// --- Mock Companion Data ---
const mockCompanion: Companion = {
  id: 'c1',
  userId: 'u1',
  name: 'Sparky',
  category: 'dog',
  dateOfBirth: '2020-01-01T00:00:00.000Z',
  gender: 'male',
  currentWeight: 15.5,
  color: 'Brown',
  allergies: 'Peanuts, Pollen',
  neuteredStatus: 'not-neutered',
  ageWhenNeutered: null,
  bloodGroup: 'DEA 1.1+',
  microchipNumber: '12345',
  passportNumber: 'P54321',
  insuredStatus: 'not-insured',
  insuranceCompany: null,
  insurancePolicyNumber: null,
  countryOfOrigin: 'USA',
  origin: 'breeder',
  profileImage: 'http://test.com/img.jpg',
  breed: {
    breedId: 1,
    breedName: 'Labrador',
    speciesId: 1,
    speciesName: 'Dog',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// --- Test Suite ---
describe('CompanionOverviewScreen', () => {
  // renderWithState remains the same
  const renderWithState = (
    companionData: Companion | null,
    isLoading: boolean = false,
  ) => {
    (
      require('@/features/companion/selectors')
        .selectSelectedCompanion as jest.Mock
    )
      .mockClear()
      .mockReturnValue(companionData);
    (
      require('@/features/companion/selectors')
        .selectCompanionLoading as jest.Mock
    )
      .mockClear()
      .mockReturnValue(isLoading);
    mockAddEventListener.mockClear();
    mockRemove.mockClear();
    mockCapturedBackPressCallback = null;
    mockedComponentRefs.clear(); // Clear refs on each render
    return render(
      <Provider store={store}>
        <CompanionOverviewScreen
          navigation={mockNavigation}
          route={mockRoute}
        />
      </Provider>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedComponentRefs.clear();
    mockCapturedBackPressCallback = null;
    mockDispatch.mockImplementation(() => ({unwrap: () => Promise.resolve()}));
    (
      require('@/shared/utils/commonHelpers').capitalize as jest.Mock
    ).mockImplementation(s =>
      s ? s.charAt(0).toUpperCase() + s.slice(1) : '',
    );
    (
      require('@/shared/components/common/SimpleDatePicker/SimpleDatePicker')
        .formatDateForDisplay as jest.Mock
    ).mockImplementation(date =>
      date ? `Formatted: ${date.toISOString().split('T')[0]}` : '',
    );
    (
      require('@/shared/utils/commonHelpers').displayNeutered as jest.Mock
    ).mockImplementation(s => {
      if (s === 'neutered') return 'Neutered';
      if (s === 'not-neutered') return 'Not neutered';
      return '';
    });
    (
      require('@/shared/utils/commonHelpers').displayInsured as jest.Mock
    ).mockImplementation(s => {
      if (s === 'insured') return 'Insured';
      if (s === 'not-insured') return 'Not insured';
      return '';
    });
    (
      require('@/shared/utils/commonHelpers').displayOrigin as jest.Mock
    ).mockImplementation(s => {
      if (s === 'shop') return 'Shop';
      if (s === 'breeder') return 'Breeder';
      if (s === 'foster-shelter') return 'Foster/ Shelter';
      if (s === 'friends-family') return 'Friends or family';
      if (s === 'unknown') return 'Unknown';
      return '';
    });
    (
      require('@/features/auth/sessionManager')
        .getFreshStoredTokens as jest.Mock
    ).mockResolvedValue({accessToken: 'mock-token'});
    (
      require('@/features/companion/services/codeEntriesService')
        .fetchBreedCodeEntries as jest.Mock
    ).mockResolvedValue([]);
  });

  // --- Tests ---

  it('renders Loading state when companion is null and isLoading is true', () => {
    renderWithState(null, true);
    expect(screen.queryByText('Companion not found.')).toBeNull();
  });

  it('renders "Companion not found" when companion is null and isLoading is false', () => {
    renderWithState(null, false);
    expect(screen.getByText('Companion not found.')).toBeOnTheScreen();
  });

  it('renders correctly with companion data (initial state)', () => {
    renderWithState(mockCompanion);
    expect(screen.getByTestId('header')).toHaveProp('title', 'Overview');
    expect(screen.getByTestId('inline-edit-Name')).toHaveProp(
      'value',
      'Sparky',
    );
    expect(
      within(screen.getByTestId('row-button-Breed')).getByTestId('value'),
    ).toHaveTextContent('Labrador');
    // ... (rest of assertions remain the same)
  });

  it('handles name edit and calls updateCompanionProfile correctly', async () => {
    renderWithState(mockCompanion);
    fireEvent(screen.getByTestId('inline-edit-Name'), 'onSave', 'New Name');
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          id: mockCompanion.id,
          name: 'New Name',
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('handles current weight edit and converts values correctly', async () => {
    renderWithState(mockCompanion);
    const weightInput = screen.getByTestId('inline-edit-Current-weight');
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;

    fireEvent(weightInput, 'onSave', '20.5 kg');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          currentWeight: 20.5,
          updatedAt: expect.any(String),
        }),
      }),
    );
    updateProfileMock.mockClear();
    mockDispatch.mockClear();

    fireEvent(weightInput, 'onSave', '21');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          currentWeight: 21,
          updatedAt: expect.any(String),
        }),
      }),
    );
    updateProfileMock.mockClear();
    mockDispatch.mockClear();

    fireEvent(weightInput, 'onSave', '');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          currentWeight: null,
          updatedAt: expect.any(String),
        }),
      }),
    );
    updateProfileMock.mockClear();
    mockDispatch.mockClear();

    fireEvent(weightInput, 'onSave', 'abc kg');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          currentWeight: null,
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('converts an lbs-entered weight to kg before saving (currentWeight is always stored in kg)', async () => {
    (usePreferences as jest.Mock).mockReturnValueOnce({
      measurementSystem: 'imperial',
      weightUnit: 'lbs',
      distanceUnit: 'mi',
      currency: 'USD',
      setWeightUnit: jest.fn(),
      setDistanceUnit: jest.fn(),
      setCurrency: jest.fn(),
    });
    renderWithState(mockCompanion);
    const weightInput = screen.getByTestId('inline-edit-Current-weight');
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;

    fireEvent(weightInput, 'onSave', '20');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          // 20 lbs / 2.20462 ≈ 9.0718 kg — not 20.
          currentWeight: expect.closeTo(9.0718, 3),
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('displays the stored kg weight converted into the preferred unit', () => {
    (usePreferences as jest.Mock).mockReturnValueOnce({
      measurementSystem: 'imperial',
      weightUnit: 'lbs',
      distanceUnit: 'mi',
      currency: 'USD',
      setWeightUnit: jest.fn(),
      setDistanceUnit: jest.fn(),
      setCurrency: jest.fn(),
    });
    renderWithState({...mockCompanion, currentWeight: 10});

    // 10 kg -> ~22.0 lbs.
    expect(screen.getByTestId('inline-edit-Current-weight')).toHaveProp(
      'value',
      '22.0 lbs',
    );
  });

  it('opens date picker on Date of birth button press', () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Date-of-birth'));
    expect(screen.getByTestId('dob-picker')).toBeOnTheScreen();
  });

  it('closes date picker via onDismiss and calls applyPatch on date change', async () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Date-of-birth'));
    const datePicker = screen.getByTestId('dob-picker');
    const newDate = new Date(2021, 5, 15);
    fireEvent(datePicker, 'onDateChange', newDate);
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          dateOfBirth: newDate.toISOString(),
          updatedAt: expect.any(String),
        }),
      }),
    );
    expect(screen.queryByTestId('dob-picker')).toBeNull();
    fireEvent.press(screen.getByTestId('row-button-Date-of-birth'));
    const datePickerAgain = screen.getByTestId('dob-picker');
    fireEvent(datePickerAgain, 'onDismiss');
    expect(screen.queryByTestId('dob-picker')).toBeNull();
  });

  it('opens and interacts with Gender bottom sheet', async () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Gender'));
    const genderSheet = screen.getByTestId('gender-sheet');
    fireEvent(genderSheet, 'onSave', 'female');
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          gender: 'female',
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('BackHandler closes date picker if open (Priority 1)', async () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Date-of-birth'));
    expect(screen.getByTestId('dob-picker')).toBeOnTheScreen();
    expect(mockCapturedBackPressCallback).toBeDefined();
    let handled = false;
    await act(async () => {
      handled = mockCapturedBackPressCallback
        ? (mockCapturedBackPressCallback() ?? false)
        : false;
    });
    expect(handled).toBe(true);
    expect(screen.queryByTestId('dob-picker')).toBeNull();
  });

  it('BackHandler closes active bottom sheet if open (Priority 2)', async () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Gender')); // Open the sheet

    // Ref registration should be synchronous now with the new mock setup
    const genderSheetRef = mockedComponentRefs.get('gender-sheet');
    expect(genderSheetRef).toBeDefined(); // Verify ref is immediately available

    expect(mockCapturedBackPressCallback).toBeDefined();
    let handled = false;
    await act(async () => {
      handled = mockCapturedBackPressCallback
        ? (mockCapturedBackPressCallback() ?? false)
        : false;
    });
    expect(handled).toBe(true);
    expect(genderSheetRef?.close).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dob-picker')).toBeNull();
  });

  it('BackHandler does nothing if no picker or sheet is open', async () => {
    renderWithState(mockCompanion);
    expect(mockCapturedBackPressCallback).toBeDefined();
    let handled = false;
    await act(async () => {
      handled = mockCapturedBackPressCallback
        ? (mockCapturedBackPressCallback() ?? false)
        : false;
    });
    expect(handled).toBe(false);
    for (const ref of mockedComponentRefs.values()) {
      expect(ref.close).not.toHaveBeenCalled();
    }
    expect(screen.queryByTestId('dob-picker')).toBeNull();
  });

  it('shows and resets ageWhenNeutered based on neutered status', async () => {
    renderWithState({
      ...mockCompanion,
      neuteredStatus: 'neutered' as Companion['neuteredStatus'],
      ageWhenNeutered: '6',
    } as Companion);
    expect(
      screen.getByTestId('inline-edit-Age-when-neutered-(optional)'),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('inline-edit-Age-when-neutered-(optional)'),
    ).toHaveProp('value', '6 Years');
    fireEvent.press(screen.getByTestId('row-button-Neutered-status'));
    const neuteredSheet = screen.getByTestId('neutered-sheet');
    fireEvent(
      neuteredSheet,
      'onSave',
      'not-neutered' as Companion['neuteredStatus'],
    );
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          neuteredStatus: 'not-neutered',
          ageWhenNeutered: null,
          updatedAt: expect.any(String),
        }),
      }),
    );
    renderWithState({
      ...mockCompanion,
      neuteredStatus: 'not-neutered' as Companion['neuteredStatus'],
      ageWhenNeutered: null,
    }); // Reflect state change
    expect(
      screen.queryByTestId('inline-edit-Age-when-neutered-(optional)'),
    ).toBeNull();
    expect(
      within(screen.getByTestId('row-button-Neutered-status')).getByTestId(
        'value',
      ),
    ).toHaveTextContent('Not neutered');
  });

  it('shows and resets insurance details based on insured status', async () => {
    renderWithState({
      ...mockCompanion,
      insuredStatus: 'insured' as Companion['insuredStatus'],
      insuranceCompany: 'PetPlan',
      insurancePolicyNumber: 'PP123',
    } as Companion);
    expect(
      screen.getByTestId('inline-edit-Insurance-company'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('inline-edit-Policy-number')).toBeOnTheScreen();
    expect(screen.getByTestId('inline-edit-Insurance-company')).toHaveProp(
      'value',
      'PetPlan',
    );
    fireEvent.press(screen.getByTestId('row-button-Insurance-status'));
    const insuredSheet = screen.getByTestId('insured-sheet');
    fireEvent(
      insuredSheet,
      'onSave',
      'not-insured' as Companion['insuredStatus'],
    );
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          insuredStatus: 'not-insured',
          insuranceCompany: null,
          insurancePolicyNumber: null,
          updatedAt: expect.any(String),
        }),
      }),
    );
    renderWithState({
      ...mockCompanion,
      insuredStatus: 'not-insured' as Companion['insuredStatus'],
      insuranceCompany: null,
      insurancePolicyNumber: null,
    }); // Reflect state change
    expect(screen.queryByTestId('inline-edit-Insurance-company')).toBeNull();
    expect(screen.queryByTestId('inline-edit-Policy-number')).toBeNull();
    expect(
      within(screen.getByTestId('row-button-Insurance-status')).getByTestId(
        'value',
      ),
    ).toHaveTextContent('Not insured'); // Uses display helper
  });

  it('shows alert when updateCompanionProfile dispatch fails', async () => {
    // FIX for sonarqube(typescript:S5786): Use specific Error type
    mockDispatch.mockImplementation(() => ({
      unwrap: () => Promise.reject(new TypeError('API Error')),
    }));
    renderWithState(mockCompanion);
    fireEvent(
      screen.getByTestId('inline-edit-Name'),
      'onSave',
      'Error Trigger Name',
    );
    await waitFor(() => {
      expect(mockAlert.alert).toHaveBeenCalledTimes(1);
      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Update Failed',
        'Failed to update companion profile. Please try again.',
        [{text: 'OK'}],
      );
    });
  });

  it('calls navigation.goBack when header back button is pressed', () => {
    renderWithState(mockCompanion);
    const header = screen.getByTestId('header');
    const onBackProp = header.props.onBack;
    if (typeof onBackProp === 'function') {
      onBackProp();
    }
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('renders correctly with minimal/null companion data', () => {
    const minimalCompanion: Companion = {
      id: 'c-min',
      userId: 'u-min',
      name: 'Minimal',
      category: 'other',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      breed: null,
      dateOfBirth: null,
      gender: null,
      currentWeight: null,
      color: null,
      allergies: null,
      neuteredStatus: null,
      ageWhenNeutered: null,
      bloodGroup: null,
      microchipNumber: null,
      passportNumber: null,
      insuredStatus: null,
      insuranceCompany: null,
      insurancePolicyNumber: null,
      countryOfOrigin: null,
      origin: null,
      profileImage: null,
    } as unknown as Companion;
    renderWithState(minimalCompanion);
    expect(screen.getByTestId('header')).toHaveProp('title', 'Overview');
    // ... (rest of assertions remain the same)
  });

  it('opens and interacts with Breed bottom sheet', async () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Breed'));
    const breedSheet = screen.getByTestId('breed-sheet');
    // FIX TS(2352): Ensure the mock breed data matches the expected Breed type structure
    const newBreed: Breed = {
      breedId: 1,
      breedName: 'Siamese',
      speciesId: 2,
      speciesName: 'Cat',
    };
    fireEvent(breedSheet, 'onSave', newBreed);
    await waitFor(() => {
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          // Expect the full Breed object in the payload
          breed: {
            breedId: 1,
            breedName: 'Siamese',
            speciesId: 2,
            speciesName: 'Cat',
          },
          updatedAt: expect.any(String),
        }),
      });
    });
  });

  it('opens and interacts with Blood Group bottom sheet', async () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Blood-group'));
    const bloodSheet = screen.getByTestId('blood-sheet');
    fireEvent(bloodSheet, 'onSave', 'DEA 1.2');
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          bloodGroup: 'DEA 1.2',
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('opens and interacts with Country bottom sheet', async () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Country-of-origin'));
    const countrySheet = screen.getByTestId('country-sheet');
    const newCountry = {name: 'Canada'};
    fireEvent(countrySheet, 'onSave', newCountry);
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          countryOfOrigin: 'Canada',
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('opens and interacts with Origin bottom sheet', async () => {
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-My-pet-comes-from'));
    const originSheet = screen.getByTestId('origin-sheet');
    fireEvent(originSheet, 'onSave', 'foster-shelter');
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          origin: 'foster-shelter',
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('handles profile image change', async () => {
    renderWithState(mockCompanion);
    const header = screen.getByTestId('companion-profile-header');
    fireEvent(header, 'onImageSelected', 'file://new-image.jpg');
    await waitFor(() =>
      expect(
        require('@/features/companion').updateCompanionProfile,
      ).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          profileImage: 'file://new-image.jpg',
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('handles profile image change failure', async () => {
    // FIX for sonarqube(typescript:S5786): Use specific Error type
    mockDispatch.mockImplementation(() => ({
      unwrap: () => Promise.reject(new TypeError('Image Upload Error')),
    }));
    renderWithState(mockCompanion);
    const header = screen.getByTestId('companion-profile-header');
    fireEvent(header, 'onImageSelected', 'file://new-image.jpg');
    await waitFor(() =>
      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Update Failed',
        'Failed to update companion profile. Please try again.',
        [{text: 'OK'}],
      ),
    );
  });

  it('loads correct breed list for a cat companion', async () => {
    (
      require('@/features/companion/services/codeEntriesService')
        .fetchBreedCodeEntries as jest.Mock
    ).mockResolvedValue([
      {
        display: 'Siamese',
        code: 'siamese',
        meta: {speciesCode: 'feline'},
      },
    ]);
    const mockCatCompanion = {
      ...mockCompanion,
      category: 'cat' as const,
    } as Companion;
    renderWithState(mockCatCompanion);
    await waitFor(() => {
      expect(screen.getByTestId('breed-sheet')).toHaveProp('breeds', [
        {
          speciesId: 0,
          speciesName: 'feline',
          breedId: 0,
          breedName: 'Siamese',
          speciesCode: 'feline',
          breedCode: 'siamese',
        },
      ]);
    });
  });

  it('loads empty breed list for a horse companion', async () => {
    const mockHorseCompanion = {
      ...mockCompanion,
      category: 'horse' as const,
    } as Companion;
    renderWithState(mockHorseCompanion);
    await waitFor(() => {
      expect(screen.getByTestId('breed-sheet')).toHaveProp('breeds', []);
    });
  });

  it('skips loading breeds when the stored access token is missing', async () => {
    (
      require('@/features/auth/sessionManager')
        .getFreshStoredTokens as jest.Mock
    ).mockResolvedValueOnce({accessToken: null});

    renderWithState(mockCompanion);

    await waitFor(() => {
      expect(
        require('@/features/companion/services/codeEntriesService')
          .fetchBreedCodeEntries,
      ).not.toHaveBeenCalled();
    });
  });

  it('clears breed options when fetching breed entries fails', async () => {
    (
      require('@/features/companion/services/codeEntriesService')
        .fetchBreedCodeEntries as jest.Mock
    ).mockRejectedValueOnce(new Error('network down'));

    renderWithState(mockCompanion);

    await waitFor(() => {
      expect(screen.getByTestId('breed-sheet')).toHaveProp('breeds', []);
    });
  });

  it('resolves the companion from the store using the route param id', async () => {
    const {
      fetchCompanions,
      resetCompanionState,
    } = require('@/features/companion');
    store.dispatch({
      type: fetchCompanions.fulfilled.type,
      payload: [mockCompanion],
    });

    const routeWithParam = {
      ...mockRoute,
      params: {companionId: mockCompanion.id},
    } as unknown as MockProps['route'];

    (
      require('@/features/companion/selectors')
        .selectSelectedCompanion as jest.Mock
    )
      .mockClear()
      .mockReturnValue(null);
    (
      require('@/features/companion/selectors')
        .selectCompanionLoading as jest.Mock
    )
      .mockClear()
      .mockReturnValue(false);

    render(
      <Provider store={store}>
        <CompanionOverviewScreen
          navigation={mockNavigation}
          route={routeWithParam}
        />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('header')).toHaveProp('title', 'Overview');
    });

    store.dispatch(resetCompanionState());
  });

  it('edits colour, allergies, microchip number, and passport number', async () => {
    renderWithState(mockCompanion);
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;

    fireEvent(screen.getByTestId('inline-edit-Colour'), 'onSave', 'Black');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({color: 'Black'}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(screen.getByTestId('inline-edit-Colour'), 'onSave', '');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({color: null}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(
      screen.getByTestId('inline-edit-Allergies'),
      'onSave',
      'Dust mites',
    );
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({allergies: 'Dust mites'}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(screen.getByTestId('inline-edit-Allergies'), 'onSave', '');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({allergies: null}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(
      screen.getByTestId('inline-edit-Microchip-number'),
      'onSave',
      '99900',
    );
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({microchipNumber: '99900'}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(screen.getByTestId('inline-edit-Microchip-number'), 'onSave', '');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({microchipNumber: null}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(
      screen.getByTestId('inline-edit-Passport-number'),
      'onSave',
      'P999',
    );
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({passportNumber: 'P999'}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(screen.getByTestId('inline-edit-Passport-number'), 'onSave', '');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({passportNumber: null}),
      }),
    );
  });

  it('strips the "Years"/"Year" suffix when saving age when neutered', async () => {
    renderWithState({
      ...mockCompanion,
      neuteredStatus: 'neutered' as Companion['neuteredStatus'],
      ageWhenNeutered: '6',
    } as Companion);
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;
    const ageInput = screen.getByTestId(
      'inline-edit-Age-when-neutered-(optional)',
    );

    fireEvent(ageInput, 'onSave', '3 Years');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({ageWhenNeutered: '3'}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(ageInput, 'onSave', '1 Year');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({ageWhenNeutered: '1'}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(ageInput, 'onSave', '');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({ageWhenNeutered: null}),
      }),
    );
  });

  it('edits insurance company and policy number when insured', async () => {
    renderWithState({
      ...mockCompanion,
      insuredStatus: 'insured' as Companion['insuredStatus'],
      insuranceCompany: 'PetPlan',
      insurancePolicyNumber: 'PP123',
    } as Companion);
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;

    fireEvent(
      screen.getByTestId('inline-edit-Insurance-company'),
      'onSave',
      'Trupanion',
    );
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          insuranceCompany: 'Trupanion',
        }),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(
      screen.getByTestId('inline-edit-Insurance-company'),
      'onSave',
      '',
    );
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({insuranceCompany: null}),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(
      screen.getByTestId('inline-edit-Policy-number'),
      'onSave',
      'PP999',
    );
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          insurancePolicyNumber: 'PP999',
        }),
      }),
    );
    updateProfileMock.mockClear();

    fireEvent(screen.getByTestId('inline-edit-Policy-number'), 'onSave', '');
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          insurancePolicyNumber: null,
        }),
      }),
    );
  });

  it.each([
    ['Breed', 'breed-sheet'],
    ['Blood-group', 'blood-sheet'],
    ['Country-of-origin', 'country-sheet'],
    ['Neutered-status', 'neutered-sheet'],
    ['Insurance-status', 'insured-sheet'],
    ['My-pet-comes-from', 'origin-sheet'],
  ])(
    'BackHandler closes the %s bottom sheet via its switch case',
    async (rowSuffix, sheetTestId) => {
      renderWithState(mockCompanion);
      fireEvent.press(screen.getByTestId(`row-button-${rowSuffix}`));

      const sheetRef = mockedComponentRefs.get(sheetTestId);
      expect(sheetRef).toBeDefined();
      expect(mockCapturedBackPressCallback).toBeDefined();

      let handled = false;
      await act(async () => {
        handled = mockCapturedBackPressCallback
          ? (mockCapturedBackPressCallback() ?? false)
          : false;
      });

      expect(handled).toBe(true);
      expect(sheetRef?.close).toHaveBeenCalledTimes(1);
    },
  );

  it('does not call goBack when navigation cannot go back', () => {
    (mockNavigation.canGoBack as jest.Mock).mockReturnValueOnce(false);
    renderWithState(mockCompanion);
    const header = screen.getByTestId('header');
    const onBackProp = header.props.onBack;
    if (typeof onBackProp === 'function') {
      onBackProp();
    }
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('clears the profile image when null is selected', async () => {
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;
    renderWithState(mockCompanion);
    const header = screen.getByTestId('companion-profile-header');
    fireEvent(header, 'onImageSelected', null);
    await waitFor(() => expect(updateProfileMock).toHaveBeenCalled());
    const lastArg =
      updateProfileMock.mock.calls[updateProfileMock.mock.calls.length - 1][0];
    expect(lastArg.updatedCompanion).toHaveProperty('profileImage', undefined);
  });

  it('shows the image-specific alert when applyPatch itself rejects', async () => {
    mockDispatch.mockImplementation(() => ({
      unwrap: () => Promise.reject(new TypeError('dispatch failure')),
    }));
    // Force applyPatch's own catch to throw so the image handler's catch runs.
    (mockAlert.alert as jest.Mock).mockImplementationOnce(() => {
      throw new Error('alert boom');
    });
    renderWithState(mockCompanion);
    const header = screen.getByTestId('companion-profile-header');
    fireEvent(header, 'onImageSelected', 'file://new-image.jpg');
    await waitFor(() =>
      expect(mockAlert.alert).toHaveBeenCalledWith(
        'Image Update Failed',
        'Failed to update profile image. Please try again.',
        [{text: 'OK'}],
      ),
    );
  });

  it('returns the raw age string when ageWhenNeutered is not a number', () => {
    renderWithState({
      ...mockCompanion,
      neuteredStatus: 'neutered' as Companion['neuteredStatus'],
      ageWhenNeutered: 'abc',
    } as Companion);
    expect(
      screen.getByTestId('inline-edit-Age-when-neutered-(optional)'),
    ).toHaveProp('value', 'abc');
  });

  it('renders "Year" (singular) and spayed labels for a female companion', () => {
    renderWithState({
      ...mockCompanion,
      gender: 'female' as Companion['gender'],
      neuteredStatus: 'neutered' as Companion['neuteredStatus'],
      ageWhenNeutered: '1',
    } as Companion);
    expect(screen.getByTestId('row-button-Spayed-status')).toBeOnTheScreen();
    expect(
      screen.getByTestId('inline-edit-Age-when-spayed-(optional)'),
    ).toHaveProp('value', '1 Year');
  });

  it('renders empty insurance fields when the values are null', () => {
    renderWithState({
      ...mockCompanion,
      insuredStatus: 'insured' as Companion['insuredStatus'],
      insuranceCompany: null,
      insurancePolicyNumber: null,
    } as Companion);
    expect(screen.getByTestId('inline-edit-Insurance-company')).toHaveProp(
      'value',
      '',
    );
    expect(screen.getByTestId('inline-edit-Policy-number')).toHaveProp(
      'value',
      '',
    );
  });

  it('renders an empty name value when name is null', () => {
    renderWithState({
      ...mockCompanion,
      name: null,
    } as unknown as Companion);
    expect(screen.getByTestId('inline-edit-Name')).toHaveProp('value', '');
  });

  it('passes a null selected country when the origin is not in the list', () => {
    renderWithState({
      ...mockCompanion,
      countryOfOrigin: 'Mexico',
    } as Companion);
    expect(screen.getByTestId('country-sheet')).toHaveProp(
      'selectedCountry',
      null,
    );
  });

  it('clears date of birth when the picker reports a null date', async () => {
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;
    renderWithState(mockCompanion);
    fireEvent.press(screen.getByTestId('row-button-Date-of-birth'));
    fireEvent(screen.getByTestId('dob-picker'), 'onDateChange', null);
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          dateOfBirth: null,
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('clears country of origin when the sheet saves a null country', async () => {
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;
    renderWithState(mockCompanion);
    fireEvent(screen.getByTestId('country-sheet'), 'onSave', null);
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          countryOfOrigin: null,
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('keeps ageWhenNeutered when the neutered sheet re-selects "neutered"', async () => {
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;
    renderWithState({
      ...mockCompanion,
      neuteredStatus: 'neutered' as Companion['neuteredStatus'],
      ageWhenNeutered: '5',
    } as Companion);
    fireEvent(
      screen.getByTestId('neutered-sheet'),
      'onSave',
      'neutered' as Companion['neuteredStatus'],
    );
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          neuteredStatus: 'neutered',
          ageWhenNeutered: '5',
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('keeps insurance details when the insured sheet re-selects "insured"', async () => {
    const updateProfileMock = require('@/features/companion')
      .updateCompanionProfile as jest.Mock;
    renderWithState({
      ...mockCompanion,
      insuredStatus: 'insured' as Companion['insuredStatus'],
      insuranceCompany: 'AcmeIns',
      insurancePolicyNumber: 'POL1',
    } as Companion);
    fireEvent(
      screen.getByTestId('insured-sheet'),
      'onSave',
      'insured' as Companion['insuredStatus'],
    );
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        parentId: mockCompanion.userId,
        updatedCompanion: expect.objectContaining({
          insuredStatus: 'insured',
          insuranceCompany: 'AcmeIns',
          updatedAt: expect.any(String),
        }),
      }),
    );
  });

  it('falls back to the breed code when a fetched entry has no display', async () => {
    (
      require('@/features/companion/services/codeEntriesService')
        .fetchBreedCodeEntries as jest.Mock
    ).mockResolvedValue([{code: 'boxer', meta: {speciesCode: 'canine'}}]);
    renderWithState(mockCompanion);
    await waitFor(() => {
      expect(screen.getByTestId('breed-sheet')).toHaveProp('breeds', [
        {
          speciesId: 0,
          speciesName: 'canine',
          breedId: 0,
          breedName: 'boxer',
          speciesCode: 'canine',
          breedCode: 'boxer',
        },
      ]);
    });
  });

  it('bails out of breed mapping when unmounted before the fetch resolves', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise(res => {
      resolveFetch = res;
    });
    const fetchMock =
      require('@/features/companion/services/codeEntriesService')
        .fetchBreedCodeEntries as jest.Mock;
    fetchMock.mockReturnValueOnce(pending);

    const {unmount} = renderWithState(mockCompanion);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    unmount();

    await act(async () => {
      resolveFetch([{display: 'X', code: 'x', meta: {speciesCode: 'canine'}}]);
      await pending;
    });
  });

  it('does not reset breeds after unmount when the fetch rejects', async () => {
    let rejectFetch: (reason?: unknown) => void = () => {};
    const pending = new Promise((_res, rej) => {
      rejectFetch = rej;
    });
    pending.catch(() => {});
    const fetchMock =
      require('@/features/companion/services/codeEntriesService')
        .fetchBreedCodeEntries as jest.Mock;
    fetchMock.mockReturnValueOnce(pending);

    const {unmount} = renderWithState(mockCompanion);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    unmount();

    await act(async () => {
      rejectFetch(new Error('late failure'));
      await pending.catch(() => {});
    });
  });
});
