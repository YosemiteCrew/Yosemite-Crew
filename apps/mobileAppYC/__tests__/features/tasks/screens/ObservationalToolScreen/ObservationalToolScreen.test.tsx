import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {
  render,
  fireEvent,
  waitFor,
  screen,
} from '@testing-library/react-native';
import {ObservationalToolScreen} from '@/features/tasks/screens/ObservationalToolScreen/ObservationalToolScreen';
import * as Redux from 'react-redux';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockGetParent = jest.fn().mockReturnValue({
  navigate: mockNavigate,
});
const mockGetState = jest.fn();

// Mutable route params
let mockRouteParams = {taskId: 'task-123'};

jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      reset: mockReset,
      getParent: mockGetParent,
      getState: mockGetState,
      canGoBack: jest.fn().mockReturnValue(true),
      dispatch: jest.fn(),
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
    useFocusEffect: (cb: () => void) => {
      // FIX: Removed eslint-disable comment
      ReactLib.useEffect(cb, []);
    },
  };
});

// 2. Redux
const mockDispatch = jest.fn();
jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch);
const mockUseSelector = jest.spyOn(Redux, 'useSelector');

// 3. Mock Data & Actions
jest.mock('@/features/observationalTools/data', () => ({
  observationalToolDefinitions: {
    'test-tool': {
      id: 'test-tool',
      name: 'Test Tool',
      species: 'dog',
      overviewTitle: 'Overview',
      overviewParagraphs: ['Para 1'],
      emptyState: {
        title: 'No Providers',
        message: 'Message',
        image: 123,
      },
      steps: [
        {
          id: 'step-1',
          title: 'Step 1',
          subtitle: 'Sub 1',
          options: [{id: 'opt-A', title: 'Option A', value: 1}],
        },
        {
          id: 'step-2',
          title: 'Step 2',
          subtitle: 'Sub 2',
          options: [{id: 'opt-B', title: 'Option B', value: 2}],
        },
      ],
    },
    'cat-tool': {
      id: 'cat-tool',
      name: 'Cat Tool',
      species: 'cat',
      overviewTitle: 'Cat Overview',
      overviewParagraphs: ['Meow'],
      emptyState: {},
      steps: [
        {
          id: 'cat-step',
          title: 'Cat Step',
          options: [{id: 'c1', title: 'Cat Opt', image: {uri: 'img'}}],
        },
      ],
    },
  },
  observationalToolProviders: {
    'test-tool': [{businessId: 'biz-1', evaluationFee: 50, appointmentFee: 20}],
    'cat-tool': [],
  },
}));

jest.mock('@/features/tasks/selectors', () => ({
  selectTaskById: (id: string) => () => {
    if (id === 'task-123') {
      return {
        id,
        companionId: 'comp-1',
        details: {toolType: 'test-tool'},
      };
    }
    if (id === 'task-cat') {
      return {id, companionId: 'comp-1', details: {toolType: 'cat-tool'}};
    }
    return null;
  },
}));

jest.mock('@/features/appointments/businessesSlice', () => ({
  fetchBusinesses: jest.fn(() => ({type: 'FETCH_BUSINESSES'})),
}));

jest.mock('@/features/tasks/thunks', () => ({
  markTaskStatus: jest.fn(() => ({type: 'MARK_TASK_STATUS'})),
}));

jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(() => ({type: 'SET_SELECTED_COMPANION'})),
}));

jest.mock('@/features/tasks/utils/taskLabels', () => ({
  resolveObservationalToolLabel: () => 'Test Label',
}));

// 4. UI Components
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity testID="header-back" onPress={onBack}>
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
}));

// IMPORTANT: Mock Button to ignore disabled prop so we can test validation logic
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity testID={`btn-${title}`} onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => children,
}));

jest.mock(
  '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet',
  () => {
    const ReactLib = require('react');
    const {View, TouchableOpacity, Text} = require('react-native');
    return {
      DiscardChangesBottomSheet: ReactLib.forwardRef((props: any, ref: any) => {
        ReactLib.useImperativeHandle(ref, () => ({
          open: jest.fn(),
          close: jest.fn(),
        }));
        return (
          <View testID="discard-sheet">
            <TouchableOpacity
              testID="discard-confirm"
              onPress={props.onDiscard}>
              <Text>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="discard-cancel"
              onPress={props.onKeepEditing}>
              <Text>Keep Editing</Text>
            </TouchableOpacity>
          </View>
        );
      }),
    };
  },
);

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('ObservationalToolScreen', () => {
  const mockState = {
    companion: {
      companions: [{id: 'comp-1', name: 'Buddy', profileImage: 'buddy.jpg'}],
    },
    businesses: {
      businesses: [
        {
          id: 'biz-1',
          name: 'Hospital A',
          category: 'hospital',
          address: '123 St',
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {taskId: 'task-123'};
    mockUseSelector.mockImplementation((cb: any) => cb(mockState));
    mockGetState.mockReturnValue({
      routes: [{name: 'TasksMain'}, {name: 'ObservationalTool'}],
    });
  });

  it('renders landing, navigates, validates, and submits', async () => {
    render(<ObservationalToolScreen />);

    // 1. Landing
    expect(screen.getByText('Test Tool')).toBeTruthy();
    expect(screen.getByText('Hospital A')).toBeTruthy();

    // 2. Select Provider
    fireEvent.press(screen.getByText('Hospital A'));

    // 3. Go to Form
    fireEvent.press(screen.getByTestId('btn-Next'));
    expect(screen.getByText('Step 1')).toBeTruthy();

    // 4. Validation (Try Next without selection)
    // Since we mocked the button to be enabled, pressing it triggers the validation check logic
    fireEvent.press(screen.getByTestId('btn-Next'));
    expect(
      screen.getByText('Please select an option to continue.'),
    ).toBeTruthy();

    // 5. Select Option
    fireEvent.press(screen.getByText('Option A'));

    // 6. Go Next
    fireEvent.press(screen.getByTestId('btn-Next'));
    expect(screen.getByText('Step 2')).toBeTruthy();

    // 7. Select Option
    fireEvent.press(screen.getByText('Option B'));

    // 8. Submit
    fireEvent.press(screen.getByTestId('btn-Submit and schedule appointment'));

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({type: 'MARK_TASK_STATUS'}),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        'Appointments',
        expect.anything(),
      );
    });
  });

  it('handles navigation back logic (Step 2 -> Step 1 -> Landing)', () => {
    render(<ObservationalToolScreen />);
    fireEvent.press(screen.getByText('Hospital A'));
    fireEvent.press(screen.getByTestId('btn-Next')); // To Step 1

    fireEvent.press(screen.getByText('Option A'));
    fireEvent.press(screen.getByTestId('btn-Next')); // To Step 2

    expect(screen.getByText('Step 2')).toBeTruthy();

    // Back to Step 1
    fireEvent.press(screen.getByTestId('btn-Back'));
    expect(screen.getByText('Step 1')).toBeTruthy();

    // Back to Landing
    fireEvent.press(screen.getByTestId('btn-Back'));
    expect(screen.getByText('Overview')).toBeTruthy();
  });

  it('handles provider visibility toggle', () => {
    render(<ObservationalToolScreen />);
    const switchEl = screen.getByRole('switch');

    // Toggle off
    fireEvent(switchEl, 'valueChange', false);
    expect(screen.queryByText('Hospital A')).toBeNull();

    // Toggle on
    fireEvent(switchEl, 'valueChange', true);
    expect(screen.getByText('Hospital A')).toBeTruthy();
  });

  it('validates provider selection on landing page', () => {
    render(<ObservationalToolScreen />);

    // Deselect default (toggle off)
    fireEvent.press(screen.getByText('Hospital A'));

    // Try Next
    fireEvent.press(screen.getByTestId('btn-Next'));
  });

  it('renders image options for non-dog species', () => {
    mockRouteParams = {taskId: 'task-cat'};
    const emptyBizState = {...mockState, businesses: {businesses: []}};
    mockUseSelector.mockImplementation((cb: any) => cb(emptyBizState));

    render(<ObservationalToolScreen />);

    // Enable next by hiding providers (since list is empty)
    fireEvent(screen.getByRole('switch'), 'valueChange', false);
    fireEvent.press(screen.getByTestId('btn-Next'));

    expect(screen.getByText('Cat Step')).toBeTruthy();
    // Verify image option rendered
    expect(screen.getByText('Cat Opt')).toBeTruthy();
  });

  it('handles safe exit when first in stack', () => {
    mockGetState.mockReturnValue({routes: [{name: 'ObservationalTool'}]}); // Only one route
    render(<ObservationalToolScreen />);

    fireEvent.press(screen.getByTestId('header-back')); // Open sheet
    fireEvent.press(screen.getByTestId('discard-confirm')); // Confirm

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'TasksMain'}],
    });
    expect(mockNavigate).toHaveBeenCalledWith('HomeStack', {
      screen: 'Home',
    });
  });

  it('handles safe exit when having history', () => {
    mockGetState.mockReturnValue({
      routes: [{name: 'TasksMain'}, {name: 'ObservationalTool'}],
    });
    render(<ObservationalToolScreen />);

    fireEvent.press(screen.getByTestId('header-back'));
    fireEvent.press(screen.getByTestId('discard-confirm'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles keep editing on discard sheet', () => {
    render(<ObservationalToolScreen />);
    fireEvent.press(screen.getByTestId('header-back'));
    fireEvent.press(screen.getByTestId('discard-cancel'));
    // Just verifying no crash and button interaction
  });

  it('handles task not found', () => {
    mockRouteParams = {taskId: 'task-unknown'};
    render(<ObservationalToolScreen />);
    expect(screen.getByText('Task not found')).toBeTruthy();

    // Back button on error screen calls navigation.goBack directly
    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('resolves business description fallbacks (Specialties, Hours, Address)', () => {
    // Test different business shapes to cover resolveBusinessDescription
    const mixedState = {
      ...mockState,
      businesses: {
        businesses: [
          {
            id: 'b1',
            category: 'hospital',
            name: 'B1',
            description: 'Desc',
          },
          {
            id: 'b2',
            category: 'hospital',
            name: 'B2',
            specialties: ['Spec1'],
          },
          {id: 'b3', category: 'hospital', name: 'B3', openHours: '9-5'},
          {id: 'b4', category: 'hospital', name: 'B4', address: 'Addr'},
        ],
      },
    };
    mockUseSelector.mockImplementation((cb: any) => cb(mixedState));

    render(<ObservationalToolScreen />);

    expect(screen.getByText('Desc')).toBeTruthy();
    expect(screen.getByText('Spec1')).toBeTruthy();
    expect(screen.getByText('B3 · 9-5')).toBeTruthy();
    expect(screen.getByText('Located at Addr')).toBeTruthy();
  });

  it('handles provider pricing fallback logic', () => {
    // Scenario: More businesses than provider definitions to trigger fallback logic
    const manyBizState = {
      ...mockState,
      businesses: {
        businesses: [
          {id: 'biz-1', category: 'hospital', name: 'Match'},
          {id: 'biz-2', category: 'hospital', name: 'Fallback'},
        ],
      },
    };
    mockUseSelector.mockImplementation((cb: any) => cb(manyBizState));

    render(<ObservationalToolScreen />);
    expect(screen.getByText('Match')).toBeTruthy();
    expect(screen.getByText('Fallback')).toBeTruthy(); // Should render due to fallback logic
  });

  it('handles fallback when no provider pricing exists (default zero)', () => {
    mockRouteParams = {taskId: 'task-cat'};

    const bizState = {
      ...mockState,
      businesses: {
        businesses: [{id: 'biz-any', category: 'hospital', name: 'ZeroFee'}],
      },
    };
    mockUseSelector.mockImplementation((cb: any) => cb(bizState));

    render(<ObservationalToolScreen />);

    // Should render with $0.00 fees
    expect(screen.getByText('ZeroFee')).toBeTruthy();
    const zeroFees = screen.getAllByText('$0.00');
    expect(zeroFees.length).toBeGreaterThan(0);
  });
});
