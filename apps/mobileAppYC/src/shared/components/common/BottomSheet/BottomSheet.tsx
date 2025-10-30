import React, { useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { ViewStyle } from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFooterProps,
  BottomSheetHandle,
  BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import type { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

// Types
export type BottomSheetRef = BottomSheetMethods;

export interface CustomBottomSheetProps {
  // Required props
  children: React.ReactNode;
  
  // Snap configuration
  snapPoints?: (string | number)[];
  initialIndex?: number;
  
  // Behavior
  enablePanDownToClose?: boolean;
  enableDynamicSizing?: boolean;
  enableOverDrag?: boolean;
  enableContentPanningGesture?: boolean;
  enableHandlePanningGesture?: boolean;
  
  // Styling
  style?: ViewStyle;
  backgroundStyle?: ViewStyle;
  handleStyle?: ViewStyle;
  handleIndicatorStyle?: ViewStyle;
  
  // Backdrop
  enableBackdrop?: boolean;
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
  flatListRenderItem?: ({ item, index }: { item: any; index: number }) => React.ReactElement;
  flatListKeyExtractor?: (item: any, index: number) => string;
  
  // Callbacks
  onChange?: (index: number) => void;
  onAnimate?: (fromIndex: number, toIndex: number) => void;
  onBackdropPress?: () => void;
}

const CustomBottomSheet = forwardRef<BottomSheetRef, CustomBottomSheetProps>(
  (
    {
      children,
      snapPoints = ['25%', '50%', '90%'],
      initialIndex = 0,
      enablePanDownToClose = false,
      enableDynamicSizing = true,
      enableOverDrag = true,
      enableContentPanningGesture = true,
      enableHandlePanningGesture = true,
      style,
      backgroundStyle,
      handleStyle,
      handleIndicatorStyle,
      enableBackdrop = false,
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
      flatListData = [],
      flatListRenderItem,
      flatListKeyExtractor,
      onChange,
      onAnimate,
      onBackdropPress,
    },
    ref
  ) => {
    const bottomSheetRef = useRef<BottomSheet>(null);

    // Expose methods through ref
    useImperativeHandle(ref, () => ({
      snapToIndex: (index: number, animationConfigs?: WithSpringConfig | WithTimingConfig) => {
        bottomSheetRef.current?.snapToIndex(index, animationConfigs);
      },
      snapToPosition: (position: string | number, animationConfigs?: WithSpringConfig | WithTimingConfig) => {
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
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          opacity={backdropOpacity}
          appearsOnIndex={backdropAppearsOnIndex}
          disappearsOnIndex={backdropDisappearsOnIndex}
          pressBehavior={backdropPressBehavior}
          onPress={onBackdropPress}
        />
      ),
      [backdropOpacity, backdropAppearsOnIndex, backdropDisappearsOnIndex, backdropPressBehavior, onBackdropPress]
    );

    // Handle component
    const renderHandle = useCallback(
      (props: BottomSheetHandleProps) => {
        if (customHandle && handleComponent) {
          return handleComponent(props);
        }
        return <BottomSheetHandle {...props} style={handleStyle} indicatorStyle={handleIndicatorStyle} />;
      },
      [customHandle, handleComponent, handleStyle, handleIndicatorStyle]
    );

    // Content renderer based on type
    const renderContent = () => {
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
              keyExtractor={flatListKeyExtractor || ((item: any, index: { toString: () => any; }) => index.toString())}
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
        enablePanDownToClose={enablePanDownToClose}
        enableDynamicSizing={enableDynamicSizing}
        enableOverDrag={enableOverDrag}
        enableContentPanningGesture={enableContentPanningGesture}
        enableHandlePanningGesture={enableHandlePanningGesture}
        style={style}
        backgroundStyle={backgroundStyle}
        backdropComponent={enableBackdrop ? renderBackdrop : undefined}
        handleComponent={renderHandle}
        footerComponent={footerComponent}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior={keyboardBlurBehavior}
        android_keyboardInputMode={android_keyboardInputMode}
        topInset={topInset}
        bottomInset={bottomInset}
        onChange={onChange}
        onAnimate={onAnimate}
      >
        {renderContent()}
      </BottomSheet>
    );
  }
);

CustomBottomSheet.displayName = 'CustomBottomSheet';

export default CustomBottomSheet;
