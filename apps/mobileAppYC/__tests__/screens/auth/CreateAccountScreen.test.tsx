import React from 'react';
import {render} from '@testing-library/react-native';
import {CreateAccountScreen} from '@/features/auth/screens/CreateAccountScreen';
import {mockTheme} from '../../setup/mockTheme';

jest.mock('@/assets/images', () => ({
  Images: {
    dropdownIcon: 1,
    calendarIcon: 2,
    verificationSuccess: 3,
  },
}));

jest.mock('@/hooks', () => ({
  useTheme: jest.fn(() => ({theme: mockTheme})),
  useAddressAutocomplete: jest.fn(() => ({
    setQuery: jest.fn(),
    suggestions: [],
    isFetching: false,
    error: null,
    clearSuggestions: jest.fn(),
    selectSuggestion: jest.fn(),
    resetError: jest.fn(),
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.date_of_birth_optional': 'Date of birth (optional)',
        'auth.date_of_birth_optional_placeholder':
          'Select date of birth (optional)',
        'auth.age_verification_info_cta': 'Why we ask for age verification',
        'auth.age_verification_sheet_title': '18+ Age Verification',
        'auth.age_verification_sheet_intro':
          'In some countries, 18+ regulations require users to be adults before creating an account and using Yosemite Crew.',
        'auth.age_verification_sheet_why_title': 'Why we ask',
        'auth.age_verification_sheet_why_body':
          'We ask this because some countries require age checks for 18+ services, and we need to keep the platform compliant in those regions.',
        'auth.age_verification_sheet_privacy_title': 'Privacy & Security',
        'auth.age_verification_sheet_privacy_body':
          'By continuing, you confirm that you are at least 18 years old. If you are under 18, you should not create an account.',
        'auth.age_verification_sheet_restriction_notice':
          'If you cannot confirm that you are 18 or older, you will not be able to create an account.',
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

jest.mock('@/features/auth/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    login: jest.fn(),
    logout: jest.fn(),
  })),
}));

jest.mock('@/features/account/services/profileService', () => ({
  createParentProfile: jest.fn(),
  updateParentProfile: jest.fn(),
}));

jest.mock('@/shared/services/uploadService', () => ({
  requestParentProfileUploadUrl: jest.fn(),
  uploadFileToPresignedUrl: jest.fn(),
}));

jest.mock('@/shared/services/LocationService', () => ({
  __esModule: true,
  default: {
    getLocationWithRetry: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/shared/components/common', () => ({
  Input: ({label}: {label: string}) => {
    const RN = jest.requireActual('react-native');
    return <RN.Text>{label}</RN.Text>;
  },
  Header: ({title}: {title: string}) => {
    const RN = jest.requireActual('react-native');
    return <RN.Text>{title}</RN.Text>;
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => ({
    LiquidGlassHeaderScreen: ({
      header,
      children,
    }: {
      header: React.ReactNode;
      children: (style: object) => React.ReactNode;
    }) =>
      (() => {
        const RN = jest.requireActual('react-native');
        return (
          <RN.View>
            {header}
            {children({})}
          </RN.View>
        );
      })(),
  }),
);

jest.mock('@/shared/components/common/TouchableInput/TouchableInput', () => ({
  TouchableInput: ({
    label,
    placeholder,
    onPress,
  }: {
    label: string;
    placeholder: string;
    onPress: () => void;
  }) =>
    (() => {
      const RN = jest.requireActual('react-native');
      return (
        <RN.TouchableOpacity onPress={onPress}>
          <RN.Text>{label}</RN.Text>
          <RN.Text>{placeholder}</RN.Text>
        </RN.TouchableOpacity>
      );
    })(),
}));

jest.mock(
  '@/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => ({
    SimpleDatePicker: () => null,
    formatDateForDisplay: () => 'Jan 01, 2000',
  }),
);

jest.mock(
  '@/shared/components/common/ProfileImagePicker/ProfileImagePicker',
  () => ({
    ProfileImagePicker: () => {
      const RN = jest.requireActual('react-native');
      return <RN.View />;
    },
  }),
);

jest.mock(
  '@/shared/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet',
  () => {
    const mockReact = jest.requireActual('react');
    return {
      CountryMobileBottomSheet: mockReact.forwardRef(() => {
        const RN = jest.requireActual('react-native');
        return <RN.View />;
      }),
    };
  },
);

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const mockReact = jest.requireActual('react');
    return mockReact.forwardRef(({title}: {title: string}, _ref: unknown) =>
      (() => {
        const RN = jest.requireActual('react-native');
        return <RN.Text>{title}</RN.Text>;
      })(),
    );
  },
);

jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const mockReact = jest.requireActual('react');
  return mockReact.forwardRef(
    ({children}: {children: React.ReactNode}, _ref: unknown) =>
      (() => {
        const RN = jest.requireActual('react-native');
        return <RN.View>{children}</RN.View>;
      })(),
  );
});

jest.mock('@/shared/components/forms/AddressFields', () => ({
  AddressFields: () => {
    const RN = jest.requireActual('react-native');
    return <RN.View />;
  },
}));

jest.mock('@/shared/components/common/Checkbox/Checkbox', () => ({
  Checkbox: () => {
    const RN = jest.requireActual('react-native');
    return <RN.View />;
  },
}));

describe('CreateAccountScreen', () => {
  it('renders age verification CTA and bottom sheet content', () => {
    const navigation = {
      navigate: jest.fn(),
      reset: jest.fn(),
      setParams: jest.fn(),
    };

    const route = {
      params: {
        email: 'test@example.com',
        userId: 'user-1',
        profileToken: null,
        tokens: {
          accessToken: 'access-token',
          idToken: 'id-token',
          provider: 'email',
        },
        initialAttributes: undefined,
        hasRemoteProfile: false,
        existingParentProfile: undefined,
        showOtpSuccess: false,
      },
    };

    const {getByText} = render(
      <CreateAccountScreen
        navigation={navigation as any}
        route={route as any}
      />,
    );

    expect(getByText('Date of birth (optional)')).toBeTruthy();
    expect(getByText('Why we ask for age verification')).toBeTruthy();
    expect(getByText('18+ Age Verification')).toBeTruthy();
    expect(
      getByText(
        'If you cannot confirm that you are 18 or older, you will not be able to create an account.',
      ),
    ).toBeTruthy();
  });
});
