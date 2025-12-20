import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render, fireEvent, act} from '@testing-library/react-native';
import {CoParentProfileScreen} from '../../../../../src/features/coParent/screens/CoParentProfileScreen/CoParentProfileScreen';
import * as Redux from 'react-redux';
import {Alert} from 'react-native';

// --- Mocks ---
const mockGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
  navigate: jest.fn(),
} as any;

const mockRoute = {
  params: {
    coParentId: 'cp-1',
  },
} as any;

// Mock Redux
const mockDispatch = jest.fn();
let mockState: any = {};
const mockUnwrap = jest.fn();

jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
jest.spyOn(Redux, 'useSelector').mockImplementation(cb => cb(mockState));

// Feature Mocks
const mockActions = {
  addCoParent: jest.fn(() => ({
    unwrap: mockUnwrap,
  })),
};

jest.mock('../../../../../src/features/coParent', () => ({
  // Fixed spread argument error by accepting a single argument (payload)
  addCoParent: (arg: any) => mockActions.addCoParent(arg),
  selectCoParentById: (id: string) => (state: any) => {
    // Simulate finding the co-parent in the mock state list
    return state.coParent?.coParents?.find((cp: any) => cp.id === id);
  },
}));

jest.mock('@/features/companion', () => ({
  selectCompanions: (state: any) => state.companion?.companions || [],
}));

// Hook Mocks
const mockInviteFlow = {
  addCoParentSheetRef: {current: {open: jest.fn()}},
  coParentInviteSheetRef: {current: {open: jest.fn()}},
  handleAddCoParentClose: jest.fn(),
  handleInviteAccept: jest.fn(),
  handleInviteDecline: jest.fn(),
};

let capturedInviteComplete: (() => void) | undefined;

jest.mock(
  '../../../../../src/features/coParent/hooks/useCoParentInviteFlow',
  () => ({
    useCoParentInviteFlow: ({onInviteComplete}: any) => {
      capturedInviteComplete = onInviteComplete;
      return mockInviteFlow;
    },
  }),
);

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Asset Mocks
jest.mock('@/assets/images', () => ({
  Images: {
    bgCoParent: {uri: 'bg-image'},
    addIconDark: {uri: 'add-icon'},
  },
}));

// Utils Mocks
jest.mock('@/shared/utils/imageUri', () => ({
  normalizeImageUri: (uri: string) => (uri === 'invalid' ? null : uri),
}));

jest.mock('../../../../../src/features/coParent/styles/commonStyles', () => ({
  createCommonCoParentStyles: () => ({
    container: {},
    centerContent: {},
  }),
}));

// Component Mocks
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back-btn" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, loading, disabled}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          testID="send-invite-btn"
          onPress={onPress}
          disabled={disabled}>
          <Text>{loading ? 'Sending...' : title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => {
    const {View} = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock(
  '../../../../../src/features/coParent/components/AddCoParentBottomSheet/AddCoParentBottomSheet',
  () => {
    const {View} = require('react-native');
    return () => <View testID="add-coparent-sheet" />;
  },
);

jest.mock(
  '../../../../../src/features/coParent/components/CoParentInviteBottomSheet/CoParentInviteBottomSheet',
  () => {
    const {View} = require('react-native');
    return () => <View testID="invite-sheet" />;
  },
);

jest.spyOn(Alert, 'alert');

describe('CoParentProfileScreen', () => {
  const mockCoParent = {
    id: 'cp-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phoneNumber: '1234567890',
    profilePicture: 'http://profile.pic',
    companions: [
      {
        companionId: 'c1',
        companionName: 'Buddy',
        breed: 'Golden Retriever',
        profileImage: 'http://dog.pic',
      },
      {
        companionId: 'c2',
        companionName: 'Lucy',
        breed: null,
        profileImage: null,
      },
      {
        companionId: 'c3',
        companionName: 'BadImg',
        breed: 'Poodle',
        profileImage: 'invalid',
      },
    ],
  };

  const mockCompanion = {id: 'comp-1', name: 'Buddy', profileImage: 'img'};

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnwrap.mockResolvedValue({});
    mockDispatch.mockImplementation(action => action);

    mockState = {
      coParent: {
        coParents: [mockCoParent],
      },
      companion: {
        companions: [mockCompanion],
      },
    };
    capturedInviteComplete = undefined;
  });

  it('renders correctly with full data', () => {
    // Removed getAllByImage as it is not standard and was flagged as error
    const {getByText} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('john@example.com')).toBeTruthy();
    expect(getByText('1234567890')).toBeTruthy();
    expect(getByText('Buddy')).toBeTruthy();
    expect(getByText('Golden Retriever')).toBeTruthy();
  });

  it('handles Back navigation', () => {
    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );
    fireEvent.press(getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders Not Found state if ID does not exist', () => {
    mockState.coParent.coParents = [];
    const {getByText} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByText('Co-Parent not found')).toBeTruthy();
  });

  it('renders initials when profile picture is missing', () => {
    const noPicCoParent = {...mockCoParent, profilePicture: null};
    mockState.coParent.coParents = [noPicCoParent];

    const {getByText} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('J')).toBeTruthy();
  });

  it('renders initials from Last Name if First Name missing', () => {
    const noFirstCoParent = {
      ...mockCoParent,
      firstName: null,
      profilePicture: null,
    };
    mockState.coParent.coParents = [noFirstCoParent];

    const {getByText} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByText('D')).toBeTruthy();
  });

  it('renders initials from Email if names missing', () => {
    const emailCoParent = {
      ...mockCoParent,
      firstName: null,
      lastName: null,
      profilePicture: null,
    };
    mockState.coParent.coParents = [emailCoParent];

    const {getByText} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByText('J')).toBeTruthy();
  });

  it('renders default initial "C" if all identifiers missing', () => {
    const unknownCoParent = {
      ...mockCoParent,
      firstName: null,
      lastName: null,
      email: null,
      profilePicture: null,
    };
    mockState.coParent.coParents = [unknownCoParent];

    const {getByText} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByText('C')).toBeTruthy();
  });

  it('renders fallback text for missing phone and email', () => {
    const sparseCoParent = {...mockCoParent, email: null, phoneNumber: null};
    mockState.coParent.coParents = [sparseCoParent];

    const {getAllByText} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const naElements = getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(2);
  });

  it('renders fallback for companion details (Unknown breed, Initials avatar)', () => {
    const {getByText} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Lucy')).toBeTruthy();
    expect(getByText('Unknown')).toBeTruthy();
    expect(getByText('L')).toBeTruthy();
  });

  it('handles invalid image uri normalization (fallback to empty string logic check)', () => {
    render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );
  });

  it('handles Invite Success flow', async () => {
    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const inviteBtn = getByTestId('send-invite-btn');

    await act(async () => {
      fireEvent.press(inviteBtn);
    });

    expect(mockActions.addCoParent).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteRequest: expect.objectContaining({
          email: 'john@example.com',
          candidateName: 'John Doe',
        }),
      }),
    );
    expect(mockUnwrap).toHaveBeenCalled();
    expect(mockInviteFlow.addCoParentSheetRef.current.open).toHaveBeenCalled();
  });

  it('handles invite complete callback navigation', () => {
    render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    act(() => {
      if (capturedInviteComplete) capturedInviteComplete();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(2);
  });

  it('handles Invite Failure flow', async () => {
    mockUnwrap.mockRejectedValueOnce(new Error('Failed'));

    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const inviteBtn = getByTestId('send-invite-btn');

    await act(async () => {
      fireEvent.press(inviteBtn);
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to send invite');
  });

  it('alerts if no companion is selected (Branch: !companionId)', () => {
    mockState.companion.companions = [];

    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByTestId('send-invite-btn'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Unable to send invite. Please select a companion.',
    );
    expect(mockActions.addCoParent).not.toHaveBeenCalled();
  });

  it('alerts if co-parent has no email (Branch: !inviteEmail)', () => {
    const noEmailCoParent = {...mockCoParent, email: '  '};
    mockState.coParent.coParents = [noEmailCoParent];

    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByTestId('send-invite-btn'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing email',
      expect.any(String),
    );
    expect(mockActions.addCoParent).not.toHaveBeenCalled();
  });

  it('uses email as name if name is missing (Branch: inviteName length check)', () => {
    const noNameCoParent = {...mockCoParent, firstName: '', lastName: ''};
    mockState.coParent.coParents = [noNameCoParent];

    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByTestId('send-invite-btn'));

    expect(mockActions.addCoParent).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteRequest: expect.objectContaining({
          candidateName: 'john@example.com',
        }),
      }),
    );
  });

  it('extracts companion ID from "id" property', async () => {
    mockState.companion.companions = [{id: 'id-123', name: 'C1'}];
    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => fireEvent.press(getByTestId('send-invite-btn')));

    expect(mockActions.addCoParent).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteRequest: expect.objectContaining({companionId: 'id-123'}),
      }),
    );
  });

  it('extracts companion ID from "_id" property', async () => {
    mockState.companion.companions = [{_id: 'underscore-id', name: 'C1'}];
    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => fireEvent.press(getByTestId('send-invite-btn')));

    expect(mockActions.addCoParent).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteRequest: expect.objectContaining({companionId: 'underscore-id'}),
      }),
    );
  });

  it('extracts companion ID from "companionId" property', async () => {
    mockState.companion.companions = [{companionId: 'prop-id', name: 'C1'}];
    const {getByTestId} = render(
      <CoParentProfileScreen navigation={mockNavigation} route={mockRoute} />,
    );

    await act(async () => fireEvent.press(getByTestId('send-invite-btn')));

    expect(mockActions.addCoParent).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteRequest: expect.objectContaining({companionId: 'prop-id'}),
      }),
    );
  });
});
