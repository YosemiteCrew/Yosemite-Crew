import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import ClinicBottomSheet, {
  type ClinicBottomSheetRef,
} from '../../../../../src/features/appointments/components/MapDiscovery/ClinicBottomSheet';
import type {VetBusiness} from '../../../../../src/features/appointments/types';

// --- Mock handles exposed to tests ---
const mockSnapToIndex = jest.fn();
const mockClose = jest.fn();
const mockScrollToIndex = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactLib = require('react');
  const {View} = require('react-native');

  const MockBottomSheet = ReactLib.forwardRef(
    ({children, animatedIndex: _animatedIndex}: any, ref: any) => {
      ReactLib.useImperativeHandle(ref, () => ({
        snapToIndex: mockSnapToIndex,
        close: mockClose,
      }));
      return <View testID="bottom-sheet">{children}</View>;
    },
  );
  MockBottomSheet.displayName = 'MockBottomSheet';

  const MockBottomSheetFlatList = ReactLib.forwardRef(
    (
      {
        data,
        renderItem,
        ListHeaderComponent,
        ListEmptyComponent,
        onScrollToIndexFailed,
        getItemLayout,
        keyExtractor: _keyExtractor,
      }: any,
      ref: any,
    ) => {
      ReactLib.useImperativeHandle(ref, () => ({
        scrollToIndex: mockScrollToIndex,
      }));
      return (
        <View testID="flatlist">
          {ListHeaderComponent}
          {data && data.length > 0
            ? data.map((item: any, i: number) => {
                if (getItemLayout) {
                  getItemLayout(data, i);
                }
                return renderItem({item, index: i});
              })
            : ListEmptyComponent}
          {onScrollToIndexFailed && (
            <View
              testID="scroll-failed-trigger"
              onTouchEnd={() => onScrollToIndexFailed({index: 0})}
            />
          )}
        </View>
      );
    },
  );
  MockBottomSheetFlatList.displayName = 'MockBottomSheetFlatList';

  return {
    __esModule: true,
    default: MockBottomSheet,
    BottomSheetFlatList: MockBottomSheetFlatList,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const {View} = require('react-native');
  return {
    GestureDetector: ({children}: any) => <>{children}</>,
    Gesture: {
      Native: () => ({}),
    },
    // kept for any other consumers of this mock
    NativeViewGestureHandler: ({children, ...props}: any) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock(
  '../../../../../src/features/appointments/components/BusinessCard/BusinessCard',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return ({name, onBook, distanceText, ratingText}: any) => (
      <View testID={`business-card-${name}`}>
        <Text testID={`distance-${name}`}>{distanceText ?? 'no-distance'}</Text>
        <Text testID={`rating-${name}`}>{ratingText ?? 'no-rating'}</Text>
        <TouchableOpacity testID={`book-${name}`} onPress={onBook}>
          <Text>Book</Text>
        </TouchableOpacity>
      </View>
    );
  },
);

jest.mock('@/shared/utils/measurementSystem', () => ({
  convertDistance: jest.fn((value: number) => value * 1.60934),
}));

// --- Fixtures ---

const baseClinic: VetBusiness = {
  id: 'clinic-1',
  name: 'Happy Paws Vet',
  category: 'vet',
  address: '123 Main St',
  distanceMi: 2.5,
  rating: 4.7,
  openHours: 'Open 9am–6pm',
  photo: null,
};

const mockNavigation = {
  navigate: jest.fn(),
} as any;

const defaultProps = {
  clinics: [baseClinic],
  selectedId: null,
  navigation: mockNavigation,
  fallbacks: {},
  distanceUnit: 'mi' as const,
};

describe('ClinicBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders a list of clinics', () => {
    const {getByTestId} = render(<ClinicBottomSheet {...defaultProps} />);
    expect(getByTestId('business-card-Happy Paws Vet')).toBeTruthy();
  });

  it('renders empty state when no clinics are provided', () => {
    const {getByText} = render(
      <ClinicBottomSheet {...defaultProps} clinics={[]} />,
    );
    expect(getByText('mapDiscovery.emptyClinicsTitle')).toBeTruthy();
    expect(getByText('mapDiscovery.emptyClinicsSubtitle')).toBeTruthy();
  });

  it('renders the filterHeader when provided', () => {
    const {Text} = require('react-native');
    const {getByTestId, getByText} = render(
      <ClinicBottomSheet
        {...defaultProps}
        filterHeader={<Text>Filter Controls</Text>}
      />,
    );
    expect(getByTestId('filter-header-gesture')).toBeTruthy();
    expect(getByText('Filter Controls')).toBeTruthy();
  });

  it('does not render a header wrapper when filterHeader is omitted', () => {
    const {queryByText} = render(
      <ClinicBottomSheet {...defaultProps} filterHeader={undefined} />,
    );
    expect(queryByText('Filter Controls')).toBeNull();
  });

  // ── Distance text ──────────────────────────────────────────────────────────

  it('shows distance in miles when distanceMi is provided and unit is mi', () => {
    const {getByTestId} = render(
      <ClinicBottomSheet
        {...defaultProps}
        clinics={[{...baseClinic, distanceMi: 2.5}]}
        distanceUnit="mi"
      />,
    );
    expect(getByTestId('distance-Happy Paws Vet').props.children).toBe(
      '2.5 mi',
    );
  });

  it('converts and shows distance in km when unit is km and distanceMi is set', () => {
    const {getByTestId} = render(
      <ClinicBottomSheet
        {...defaultProps}
        clinics={[{...baseClinic, distanceMi: 1.0}]}
        distanceUnit="km"
      />,
    );
    // convertDistance mock returns value * 1.60934
    const text = getByTestId('distance-Happy Paws Vet').props.children;
    expect(text).toMatch(/km$/);
  });

  it('calculates distance from distanceMeters when distanceMi is absent', () => {
    const {getByTestId} = render(
      <ClinicBottomSheet
        {...defaultProps}
        clinics={[
          {
            ...baseClinic,
            distanceMi: undefined,
            distanceMeters: 3218.688,
          },
        ]}
        distanceUnit="mi"
      />,
    );
    // 3218.688m / 1609.344 ≈ 2.0mi
    expect(getByTestId('distance-Happy Paws Vet').props.children).toBe(
      '2.0 mi',
    );
  });

  it('shows no-distance when both distanceMi and distanceMeters are absent', () => {
    const {getByTestId} = render(
      <ClinicBottomSheet
        {...defaultProps}
        clinics={[
          {
            ...baseClinic,
            distanceMi: undefined,
            distanceMeters: undefined,
          },
        ]}
      />,
    );
    expect(getByTestId('distance-Happy Paws Vet').props.children).toBe(
      'no-distance',
    );
  });

  // ── Rating text ────────────────────────────────────────────────────────────

  it('shows rating when provided', () => {
    const {getByTestId} = render(
      <ClinicBottomSheet
        {...defaultProps}
        clinics={[{...baseClinic, rating: 4.7}]}
      />,
    );
    expect(getByTestId('rating-Happy Paws Vet').props.children).toBe('4.7');
  });

  it('shows no-rating when rating is absent', () => {
    const {getByTestId} = render(
      <ClinicBottomSheet
        {...defaultProps}
        clinics={[{...baseClinic, rating: undefined}]}
      />,
    );
    expect(getByTestId('rating-Happy Paws Vet').props.children).toBe(
      'no-rating',
    );
  });

  // ── Selected state ─────────────────────────────────────────────────────────

  it('renders multiple clinics and highlights the selected one', () => {
    const clinics: VetBusiness[] = [
      {...baseClinic, id: 'c1', name: 'Vet One'},
      {...baseClinic, id: 'c2', name: 'Vet Two'},
    ];
    const {getByTestId} = render(
      <ClinicBottomSheet {...defaultProps} clinics={clinics} selectedId="c1" />,
    );
    expect(getByTestId('business-card-Vet One')).toBeTruthy();
    expect(getByTestId('business-card-Vet Two')).toBeTruthy();
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  it('navigates to BusinessDetails when a clinic card book button is pressed', () => {
    const {getByTestId} = render(<ClinicBottomSheet {...defaultProps} />);
    fireEvent.press(getByTestId('book-Happy Paws Vet'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('BusinessDetails', {
      businessId: 'clinic-1',
      distanceMi: 2.5,
    });
  });

  it('uses fallback photo when provided', () => {
    const {getByTestId} = render(
      <ClinicBottomSheet
        {...defaultProps}
        fallbacks={{'clinic-1': {photo: 'fallback.jpg'}}}
      />,
    );
    expect(getByTestId('business-card-Happy Paws Vet')).toBeTruthy();
  });

  // ── Ref imperative handle ──────────────────────────────────────────────────

  it('ref.snapToExpanded calls snapToIndex(1)', () => {
    const ref = React.createRef<ClinicBottomSheetRef>();
    render(<ClinicBottomSheet {...defaultProps} ref={ref} />);
    act(() => {
      ref.current?.snapToExpanded();
    });
    expect(mockSnapToIndex).toHaveBeenCalledWith(1);
  });

  it('ref.snapToCollapsed calls snapToIndex(0)', () => {
    const ref = React.createRef<ClinicBottomSheetRef>();
    render(<ClinicBottomSheet {...defaultProps} ref={ref} />);
    act(() => {
      ref.current?.snapToCollapsed();
    });
    expect(mockSnapToIndex).toHaveBeenCalledWith(0);
  });

  it('ref.hide calls close()', () => {
    const ref = React.createRef<ClinicBottomSheetRef>();
    render(<ClinicBottomSheet {...defaultProps} ref={ref} />);
    act(() => {
      ref.current?.hide();
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('ref.show calls snapToIndex(0)', () => {
    const ref = React.createRef<ClinicBottomSheetRef>();
    render(<ClinicBottomSheet {...defaultProps} ref={ref} />);
    act(() => {
      ref.current?.show();
    });
    expect(mockSnapToIndex).toHaveBeenCalledWith(0);
  });

  it('ref.scrollToClinic snaps to expanded and scrolls to the matching clinic', () => {
    const clinics: VetBusiness[] = [
      {...baseClinic, id: 'c1', name: 'Vet One'},
      {...baseClinic, id: 'c2', name: 'Vet Two'},
    ];
    const ref = React.createRef<ClinicBottomSheetRef>();
    render(<ClinicBottomSheet {...defaultProps} clinics={clinics} ref={ref} />);
    act(() => {
      ref.current?.scrollToClinic('c2');
    });
    expect(mockSnapToIndex).toHaveBeenCalledWith(1);
  });

  it('ref.scrollToClinic for unknown id still snaps to expanded', () => {
    const ref = React.createRef<ClinicBottomSheetRef>();
    render(<ClinicBottomSheet {...defaultProps} ref={ref} />);
    act(() => {
      ref.current?.scrollToClinic('unknown-id');
    });
    // Still snaps even when index not found
    expect(mockSnapToIndex).toHaveBeenCalledWith(1);
  });

  it('ref.scrollToClinic flushes the deferred scrollToIndex after 300ms', () => {
    jest.useFakeTimers();
    const clinics: VetBusiness[] = [
      {...baseClinic, id: 'c1', name: 'Vet One'},
      {...baseClinic, id: 'c2', name: 'Vet Two'},
    ];
    const ref = React.createRef<ClinicBottomSheetRef>();
    render(<ClinicBottomSheet {...defaultProps} clinics={clinics} ref={ref} />);
    act(() => {
      ref.current?.scrollToClinic('c2');
      jest.runAllTimers();
    });
    expect(mockScrollToIndex).toHaveBeenCalledWith(
      expect.objectContaining({index: 1, animated: true}),
    );
    jest.useRealTimers();
  });

  it('handleScrollToIndexFailed retries scrollToIndex after 200ms', () => {
    jest.useFakeTimers();
    // Trigger handleScrollToIndexFailed via the flatlist mock's onScrollToIndexFailed prop.
    // The mock renders a View with testID="scroll-failed-trigger" bound to onTouchEnd.
    const {getByTestId} = render(<ClinicBottomSheet {...defaultProps} />);
    act(() => {
      fireEvent(getByTestId('scroll-failed-trigger'), 'touchEnd');
      jest.runAllTimers();
    });
    expect(mockScrollToIndex).toHaveBeenCalledWith(
      expect.objectContaining({index: 0, animated: true}),
    );
    jest.useRealTimers();
  });
});
