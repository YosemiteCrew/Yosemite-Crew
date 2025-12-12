import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  EmergencyBottomSheet,
  EmergencyBottomSheetRef,
} from '../../../../src/features/home/components/EmergencyBottomSheet';
import {useSelector} from 'react-redux';
import {TouchableOpacity} from 'react-native';

// --- Mocks ---

// 1. Mock Hooks
const mockTheme = {
  colors: {
    background: 'white',
    secondary: 'black',
    textSecondary: 'gray',
    borderMuted: 'lightgray',
    cardBackground: 'white',
    black: 'black',
    text: 'black',
  },
  spacing: {2: 8, 3: 12, 4: 16, 5: 20, 8: 32, 16: 64},
  borderRadius: {lg: 12},
  typography: {
    h4Alt: {fontSize: 24},
    subtitleRegular14: {fontSize: 14},
    h6Clash: {fontSize: 18},
    tabLabel: {fontSize: 12},
  },
};

jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme}),
}));

// 2. Mock Redux
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

const mockSelectLinkedHospitalsForCompanion = jest.fn();
jest.mock('../../../../src/features/linkedBusinesses', () => ({
  selectLinkedHospitalsForCompanion: (state: any, id: any) =>
    mockSelectLinkedHospitalsForCompanion(state, id),
}));

// 3. Mock Assets
jest.mock('../../../../src/assets/images', () => ({
  Images: {
    medicalCap: {uri: 'medical-cap'},
    pill: {uri: 'pill'},
    catEmergency: {uri: 'cat-emergency'},
    crossIcon: {uri: 'cross'},
  },
}));

// 4. Mock Child Components
const mockSnapToIndex = jest.fn();
const mockClose = jest.fn();

jest.mock(
  '../../../../src/shared/components/common/BottomSheet/BottomSheet',
  () => {
    const {forwardRef, useImperativeHandle} = require('react');
    const {View} = require('react-native');

    return forwardRef(({children, onChange}: any, ref: any) => {
      useImperativeHandle(ref, () => ({
        snapToIndex: mockSnapToIndex,
        close: () => {
          mockClose();
          if (onChange) onChange(-1);
        },
      }));
      return <View testID="custom-bottom-sheet">{children}</View>;
    });
  },
);

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassCard/LiquidGlassCard',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassCard: ({children, style}: any) => (
        <View testID="glass-card" style={style}>
          {children}
        </View>
      ),
    };
  },
);

describe('EmergencyBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSelector as unknown as jest.Mock).mockImplementation(cb => cb({}));
  });

  // ===========================================================================
  // 1. Rendering States
  // ===========================================================================

  it('renders empty state when no linked hospitals exist', () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([]);

    const ref = React.createRef<EmergencyBottomSheetRef>();
    const {getByText, queryByText} = render(
      <EmergencyBottomSheet ref={ref} companionId="c1" />,
    );

    act(() => {
      ref.current?.open();
    });

    expect(
      getByText('Please link a hospital to use this feature.'),
    ).toBeTruthy();
    expect(queryByText('Is this an emergency?')).toBeNull();
  });

  it('renders options when linked hospitals exist', () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([
      {id: 'h1', name: 'Vet Clinic'},
    ]);

    const ref = React.createRef<EmergencyBottomSheetRef>();
    const {getByText} = render(
      <EmergencyBottomSheet ref={ref} companionId="c1" />,
    );

    act(() => {
      ref.current?.open();
    });

    expect(getByText('Is this an emergency?')).toBeTruthy();
    expect(getByText('Call vet/ Practice')).toBeTruthy();
    expect(getByText('Adverse event\nreporting')).toBeTruthy();
  });

  it('handles null companionId gracefully', () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([]);
    const ref = React.createRef<EmergencyBottomSheetRef>();
    render(<EmergencyBottomSheet ref={ref} companionId={null} />);

    expect(mockSelectLinkedHospitalsForCompanion).toHaveBeenCalledWith(
      expect.anything(),
      null,
    );
  });

  // ===========================================================================
  // 2. Ref Interaction & State
  // ===========================================================================

  it('opens via ref', () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([]);
    const ref = React.createRef<EmergencyBottomSheetRef>();
    render(<EmergencyBottomSheet ref={ref} companionId="c1" />);

    act(() => {
      ref.current?.open();
    });
    expect(mockSnapToIndex).toHaveBeenCalledWith(0);
  });

  it('closes via ref', () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([]);
    const ref = React.createRef<EmergencyBottomSheetRef>();
    render(<EmergencyBottomSheet ref={ref} companionId="c1" />);

    act(() => {
      ref.current?.close();
    });
    expect(mockClose).toHaveBeenCalled();
  });

  // ===========================================================================
  // 3. User Interactions
  // ===========================================================================

  it('closes when the close icon is pressed', () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([]);
    const ref = React.createRef<EmergencyBottomSheetRef>();

    // Using UNSAFE_getAllByType as a reliable escape hatch for finding Touchables without testIDs
    const {UNSAFE_getAllByType} = render(
      <EmergencyBottomSheet ref={ref} companionId="c1" />,
    );

    const touchables = UNSAFE_getAllByType(TouchableOpacity);

    // The close button is rendered first in the view hierarchy (z-index 10)
    if (touchables.length > 0) {
      fireEvent.press(touchables[0]);
    }

    expect(mockClose).toHaveBeenCalled();
  });

  it('calls onCallVet when option is pressed', async () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([{id: 'h1'}]);
    const onCallVet = jest.fn();
    const ref = React.createRef<EmergencyBottomSheetRef>();

    const {getByText} = render(
      <EmergencyBottomSheet ref={ref} companionId="c1" onCallVet={onCallVet} />,
    );

    act(() => {
      ref.current?.open();
    });

    await act(async () => {
      fireEvent.press(getByText('Call vet/ Practice'));
    });

    expect(onCallVet).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('calls onAdverseEvent when option is pressed', async () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([{id: 'h1'}]);
    const onAdverseEvent = jest.fn();
    const ref = React.createRef<EmergencyBottomSheetRef>();

    const {getByText} = render(
      <EmergencyBottomSheet
        ref={ref}
        companionId="c1"
        onAdverseEvent={onAdverseEvent}
      />,
    );

    act(() => {
      ref.current?.open();
    });

    await act(async () => {
      fireEvent.press(getByText('Adverse event\nreporting'));
    });

    expect(onAdverseEvent).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  // ===========================================================================
  // 4. Edge Cases
  // ===========================================================================

  it('does nothing if callbacks are undefined', async () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([{id: 'h1'}]);
    const ref = React.createRef<EmergencyBottomSheetRef>();

    const {getByText} = render(
      <EmergencyBottomSheet ref={ref} companionId="c1" />,
    );

    act(() => {
      ref.current?.open();
    });

    // Press Call Vet - should just close
    await act(async () => {
      fireEvent.press(getByText('Call vet/ Practice'));
    });
    expect(mockClose).toHaveBeenCalled();

    // Reset mock
    mockClose.mockClear();

    // Press Adverse Event - should just close
    await act(async () => {
      fireEvent.press(getByText('Adverse event\nreporting'));
    });
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders notes correctly', () => {
    mockSelectLinkedHospitalsForCompanion.mockReturnValue([{id: 'h1'}]);
    const ref = React.createRef<EmergencyBottomSheetRef>();
    const {getByText} = render(
      <EmergencyBottomSheet ref={ref} companionId="c1" />,
    );

    expect(
      getByText(
        'Note: To use this feature, your hospital contact details should be added already.',
      ),
    ).toBeTruthy();
  });
});
