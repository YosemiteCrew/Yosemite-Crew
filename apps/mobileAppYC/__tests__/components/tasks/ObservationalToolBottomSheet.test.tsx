import React from 'react';
import {render, screen, fireEvent, act, waitFor} from '@testing-library/react-native';
// FIX 1: Update component import path
import {ObservationalToolBottomSheet} from '@/features/tasks/components/ObservationalToolBottomSheet/ObservationalToolBottomSheet';
// FIX 2: Update helper import path
// FIX 3: Update type import path
import type {ObservationalToolBottomSheetRef} from '@/features/tasks/components/ObservationalToolBottomSheet/ObservationalToolBottomSheet';
// FIX 4: Update shared component type import path
import type {
  GenericSelectBottomSheetRef,
  SelectItem,
} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: require('../../setup/mockTheme').mockTheme, isDark: false}),
  useAppDispatch: () => jest.fn(),
  useAppSelector: jest.fn(),
}));

// Mock auth and API dependencies
jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(() =>
    Promise.resolve({
      accessToken: 'mock-access-token',
      idToken: 'mock-id-token',
      userId: 'mock-user-id',
      expiresAt: Date.now() + 3600000,
      provider: 'amplify',
    }),
  ),
  isTokenExpired: jest.fn(() => false),
}));

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn((token: string) => ({
    Authorization: `Bearer ${token}`,
  })),
}));

// Mock the observation tool API
const mockObservationTools = [
  {
    id: 'feline-grimace-scale-id',
    name: 'Feline Grimace Scale',
    description: 'Pain assessment for cats',
    category: 'pain-assessment',
    fields: [],
    isActive: true,
  },
  {
    id: 'canine-acute-pain-scale-id',
    name: 'Canine Acute Pain Scale',
    description: 'Pain assessment for dogs',
    category: 'pain-assessment',
    fields: [],
    isActive: true,
  },
  {
    id: 'equine-grimace-scale-id',
    name: 'Equine Grimace Scale',
    description: 'Pain assessment for horses',
    category: 'pain-assessment',
    fields: [],
    isActive: true,
  },
];

jest.mock('@/features/observationalTools/services/observationToolService', () => ({
  observationToolApi: {
    list: jest.fn(() => Promise.resolve(mockObservationTools)),
    get: jest.fn(),
    submit: jest.fn(),
  },
}));

// FIX 5: Update mocked helper path
jest.mock('@/features/tasks/utils/taskLabels', () => ({
  resolveObservationalToolLabel: jest.fn((tool: string) => `Label for ${tool}`),
}));

const mockInternalSheetRef = {
  open: jest.fn(),
  close: jest.fn(),
};
let mockOnSaveCallback: (item: SelectItem | null) => void;

// FIX 6: Update mocked component path
jest.mock(
  '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet',
  () => {
    const ReactMock = require('react');
    const {View, Text, TouchableOpacity} = require('react-native');

    const MockGenericSheet: React.ForwardRefRenderFunction<
      GenericSelectBottomSheetRef,
      any
    > = (props: any, ref: any) => {
      mockOnSaveCallback = props.onSave;

      ReactMock.useImperativeHandle(ref, () => ({
        open: mockInternalSheetRef.open,
        close: mockInternalSheetRef.close,
      }));

      return (
        <View testID="mock-generic-sheet">
          <Text>Title: {props.title}</Text>
          <Text>Selected: {props.selectedItem?.id || 'null'}</Text>
          <Text>
            Items: {props.items.map((i: SelectItem) => i.label).join(', ')}
          </Text>
          <Text>HasSearch: {String(props.hasSearch)}</Text>
          <Text>Mode: {props.mode}</Text>
          <Text>EmptyMessage: {props.emptyMessage}</Text>

          <TouchableOpacity
            testID="simulate-save-feline"
            onPress={() =>
              mockOnSaveCallback({
                id: 'feline-grimace-scale-id',
                label: 'Feline Grimace Scale',
              })
            }
          />
          <TouchableOpacity
            testID="simulate-save-null"
            onPress={() => mockOnSaveCallback(null)}
          />
        </View>
      );
    };

    return {GenericSelectBottomSheet: ReactMock.forwardRef(MockGenericSheet)};
  },
);

const renderComponent = async (props: {
  selectedTool?: string | null;
  companionType: string;
}) => {
  const ref = React.createRef<ObservationalToolBottomSheetRef>();
  const innerMockOnSelect = jest.fn();

  render(
    <ObservationalToolBottomSheet
      ref={ref}
      selectedTool={props.selectedTool}
      companionType={props.companionType as 'cat' | 'dog' | 'horse'}
      onSelect={innerMockOnSelect}
    />,
  );

  // Wait for the API call to complete
  await waitFor(() => {
    expect(screen.getByTestId('mock-generic-sheet')).toBeTruthy();
  });
  return {ref, mockOnSelect: innerMockOnSelect};
};

describe('ObservationalToolBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders and passes correct static props to GenericSelectBottomSheet', async () => {
    await renderComponent({companionType: 'cat'});
    expect(screen.getByTestId('mock-generic-sheet')).toBeTruthy();
    expect(screen.getByText('Title: Select observational tool')).toBeTruthy();
    expect(screen.getByText('HasSearch: false')).toBeTruthy();
    expect(screen.getByText('Mode: select')).toBeTruthy();
    expect(
      screen.getByText(
        'EmptyMessage: No observational tools available for this companion',
      ),
    ).toBeTruthy();
  });

  it('filters items for "cat" companion type', async () => {
    await renderComponent({companionType: 'cat'});
    // The component now uses API data, so it should display the tool name from API
    expect(screen.getByText('Items: Feline Grimace Scale')).toBeTruthy();
  });

  it('filters items for "dog" companion type', async () => {
    await renderComponent({companionType: 'dog'});
    // The component now uses API data, so it should display the tool name from API
    expect(screen.getByText('Items: Canine Acute Pain Scale')).toBeTruthy();
  });

  it('filters items for "horse" companion type', async () => {
    await renderComponent({companionType: 'horse'});
    // The component now uses API data, so it should display the tool name from API
    expect(screen.getByText('Items: Equine Grimace Scale')).toBeTruthy();
  });

  it('returns an empty list if companionType is unknown', async () => {
    await renderComponent({companionType: 'lizard'});
    expect(screen.getByText('Items:')).toBeTruthy();
  });

  it('passes null as selectedItem when no tool is selected', async () => {
    await renderComponent({companionType: 'cat', selectedTool: null});
    expect(screen.getByText('Selected: null')).toBeTruthy();
  });

  it('passes the correct selectedItem when a tool is provided', async () => {
    await renderComponent({
      companionType: 'cat',
      selectedTool: 'feline-grimace-scale-id',
    });
    expect(screen.getByText('Selected: feline-grimace-scale-id')).toBeTruthy();
  });

  it('calls onSelect with the item id when handleSave is triggered', async () => {
    const {mockOnSelect} = await renderComponent({companionType: 'cat'});
    fireEvent.press(screen.getByTestId('simulate-save-feline'));
    expect(mockOnSelect).toHaveBeenCalledWith('feline-grimace-scale-id');
  });

  it('does not call onSelect when handleSave is triggered with null', async () => {
    const {mockOnSelect} = await renderComponent({companionType: 'cat'});
    fireEvent.press(screen.getByTestId('simulate-save-null'));
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('exposes and calls open method via ref', async () => {
    const {ref} = await renderComponent({companionType: 'cat'});
    act(() => {
      ref.current?.open();
    });
    expect(mockInternalSheetRef.open).toHaveBeenCalledTimes(1);
  });

  it('exposes and calls close method via ref', async () => {
    const {ref} = await renderComponent({companionType: 'cat'});
    act(() => {
      ref.current?.close();
    });
    expect(mockInternalSheetRef.close).toHaveBeenCalledTimes(1);
  });

  it('shows loading message initially before API data loads', async () => {
    // Create a delayed promise to simulate loading
    const delayedPromise = new Promise<typeof mockObservationTools>((resolve) => {
      setTimeout(() => resolve(mockObservationTools), 100);
    });

    const {observationToolApi} = require('@/features/observationalTools/services/observationToolService');
    observationToolApi.list.mockImplementationOnce(() => delayedPromise);

    const ref = React.createRef<ObservationalToolBottomSheetRef>();
    const innerMockOnSelect = jest.fn();

    render(
      <ObservationalToolBottomSheet
        ref={ref}
        selectedTool={null}
        companionType="cat"
        onSelect={innerMockOnSelect}
      />,
    );

    // Initially should show loading message
    expect(screen.getByText('EmptyMessage: Loading observational tools...')).toBeTruthy();

    // Wait for the API call to complete
    await act(async () => {
      await delayedPromise;
    });

    // After loading, should show the regular empty message
    await waitFor(() => {
      expect(screen.getByText('EmptyMessage: No observational tools available for this companion')).toBeTruthy();
    });
  });
});
