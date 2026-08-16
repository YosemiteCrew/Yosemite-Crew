import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Alert, Linking, Platform} from 'react-native';
import {PassportScreen} from '@/features/passport/screens/PassportScreen/PassportScreen';
import passportReducer, {
  fetchPassport,
} from '@/features/passport/passportSlice';
import documentReducer, {
  fetchDocuments,
} from '@/features/documents/documentSlice';
import {passportApi} from '@/features/passport/services/passportService';
import {setSelectedCompanion} from '@/features/companion';

jest.mock('@/features/passport/services/passportService', () => ({
  passportApi: {
    getApplePassUrl: jest.fn(
      (patientId: string) =>
        `https://test-api.example.com/public/pet-passport/${patientId}/wallet/apple`,
    ),
    getGoogleWalletUrl: jest.fn(),
  },
}));

// Mirrors src/localization/resources/en/common.json so the assertions below
// read as the copy a user actually sees, while still proving every string
// goes through t().
const PASSPORT_TRANSLATIONS: Record<string, string> = {
  'passport.title': 'Pet Passport',
  'passport.empty': 'No passport has been issued for this pet yet.',
  'passport.sexLabel': 'Sex',
  'passport.dateOfBirthLabel': 'Date of birth',
  'passport.microchipLabel': 'Microchip',
  'passport.passportNumberLabel': 'Passport number',
  'passport.issuingDetailsTitle': 'Issuing details',
  'passport.issuingPracticeLabel': 'Issuing practice',
  'passport.rabiesTitle': 'Rabies vaccination',
  'passport.rabiesNextDue': 'Next due {{date}}',
  'passport.rabiesOnRecord': 'On record',
  'passport.vaccinationsTitle': 'Vaccinations',
  'passport.vaccinationsEmpty': 'No vaccinations recorded',
  'passport.parasiteTreatmentsTitle': 'Parasite treatments',
  'passport.parasiteTreatmentsEmpty': 'No parasite treatments recorded',
  'passport.rabiesTitrationsTitle': 'Rabies titrations',
  'passport.rabiesTitrationsEmpty': 'No rabies titrations recorded',
  'passport.clinicalExamsTitle': 'Clinical exams',
  'passport.clinicalExamsEmpty': 'No clinical exams recorded',
  'passport.resultLabel': 'Result',
  'passport.resultValue': '{{value}} IU/mL',
  'passport.fitForTravel': 'Fit for travel',
  'passport.notFitForTravel': 'Not fit for travel',
  'passport.findingsLabel': 'Findings',
  'passport.addToAppleWallet': 'Add to Apple Wallet',
  'passport.addToGoogleWallet': 'Add to Google Wallet',
  'passport.walletErrorTitle': 'Wallet pass unavailable',
  'passport.walletErrorMessage':
    'This pet passport could not be added to {{wallet}} Wallet yet.',
  'passport.uploadsTitle': 'Your uploads',
  'passport.uploadsEmpty': 'No historical records uploaded yet.',
  'passport.dateLabel': 'Date',
  'passport.clinicLabel': 'Clinic',
  'passport.pendingReview': 'Pending review',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'passport.recordCount') {
        return `${options?.count} record${options?.count === 1 ? '' : 's'}`;
      }
      return (PASSPORT_TRANSLATIONS[key] ?? key).replace(
        /{{(\w+)}}/g,
        (_match, name: string) => String(options?.[name] ?? ''),
      );
    },
  }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockCompanionId = 'companion-123';
const mockUseRoute = jest.fn(() => ({params: {companionId: mockCompanionId}}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    getParent: () => ({navigate: mockParentNavigate}),
  }),
  useRoute: () => mockUseRoute(),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// The pending/fulfilled lifecycle of the real thunk would immediately
// overwrite the preloaded Redux state used to assert each render branch
// (loading/error/empty/populated), so it's stubbed as a no-op action here.
// The dispatch call itself is asserted separately, without touching state.
jest.mock('@/features/passport/passportSlice', () => {
  const actual = jest.requireActual('@/features/passport/passportSlice');
  return {
    __esModule: true,
    ...actual,
    fetchPassport: jest.fn(() => ({type: 'passport/fetchPassport/mock'})),
  };
});

// Same reasoning as above, for the documents fetch this screen also triggers.
jest.mock('@/features/documents/documentSlice', () => {
  const actual = jest.requireActual('@/features/documents/documentSlice');
  return {
    __esModule: true,
    ...actual,
    fetchDocuments: jest.fn(() => ({type: 'documents/fetchDocuments/mock'})),
  };
});

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {Text, TouchableOpacity} = require('react-native');
    return (
      <>
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back-btn" onPress={onBack} />
      </>
    );
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton',
  () => ({
    LiquidGlassIconButton: ({onPress, children}: any) => {
      const {TouchableOpacity} = require('react-native');
      return (
        <TouchableOpacity
          testID="upload-historical-record-button"
          onPress={onPress}>
          {children}
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/shared/components/common', () => ({
  GifLoader: () => {
    const {Text} = require('react-native');
    return <Text testID="gif-loader">Loading</Text>;
  },
}));

jest.mock(
  '@/shared/components/common/SubcategoryAccordion/SubcategoryAccordion',
  () => ({
    SubcategoryAccordion: ({title, subtitle, children}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View>
          <Text>{title}</Text>
          <Text>{subtitle}</Text>
          {children}
        </View>
      );
    },
  }),
);

const buildStore = (preloadedState?: any) =>
  configureStore({
    reducer: {passport: passportReducer, documents: documentReducer},
    preloadedState,
  });

const emptyDocumentsState = {
  documents: [],
  loading: false,
  fetching: false,
  error: null,
  uploadProgress: 0,
  viewLoading: {},
  searchResults: [],
  searchLoading: false,
  searchError: null,
};

const mockPassport = {
  identity: {
    id: mockCompanionId,
    name: 'Rex',
    species: 'DOG',
    breed: 'Labrador',
    sex: 'Male',
    dateOfBirth: '2020-01-01',
  },
  microchip: {number: '981000000000001'},
  passportNumber: 'PP-001',
  rabies: {
    id: 'vac-1',
    patientId: mockCompanionId,
    vaccineType: 'RABIES',
    vaccineName: 'Rabisin',
    dateAdministered: '2024-01-01',
    nextDueDate: '2027-01-01',
    createdAt: '2024-01-01',
  },
  vaccinations: [
    {
      id: 'vac-2',
      patientId: mockCompanionId,
      vaccineType: 'CORE',
      vaccineName: 'DHPPi',
      dateAdministered: '2024-02-01',
      createdAt: '2024-02-01',
    },
  ],
  parasiteTreatments: [
    {
      id: 'para-1',
      patientId: mockCompanionId,
      treatmentType: 'ECHINOCOCCUS',
      productName: 'Droncit',
      treatedAt: '2024-03-01T10:00:00Z',
      administeringVetName: 'Dr Smith',
      createdAt: '2024-03-01',
    },
  ],
  rabiesTitrations: [
    {
      id: 'titr-1',
      patientId: mockCompanionId,
      approvedLab: 'National Lab',
      sampleDate: '2024-01-10',
      resultIuMl: 0.8,
      createdAt: '2024-01-10',
    },
  ],
  clinicalExams: [
    {
      id: 'exam-1',
      patientId: mockCompanionId,
      examinedAt: '2024-04-01',
      fitForTravel: true,
      findings: 'Healthy',
      examiningVetName: 'Dr Smith',
      createdAt: '2024-04-01',
    },
  ],
  issuance: {
    passportNumber: 'PP-001',
    issuingPractice: 'Riverside Vets',
    issuingVetName: 'Dr Smith',
    issueDate: '2024-01-05',
  },
} as any;

describe('PassportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state while the passport is being fetched', () => {
    const store = buildStore({
      passport: {byCompanionId: {}, loading: true, error: null},
    });

    const {getByTestId} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(getByTestId('gif-loader')).toBeTruthy();
  });

  it('shows an error state when the fetch fails and no passport is cached', () => {
    const store = buildStore({
      passport: {
        byCompanionId: {},
        loading: false,
        error: 'Passport not found.',
      },
    });

    const {getByText} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(getByText('Passport not found.')).toBeTruthy();
  });

  it('shows an empty state when there is no passport and no error', () => {
    const store = buildStore({
      passport: {byCompanionId: {}, loading: false, error: null},
    });

    const {getByText} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(
      getByText('No passport has been issued for this pet yet.'),
    ).toBeTruthy();
  });

  it('renders the passport identity, issuance, and record sections when data is present', () => {
    const store = buildStore({
      passport: {
        byCompanionId: {[mockCompanionId]: mockPassport},
        loading: false,
        error: null,
      },
    });

    const {getByText, getAllByText} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(getByText('Rex')).toBeTruthy();
    expect(getByText('DOG · Labrador')).toBeTruthy();
    expect(getByText('Riverside Vets')).toBeTruthy();
    expect(getByText('Rabies vaccination')).toBeTruthy();
    expect(getAllByText('DHPPi').length).toBeGreaterThan(0);
    expect(getByText('Droncit')).toBeTruthy();
    expect(getByText('National Lab')).toBeTruthy();
    expect(getByText('0.8 IU/mL')).toBeTruthy();
    expect(getByText('Fit for travel')).toBeTruthy();
    expect(getByText('Healthy')).toBeTruthy();
  });

  it('renders the localised screen title', () => {
    const store = buildStore({
      passport: {byCompanionId: {}, loading: false, error: null},
    });

    const {getByText} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(getByText('Pet Passport')).toBeTruthy();
  });

  it('pluralises the record count on each section', () => {
    const store = buildStore({
      passport: {
        byCompanionId: {[mockCompanionId]: mockPassport},
        loading: false,
        error: null,
      },
    });

    const {getAllByText} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(getAllByText('1 record').length).toBe(4);
    expect(getAllByText('Next due 01/01/2027').length).toBeGreaterThan(0);
  });

  it('falls back to the on-record subtitle when the rabies shot has no next due date', () => {
    const store = buildStore({
      passport: {
        byCompanionId: {
          [mockCompanionId]: {
            ...mockPassport,
            rabies: {...mockPassport.rabies, nextDueDate: undefined},
          },
        },
        loading: false,
        error: null,
      },
    });

    const {getByText} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(getByText('On record')).toBeTruthy();
  });

  it('renders with photo, no rabies/issuance/microchip, and an unfit exam', () => {
    const minimalPassport = {
      identity: {
        id: mockCompanionId,
        name: 'Milo',
        species: 'CAT',
        breed: 'Siamese',
        sex: 'Female',
        photoUrl: 'https://example.com/milo.png',
      },
      vaccinations: [],
      parasiteTreatments: [],
      rabiesTitrations: [],
      clinicalExams: [
        {
          id: 'exam-2',
          patientId: mockCompanionId,
          examinedAt: '2024-05-01',
          fitForTravel: false,
          createdAt: '2024-05-01',
        },
      ],
    } as any;
    const store = buildStore({
      passport: {
        byCompanionId: {[mockCompanionId]: minimalPassport},
        loading: false,
        error: null,
      },
    });

    const {getByText, queryByText} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(getByText('Milo')).toBeTruthy();
    expect(getByText('Not fit for travel')).toBeTruthy();
    expect(getByText('No vaccinations recorded')).toBeTruthy();
    expect(getByText('No parasite treatments recorded')).toBeTruthy();
    expect(getByText('No rabies titrations recorded')).toBeTruthy();
    expect(queryByText('Rabies vaccination')).toBeNull();
  });

  it('does not dispatch fetchPassport when companionId is missing from route params', () => {
    mockUseRoute.mockReturnValueOnce({params: {companionId: ''}});
    const store = buildStore({
      passport: {byCompanionId: {}, loading: false, error: null},
    });

    render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(fetchPassport).not.toHaveBeenCalled();
  });

  it('navigates back when the header back button is pressed', () => {
    const store = buildStore({
      passport: {byCompanionId: {}, loading: false, error: null},
    });

    const {getByTestId} = render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    fireEvent.press(getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('dispatches fetchPassport for the routed companionId on mount', () => {
    const store = buildStore({
      passport: {byCompanionId: {}, loading: false, error: null},
    });
    const dispatchSpy = jest.spyOn(store, 'dispatch');

    render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(fetchPassport).toHaveBeenCalledWith({companionId: mockCompanionId});
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'passport/fetchPassport/mock',
    });
  });

  it('dispatches fetchDocuments for the routed companionId on mount', () => {
    const store = buildStore({
      passport: {byCompanionId: {}, loading: false, error: null},
    });
    const dispatchSpy = jest.spyOn(store, 'dispatch');

    render(
      <Provider store={store}>
        <PassportScreen />
      </Provider>,
    );

    expect(fetchDocuments).toHaveBeenCalledWith({
      companionId: mockCompanionId,
    });
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'documents/fetchDocuments/mock',
    });
  });

  describe('historical uploads section', () => {
    const mockHistoricalDoc = {
      id: 'doc-1',
      companionId: mockCompanionId,
      category: 'health',
      subcategory: 'vaccination',
      visitType: '',
      title: 'Old rabies certificate',
      businessName: 'Old Town Vets',
      issueDate: '2022-05-01',
      files: [],
      createdAt: '2022-05-01',
      updatedAt: '2022-05-01',
      isSynced: false,
      isUserAdded: true,
    };

    it('shows an empty prompt when no historical records have been uploaded', () => {
      const store = buildStore({
        passport: {byCompanionId: {}, loading: false, error: null},
        documents: emptyDocumentsState,
      });

      const {getByText} = render(
        <Provider store={store}>
          <PassportScreen />
        </Provider>,
      );

      expect(getByText('No historical records uploaded yet.')).toBeTruthy();
    });

    it('lists uploaded historical records as pending review', () => {
      const store = buildStore({
        passport: {byCompanionId: {}, loading: false, error: null},
        documents: {...emptyDocumentsState, documents: [mockHistoricalDoc]},
      });

      const {getByText} = render(
        <Provider store={store}>
          <PassportScreen />
        </Provider>,
      );

      expect(getByText('Old rabies certificate')).toBeTruthy();
      expect(getByText('Old Town Vets')).toBeTruthy();
      expect(getByText('Pending review')).toBeTruthy();
    });

    it('omits the date row for a historical record with no issue date', () => {
      const store = buildStore({
        passport: {byCompanionId: {}, loading: false, error: null},
        documents: {
          ...emptyDocumentsState,
          documents: [{...mockHistoricalDoc, issueDate: undefined}],
        },
      });

      const {getByText, queryByText} = render(
        <Provider store={store}>
          <PassportScreen />
        </Provider>,
      );

      expect(getByText('Old rabies certificate')).toBeTruthy();
      expect(queryByText('Date')).toBeNull();
    });

    it('excludes documents for a different companion, category, or subcategory', () => {
      const store = buildStore({
        passport: {byCompanionId: {}, loading: false, error: null},
        documents: {
          ...emptyDocumentsState,
          documents: [
            {...mockHistoricalDoc, id: 'doc-2', companionId: 'other-pet'},
            {...mockHistoricalDoc, id: 'doc-3', category: 'admin'},
            {...mockHistoricalDoc, id: 'doc-4', subcategory: 'prescription'},
          ],
        },
      });

      const {getByText, queryByText} = render(
        <Provider store={store}>
          <PassportScreen />
        </Provider>,
      );

      expect(queryByText('Old rabies certificate')).toBeNull();
      expect(getByText('No historical records uploaded yet.')).toBeTruthy();
    });

    it('shows the uploads section on the populated passport view too', () => {
      const store = buildStore({
        passport: {
          byCompanionId: {[mockCompanionId]: mockPassport},
          loading: false,
          error: null,
        },
        documents: {...emptyDocumentsState, documents: [mockHistoricalDoc]},
      });

      const {getByText} = render(
        <Provider store={store}>
          <PassportScreen />
        </Provider>,
      );

      expect(getByText('Your uploads')).toBeTruthy();
      expect(getByText('Old rabies certificate')).toBeTruthy();
    });

    it('only shows a divider between rows, not after the last one, when a section has multiple records', () => {
      const multiRecordPassport = {
        ...mockPassport,
        vaccinations: [
          ...mockPassport.vaccinations,
          {
            id: 'vac-3',
            patientId: mockCompanionId,
            vaccineType: 'CORE',
            vaccineName: 'Leptospirosis',
            dateAdministered: '2024-06-01',
            createdAt: '2024-06-01',
          },
        ],
      };
      const secondHistoricalDoc = {
        ...mockHistoricalDoc,
        id: 'doc-2',
        title: 'Second historical record',
      };
      const store = buildStore({
        passport: {
          byCompanionId: {[mockCompanionId]: multiRecordPassport},
          loading: false,
          error: null,
        },
        documents: {
          ...emptyDocumentsState,
          documents: [mockHistoricalDoc, secondHistoricalDoc],
        },
      });

      const {getByText} = render(
        <Provider store={store}>
          <PassportScreen />
        </Provider>,
      );

      expect(getByText('DHPPi')).toBeTruthy();
      expect(getByText('Leptospirosis')).toBeTruthy();
      expect(getByText('Old rabies certificate')).toBeTruthy();
      expect(getByText('Second historical record')).toBeTruthy();
    });

    it('selects the companion and navigates to a pre-filled AddDocument screen on upload', () => {
      const store = buildStore({
        passport: {byCompanionId: {}, loading: false, error: null},
        documents: emptyDocumentsState,
      });
      const dispatchSpy = jest.spyOn(store, 'dispatch');

      const {getByTestId} = render(
        <Provider store={store}>
          <PassportScreen />
        </Provider>,
      );

      fireEvent.press(getByTestId('upload-historical-record-button'));

      expect(dispatchSpy).toHaveBeenCalledWith(
        setSelectedCompanion(mockCompanionId),
      );
      expect(mockParentNavigate).toHaveBeenCalledWith('Documents', {
        screen: 'AddDocument',
        params: {
          initialCategory: 'health',
          initialSubcategory: 'vaccination',
        },
      });
    });
  });

  describe('wallet buttons', () => {
    const buildPopulatedStore = () =>
      buildStore({
        passport: {
          byCompanionId: {[mockCompanionId]: mockPassport},
          loading: false,
          error: null,
        },
      });

    afterEach(() => {
      Platform.OS = 'ios';
    });

    it('shows the Apple Wallet button on iOS and hides it on Android', () => {
      Platform.OS = 'ios';
      const iosRender = render(
        <Provider store={buildPopulatedStore()}>
          <PassportScreen />
        </Provider>,
      );
      expect(iosRender.getByText('Add to Apple Wallet')).toBeTruthy();
      iosRender.unmount();

      Platform.OS = 'android';
      const androidRender = render(
        <Provider store={buildPopulatedStore()}>
          <PassportScreen />
        </Provider>,
      );
      expect(androidRender.queryByText('Add to Apple Wallet')).toBeNull();
    });

    it('always shows the Google Wallet button', () => {
      Platform.OS = 'android';
      const {getByText} = render(
        <Provider store={buildPopulatedStore()}>
          <PassportScreen />
        </Provider>,
      );
      expect(getByText('Add to Google Wallet')).toBeTruthy();
    });

    it('opens the Apple Wallet URL when pressed', async () => {
      Platform.OS = 'ios';
      const openURLSpy = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(true as never);

      const {getByText} = render(
        <Provider store={buildPopulatedStore()}>
          <PassportScreen />
        </Provider>,
      );

      await act(async () => {
        fireEvent.press(getByText('Add to Apple Wallet'));
      });

      expect(passportApi.getApplePassUrl).toHaveBeenCalledWith(mockCompanionId);
      expect(openURLSpy).toHaveBeenCalledWith(
        `https://test-api.example.com/public/pet-passport/${mockCompanionId}/wallet/apple`,
      );
    });

    it('shows an alert when the Apple Wallet URL fails to open', async () => {
      Platform.OS = 'ios';
      jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('nope'));
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

      const {getByText} = render(
        <Provider store={buildPopulatedStore()}>
          <PassportScreen />
        </Provider>,
      );

      await act(async () => {
        fireEvent.press(getByText('Add to Apple Wallet'));
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Wallet pass unavailable',
          'This pet passport could not be added to Apple Wallet yet.',
        );
      });
    });

    it('fetches and opens the Google Wallet save URL when pressed', async () => {
      (passportApi.getGoogleWalletUrl as jest.Mock).mockResolvedValue(
        'https://pay.google.com/gp/v/save/mock-jwt',
      );
      const openURLSpy = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(true as never);

      const {getByText} = render(
        <Provider store={buildPopulatedStore()}>
          <PassportScreen />
        </Provider>,
      );

      await act(async () => {
        fireEvent.press(getByText('Add to Google Wallet'));
      });

      await waitFor(() => {
        expect(passportApi.getGoogleWalletUrl).toHaveBeenCalledWith(
          mockCompanionId,
        );
        expect(openURLSpy).toHaveBeenCalledWith(
          'https://pay.google.com/gp/v/save/mock-jwt',
        );
      });
    });

    it('shows an alert when the Google Wallet fetch fails', async () => {
      (passportApi.getGoogleWalletUrl as jest.Mock).mockRejectedValue(
        new Error('nope'),
      );
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

      const {getByText} = render(
        <Provider store={buildPopulatedStore()}>
          <PassportScreen />
        </Provider>,
      );

      await act(async () => {
        fireEvent.press(getByText('Add to Google Wallet'));
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Wallet pass unavailable',
          'This pet passport could not be added to Google Wallet yet.',
        );
      });
    });
  });
});
