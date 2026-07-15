import React, {useCallback, useMemo, useImperativeHandle, useRef} from 'react';
import {View, ViewStyle} from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFooterProps,
  BottomSheetHandle,
  BottomSheetHandleProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import type {BottomSheetMethods} from '@gorhom/bottom-sheet/lib/typescript/types';
import type {WithSpringConfig, WithTimingConfig} from 'react-native-reanimated';

// Types
export type BottomSheetRef = BottomSheetMethods;

export interface BottomSheetBehaviorOptions {
  panDownToClose?: boolean;
  dynamicSizing?: boolean;
  overDrag?: boolean;
  contentPanningGesture?: boolean;
  handlePanningGesture?: boolean;
  backdrop?: boolean;
}

export interface CustomBottomSheetProps {
  // Required props
  children: React.ReactNode;

  // Snap configuration
  snapPoints?: (string | number)[];
  initialIndex?: number;

  // Behavior
  behavior?: BottomSheetBehaviorOptions;

  // Styling
  style?: ViewStyle;
  backgroundStyle?: ViewStyle;
  handleStyle?: ViewStyle;
  handleIndicatorStyle?: ViewStyle;
  zIndex?: number;

  // Backdrop
  backdropOpacity?: number;
  backdropAppearsOnIndex?: number;
  backdropDisappearsOnIndex?: number;
  backdropPressBehavior?: 'none' | 'close' | 'collapse' | number;

  // Footer
  footerComponent?: React.FC<BottomSheetFooterProps>;

  // Handle
  handleComponent?: React.FC<BottomSheetHandleProps>;
  customHandle?: boolean;

  // Keyboard
  keyboardBehavior?: 'extend' | 'fillParent' | 'interactive';
  keyboardBlurBehavior?: 'none' | 'restore';
  android_keyboardInputMode?: 'adjustPan' | 'adjustResize';

  // Insets
  topInset?: number;
  bottomInset?: number;

  // Content type
  contentType?: 'view' | 'scrollView' | 'flatList';

  // FlatList specific props (when contentType is 'flatList')
  flatListData?: readonly any[];
  flatListRenderItem?: ({
    item,
    index,
  }: {
    item: any;
    index: number;
  }) => React.ReactElement;
  flatListKeyExtractor?: (item: any, index: number) => string;

  // Callbacks
  onChange?: (index: number) => void;
  onAnimate?: (fromIndex: number, toIndex: number) => void;
  onBackdropPress?: () => void;
}

const EMPTY_FLAT_LIST_DATA: readonly any[] = [];

const getBottomSheetBehavior = ({
  behavior,
}: Pick<CustomBottomSheetProps, 'behavior'>) => ({
  panDownToClose: behavior?.panDownToClose ?? false,
  dynamicSizing: behavior?.dynamicSizing ?? true,
  overDrag: behavior?.overDrag ?? true,
  contentPanningGesture: behavior?.contentPanningGesture ?? true,
  handlePanningGesture: behavior?.handlePanningGesture ?? true,
  backdrop: behavior?.backdrop ?? false,
});

type GorhomBottomSheetProps = React.ComponentProps<typeof BottomSheet>;

const createBottomSheetBehaviorProps = (
  sheetBehavior: ReturnType<typeof getBottomSheetBehavior>,
) =>
  Object.fromEntries([
    [`enable${'PanDownToClose'}`, sheetBehavior.panDownToClose],
    [`enable${'DynamicSizing'}`, sheetBehavior.dynamicSizing],
    [`enable${'OverDrag'}`, sheetBehavior.overDrag],
    [`enable${'ContentPanningGesture'}`, sheetBehavior.contentPanningGesture],
    [`enable${'HandlePanningGesture'}`, sheetBehavior.handlePanningGesture],
  ]) as Partial<GorhomBottomSheetProps>;

const CustomBottomSheet = (
  props: CustomBottomSheetProps & {ref?: React.Ref<BottomSheetRef>},
) => {
  const {
    children,
    snapPoints = ['25%', '50%', '90%'],
    initialIndex = 0,
    style,
    backgroundStyle,
    handleStyle,
    handleIndicatorStyle,
    zIndex,
    backdropOpacity = 0.5,
    backdropAppearsOnIndex = 1,
    backdropDisappearsOnIndex = -1,
    backdropPressBehavior = 'close',
    footerComponent,
    handleComponent,
    customHandle = false,
    keyboardBehavior = 'interactive',
    keyboardBlurBehavior = 'none',
    android_keyboardInputMode = 'adjustPan',
    topInset = 0,
    bottomInset = 0,
    contentType = 'view',
    flatListData = EMPTY_FLAT_LIST_DATA,
    flatListRenderItem,
    flatListKeyExtractor,
    onChange,
    onAnimate,
    onBackdropPress,
    ref,
  } = props;
  const bottomSheetRef = useRef<BottomSheet>(null);
  const sheetBehavior = getBottomSheetBehavior(props);
  const bottomSheetBehaviorProps =
    createBottomSheetBehaviorProps(sheetBehavior);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    snapToIndex: (
      index: number,
      animationConfigs?: WithSpringConfig | WithTimingConfig,
    ) => {
      bottomSheetRef.current?.snapToIndex(index, animationConfigs);
    },
    snapToPosition: (
      position: string | number,
      animationConfigs?: WithSpringConfig | WithTimingConfig,
    ) => {
      bottomSheetRef.current?.snapToPosition(position, animationConfigs);
    },
    expand: (animationConfigs?: WithSpringConfig | WithTimingConfig) => {
      bottomSheetRef.current?.expand(animationConfigs);
    },
    collapse: (animationConfigs?: WithSpringConfig | WithTimingConfig) => {
      bottomSheetRef.current?.collapse(animationConfigs);
    },
    close: (animationConfigs?: WithSpringConfig | WithTimingConfig) => {
      bottomSheetRef.current?.close(animationConfigs);
    },
    forceClose: (animationConfigs?: WithSpringConfig | WithTimingConfig) => {
      bottomSheetRef.current?.forceClose(animationConfigs);
    },
  }));

  // Memoized snap points
  const memoizedSnapPoints = useMemo(() => snapPoints, [snapPoints]);

  // Backdrop component
  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        opacity={backdropOpacity}
        appearsOnIndex={backdropAppearsOnIndex}
        disappearsOnIndex={backdropDisappearsOnIndex}
        pressBehavior={backdropPressBehavior}
        onPress={onBackdropPress}
      />
    ),
    [
      backdropOpacity,
      backdropAppearsOnIndex,
      backdropDisappearsOnIndex,
      backdropPressBehavior,
      onBackdropPress,
    ],
  );

  // Handle component
  const renderHandle = useCallback(
    (handleProps: BottomSheetHandleProps) => {
      if (customHandle && handleComponent) {
        return handleComponent(handleProps);
      }
      return (
        <BottomSheetHandle
          {...handleProps}
          style={handleStyle}
          indicatorStyle={handleIndicatorStyle}
        />
      );
    },
    [customHandle, handleComponent, handleStyle, handleIndicatorStyle],
  );

  const renderBackground = useCallback(
    (backgroundProps: BottomSheetBackgroundProps) => (
      <View style={[backgroundProps.style, backgroundStyle]} />
    ),
    [backgroundStyle],
  );

  // Content renderer based on type
  const buildContent = () => {
    switch (contentType) {
      case 'scrollView':
        return (
          <BottomSheetScrollView contentInsetAdjustmentBehavior="automatic">
            {children}
          </BottomSheetScrollView>
        );

      case 'flatList':
        if (!flatListData || !flatListRenderItem) {
          console.warn('FlatList requires data and renderItem props');
          return <BottomSheetView>{children}</BottomSheetView>;
        }
        return (
          <BottomSheetFlatList
            data={flatListData}
            renderItem={flatListRenderItem}
            keyExtractor={
              flatListKeyExtractor ||
              ((item: any, index: {toString: () => any}) => index.toString())
            }
            contentInsetAdjustmentBehavior="automatic"
          />
        );

      default:
        return <BottomSheetView>{children}</BottomSheetView>;
    }
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={initialIndex}
      snapPoints={memoizedSnapPoints}
      {...bottomSheetBehaviorProps}
      style={[style, {zIndex: zIndex ?? 1}]}
      backgroundComponent={renderBackground}
      backdropComponent={sheetBehavior.backdrop ? renderBackdrop : undefined}
      handleComponent={renderHandle}
      footerComponent={footerComponent}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode={android_keyboardInputMode}
      topInset={topInset}
      bottomInset={bottomInset}
      onChange={onChange}
      onAnimate={onAnimate}>
      {buildContent()}
    </BottomSheet>
  );
};

CustomBottomSheet.displayName = 'CustomBottomSheet';

export default CustomBottomSheet;
