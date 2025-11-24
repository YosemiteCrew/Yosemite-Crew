import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Text, View} from 'react-native';
import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/shared/components/common/BottomSheet/BottomSheet';
import type {BottomSheetHandleProps} from '@gorhom/bottom-sheet';

// --- Mocks ---

// Mock functions for the internal BottomSheet ref
const mockSnapToIndex = jest.fn();
const mockSnapToPosition = jest.fn();
const mockExpand = jest.fn();
const mockCollapse = jest.fn();
const mockClose = jest.fn();
const mockForceClose = jest.fn();

// This is the main mock we'll use to spy on the props passed to BottomSheet
const mockBottomSheet = jest.fn();

// Mock the entire @gorhom/bottom-sheet library
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      const {View} = require('react-native');

      React.useImperativeHandle(ref, () => ({
        snapToIndex: mockSnapToIndex,
        snapToPosition: mockSnapToPosition,
        expand: mockExpand,
        collapse: mockCollapse,
        close: mockClose,
        forceClose: mockForceClose,
      }));

      mockBottomSheet(props);

      return (
        <View testID="mock-bottom-sheet">
          {props.handleComponent?.({})}
          {props.backdropComponent?.({})}
          {props.footerComponent?.({})}
          {props.children}
        </View>
      );
    }),
    BottomSheetView: (props: any) => {
      const {View} = require('react-native');
      return <View testID="mock-bottom-sheet-view" {...props} />;
    },
    BottomSheetScrollView: (props: any) => {
      const {View} = require('react-native');
      return <View testID="mock-bottom-sheet-scrollview" {...props} />;
    },
    BottomSheetFlatList: (props: any) => {
      const {View} = require('react-native');
      return <View testID="mock-bottom-sheet-flatlist" {...props} />;
    },
    BottomSheetBackdrop: (props: any) => {
      const {View} = require('react-native');
      return <View testID="mock-bottom-sheet-backdrop" {...props} />;
    },
    BottomSheetHandle: (props: any) => {
      const {View} = require('react-native');
      return <View testID="mock-bottom-sheet-handle" {...props} />;
    },
  };
});

// Mock console.warn to test the FlatList warning
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {cardBackground: 'white'},
      borderRadius: {base: 10},
      shadows: {medium: {}},
    },
  }),
}));

// --- Tests ---

describe('CustomBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  const renderItem = ({item}: {item: any}) => <Text>{item.name}</Text>;
  const keyExtractor = (item: any) => item.id;
  const flatListData = [{id: '1', name: 'Item 1'}];

  it('renders with default props and content type "view"', () => {
    const {getByTestId, getByText} = render(
      <CustomBottomSheet>
        <Text>Default Content</Text>
      </CustomBottomSheet>,
    );

    expect(getByTestId('mock-bottom-sheet-view')).toBeTruthy();
    expect(getByText('Default Content')).toBeTruthy();

    expect(mockBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 0,
        snapPoints: ['25%', '50%', '90%'],
        enablePanDownToClose: false,
        enableDynamicSizing: true,
        enableOverDrag: true,
        enableContentPanningGesture: true,
        enableHandlePanningGesture: true,
        backdropComponent: undefined,
      }),
    );
  });

  it('passes all custom props correctly to BottomSheet', () => {
    const mockOnChange = jest.fn();
    const mockOnAnimate = jest.fn();
    const snapPoints = ['50%'];
    const style = {backgroundColor: 'red'};
    const backgroundStyle = {backgroundColor: 'blue'};

    render(
      <CustomBottomSheet
        snapPoints={snapPoints}
        initialIndex={-1}
        enablePanDownToClose={true}
        enableDynamicSizing={false}
        enableOverDrag={false}
        enableContentPanningGesture={false}
        enableHandlePanningGesture={false}
        style={style}
        backgroundStyle={backgroundStyle}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        topInset={10}
        bottomInset={20}
        onChange={mockOnChange}
        onAnimate={mockOnAnimate}>
        <Text>Children</Text>
      </CustomBottomSheet>,
    );

    expect(mockBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        index: -1,
        snapPoints: snapPoints,
        enablePanDownToClose: true,
        enableDynamicSizing: false,
        enableOverDrag: false,
        enableContentPanningGesture: false,
        enableHandlePanningGesture: false,
        // FIX: Expect the style to be merged (array containing original style)
        style: expect.arrayContaining([style]),
        backgroundStyle: backgroundStyle,
      }),
    );
  });

  it('renders content type "scrollView"', () => {
    const {getByTestId, queryByTestId, getByText} = render(
      <CustomBottomSheet contentType="scrollView">
        <Text>Scroll Content</Text>
      </CustomBottomSheet>,
    );

    expect(getByTestId('mock-bottom-sheet-scrollview')).toBeTruthy();
    expect(getByText('Scroll Content')).toBeTruthy();
    expect(queryByTestId('mock-bottom-sheet-view')).toBeNull();
  });

  it('renders content type "flatList" with required props', () => {
    const {getByTestId, queryByTestId, queryByText} = render(
      <CustomBottomSheet
        contentType="flatList"
        flatListData={flatListData}
        flatListRenderItem={renderItem}
        flatListKeyExtractor={keyExtractor}>
        <Text>This child should not be rendered</Text>
      </CustomBottomSheet>,
    );

    const flatList = getByTestId('mock-bottom-sheet-flatlist');
    expect(flatList).toBeTruthy();
    expect(flatList.props.data).toBe(flatListData);
    expect(flatList.props.renderItem).toBe(renderItem);
    expect(flatList.props.keyExtractor).toBe(keyExtractor);
    expect(queryByTestId('mock-bottom-sheet-view')).toBeNull();
    expect(queryByText('This child should not be rendered')).toBeNull();
  });

  it('uses default keyExtractor for flatList if not provided', () => {
    const {getByTestId} = render(
      <CustomBottomSheet
        contentType="flatList"
        flatListData={flatListData}
        flatListRenderItem={renderItem}>
        <Text>Test</Text>
      </CustomBottomSheet>,
    );

    const flatList = getByTestId('mock-bottom-sheet-flatlist');
    expect(flatList.props.keyExtractor(null, 1)).toBe('1');
  });

  it('renders flatlist even if flatList data is missing (uses default)', () => {
    const {getByTestId, queryByTestId, queryByText} = render(
      <CustomBottomSheet contentType="flatList" flatListRenderItem={renderItem}>
        <Text>Fallback Content</Text>
      </CustomBottomSheet>,
    );

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(getByTestId('mock-bottom-sheet-flatlist')).toBeTruthy();
    expect(queryByText('Fallback Content')).toBeNull();
    expect(queryByTestId('mock-bottom-sheet-view')).toBeNull();
  });

  it('warns and falls back to "view" if flatList renderItem is missing', () => {
    const {getByTestId, getByText, queryByTestId} = render(
      <CustomBottomSheet contentType="flatList" flatListData={flatListData}>
        <Text>Fallback Content</Text>
      </CustomBottomSheet>,
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'FlatList requires data and renderItem props',
    );
    expect(getByTestId('mock-bottom-sheet-view')).toBeTruthy();
    expect(getByText('Fallback Content')).toBeTruthy();
    expect(queryByTestId('mock-bottom-sheet-flatlist')).toBeNull();
  });

  it('renders default handle with custom styles', () => {
    const handleStyle = {backgroundColor: 'green'};
    const handleIndicatorStyle = {backgroundColor: 'yellow'};

    const {getByTestId} = render(
      <CustomBottomSheet
        handleStyle={handleStyle}
        handleIndicatorStyle={handleIndicatorStyle}>
        <Text>Test</Text>
      </CustomBottomSheet>,
    );

    const handle = getByTestId('mock-bottom-sheet-handle');
    expect(handle).toBeTruthy();
    expect(handle.props.style).toBe(handleStyle);
    expect(handle.props.indicatorStyle).toBe(handleIndicatorStyle);
  });

  it('renders custom handle when provided', () => {
    const CustomHandleComponent = (props: BottomSheetHandleProps) => (
      <View testID="custom-handle" {...props} />
    );

    const {getByTestId, queryByTestId} = render(
      <CustomBottomSheet
        customHandle={true}
        handleComponent={CustomHandleComponent}>
        <Text>Test</Text>
      </CustomBottomSheet>,
    );

    expect(getByTestId('custom-handle')).toBeTruthy();
    expect(queryByTestId('mock-bottom-sheet-handle')).toBeNull();
  });

  it('does not render custom handle if customHandle is false', () => {
    const CustomHandleComponent = (props: BottomSheetHandleProps) => (
      <View testID="custom-handle" {...props} />
    );

    const {getByTestId, queryByTestId} = render(
      <CustomBottomSheet
        customHandle={false}
        handleComponent={CustomHandleComponent}>
        <Text>Test</Text>
      </CustomBottomSheet>,
    );

    expect(queryByTestId('custom-handle')).toBeNull();
    expect(getByTestId('mock-bottom-sheet-handle')).toBeTruthy();
  });

  it('renders backdrop when enabled and calls onBackdropPress', () => {
    const mockOnBackdropPress = jest.fn();
    const {getByTestId} = render(
      <CustomBottomSheet
        enableBackdrop={true}
        backdropOpacity={0.7}
        backdropAppearsOnIndex={0}
        backdropDisappearsOnIndex={-1}
        backdropPressBehavior="collapse"
        onBackdropPress={mockOnBackdropPress}>
        <Text>Test</Text>
      </CustomBottomSheet>,
    );

    const backdrop = getByTestId('mock-bottom-sheet-backdrop');
    expect(backdrop).toBeTruthy();
    expect(backdrop.props.opacity).toBe(0.7);
    expect(backdrop.props.appearsOnIndex).toBe(0);
    expect(backdrop.props.disappearsOnIndex).toBe(-1);
    expect(backdrop.props.pressBehavior).toBe('collapse');

    // Simulate press
    fireEvent.press(backdrop);
    expect(mockOnBackdropPress).toHaveBeenCalledTimes(1);
  });

  it('does not render backdrop when disabled', () => {
    const {queryByTestId} = render(
      <CustomBottomSheet enableBackdrop={false}>
        <Text>Test</Text>
      </CustomBottomSheet>,
    );
    expect(queryByTestId('mock-bottom-sheet-backdrop')).toBeNull();
  });

  it('exposes ref methods correctly', () => {
    const ref = React.createRef<BottomSheetRef>();
    render(
      <CustomBottomSheet ref={ref}>
        <Text>Test</Text>
      </CustomBottomSheet>,
    );

    const animConfig = {duration: 500};

    ref.current?.snapToIndex(1, animConfig);
    expect(mockSnapToIndex).toHaveBeenCalledWith(1, animConfig);

    ref.current?.snapToPosition('50%', animConfig);
    expect(mockSnapToPosition).toHaveBeenCalledWith('50%', animConfig);

    ref.current?.expand(animConfig);
    expect(mockExpand).toHaveBeenCalledWith(animConfig);

    ref.current?.collapse(animConfig);
    expect(mockCollapse).toHaveBeenCalledWith(animConfig);

    ref.current?.close(animConfig);
    expect(mockClose).toHaveBeenCalledWith(animConfig);

    ref.current?.forceClose(animConfig);
    expect(mockForceClose).toHaveBeenCalledWith(animConfig);
  });
});
