import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/shared/components/common/BottomSheet/BottomSheet';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {BottomSheetHeader} from '@/shared/components/common/BottomSheetHeader/BottomSheetHeader';
import {useTheme} from '@/hooks';

export interface ConfirmActionBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface ConfirmButtonConfig {
  label: string;
  onPress: () => Promise<void> | void;
  tintColor?: string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  forceBorder?: boolean;
  borderColor?: string;
  disabled?: boolean;
  loading?: boolean;
  shadowIntensity?: 'none' | 'light' | 'medium' | 'strong';
}

interface ConfirmActionBottomSheetProps {
  title: string;
  message?: string;
  messageAlign?: 'left' | 'center';
  primaryButton: ConfirmButtonConfig;
  secondaryButton?: ConfirmButtonConfig;
  children?: React.ReactNode;
  snapPoints?: Array<string | number>;
  initialIndex?: number;
  containerStyle?: StyleProp<ViewStyle>;
  messageStyle?: StyleProp<TextStyle>;
  buttonContainerStyle?: StyleProp<ViewStyle>;
  onSheetChange?: (index: number) => void;
  zIndex?: number;
  bottomInset?: number;
  enablePanDown?: boolean;
  enableHandlePanning?: boolean;
  showCloseButton?: boolean;
  backdropPressBehavior?: 'close' | 'none';
}

export const ConfirmActionBottomSheet = forwardRef<
  ConfirmActionBottomSheetRef,
  ConfirmActionBottomSheetProps
>(
  (
    {
      title,
      message,
      messageAlign = 'center',
      primaryButton,
      secondaryButton,
      children,
      snapPoints = ['35%'],
      initialIndex = -1,
      containerStyle,
      messageStyle,
      buttonContainerStyle,
      onSheetChange,
      zIndex,
      bottomInset,
      enablePanDown = true,
      enableHandlePanning = true,
      showCloseButton = true,
      backdropPressBehavior = 'close',
    },
    ref,
  ) => {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const bottomSheetRef = useRef<BottomSheetRef>(null);
    // Initialize based on initialIndex - only visible if initialIndex is NOT -1
    const [isSheetVisible, setIsSheetVisible] = useState(initialIndex !== -1);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    // Listen to keyboard events to adjust snap points
    useEffect(() => {
      const keyboardDidShow = Keyboard.addListener(
        'keyboardDidShow',
        () => {
          setIsKeyboardVisible(true);
        }
      );
      const keyboardDidHide = Keyboard.addListener(
        'keyboardDidHide',
        () => {
          setIsKeyboardVisible(false);
        }
      );

      return () => {
        keyboardDidShow.remove();
        keyboardDidHide.remove();
      };
    }, []);

    // Dynamic snap points based on keyboard visibility
    const dynamicSnapPoints = useMemo(() => {
      if (isKeyboardVisible) {
        // When keyboard is open, expand to accommodate it
        // Always provide 2 snap points for smooth animation
        return ['93%', '95%'];
      }
      // Ensure we always have at least 2 snap points for proper animation
      if (snapPoints.length === 1) {
        const singlePoint = snapPoints[0];
        return [singlePoint, singlePoint];
      }
      return snapPoints;
    }, [isKeyboardVisible, snapPoints]);

    useImperativeHandle(ref, () => ({
      open: () => {
        setIsSheetVisible(true);
        // Snap to the last (highest) snap point for proper keyboard animation
        // When keyboard is closed, we want the highest snap point in the array
        const targetIndex = Math.max(0, snapPoints.length - 1);
        bottomSheetRef.current?.snapToIndex(targetIndex);
      },
      close: () => {
        Keyboard.dismiss();
        setIsSheetVisible(false);
        bottomSheetRef.current?.close();
      },
    }), [snapPoints]);

    const handleClose = () => {
      Keyboard.dismiss();
      bottomSheetRef.current?.close();
    };

    const handleBackdropPress = () => {
      Keyboard.dismiss();
    };

    const renderButton = (
      config: ConfirmButtonConfig,
      defaults: {tintColor: string; textColor: string},
    ) => {
      const textStyle = StyleSheet.flatten([
        styles.buttonText,
        {color: defaults.textColor},
        config.textStyle,
      ]) as TextStyle | undefined;

      const buttonStyle = StyleSheet.flatten([styles.button, config.style]) as
        | ViewStyle
        | undefined;

      const handlePress = () => {
        const result = config.onPress();
        if (result instanceof Promise) {
          result.catch(error => {
            console.warn('[ConfirmActionBottomSheet] Button action rejected', error);
          });
        }
      };

      return (
        <LiquidGlassButton
          title={config.label}
          onPress={handlePress}
          glassEffect="clear"
          tintColor={config.tintColor ?? defaults.tintColor}
          borderRadius="lg"
          textStyle={textStyle}
          style={buttonStyle}
          disabled={config.disabled}
          loading={config.loading}
          forceBorder={config.forceBorder}
          borderColor={config.borderColor}
          shadowIntensity={config.shadowIntensity ?? 'light'}
        />
      );
    };

    return (
      <CustomBottomSheet
        ref={bottomSheetRef}
        snapPoints={dynamicSnapPoints}
        initialIndex={initialIndex}
        zIndex={zIndex ?? 100}
        onChange={index => {
          setIsSheetVisible(index !== -1);
          if (index === -1) {
            Keyboard.dismiss();
            setIsKeyboardVisible(false);
          }
          onSheetChange?.(index);
        }}
        enablePanDownToClose={enablePanDown}
        enableBackdrop={isSheetVisible}
        enableHandlePanningGesture={enableHandlePanning}
        enableContentPanningGesture={false}
        backdropOpacity={0.5}
        backdropAppearsOnIndex={0}
        backdropDisappearsOnIndex={-1}
        backdropPressBehavior={backdropPressBehavior}
        onBackdropPress={handleBackdropPress}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
        bottomInset={bottomInset}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        contentType="view">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.container, containerStyle]}>
          <BottomSheetHeader
            title={title}
            onClose={handleClose}
            theme={theme}
            showCloseButton={showCloseButton}
          />
          {message ? (
            <Text
              style={[
                styles.message,
                {textAlign: messageAlign},
                messageStyle,
              ]}>
              {message}
            </Text>
          ) : null}

          {children}

          <View style={[styles.buttonRow, buttonContainerStyle]}>
            {secondaryButton
              ? renderButton(secondaryButton, {
                  tintColor: theme.colors.surface,
                  textColor: theme.colors.secondary,
                })
              : null}
            {renderButton(primaryButton, {
              tintColor: theme.colors.secondary,
              textColor: theme.colors.white,
            })}
          </View>
          </View>
        </TouchableWithoutFeedback>
      </CustomBottomSheet>
    );
  },
);

ConfirmActionBottomSheet.displayName = 'ConfirmActionBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    bottomSheetBackground: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.spacing['6'],
      borderTopRightRadius: theme.spacing['6'],
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.borderMuted,
    },
    container: {
      gap: theme.spacing['4'],
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['12'],
    },
    message: {
      ...theme.typography.titleMedium,
            paddingBottom: theme.spacing['5'],
      color: theme.colors.secondary,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    button: {
      flex: 1,
    },
    buttonText: {
      ...theme.typography.buttonH6Clash19,
      textAlign: 'center',
    },
  });

export default ConfirmActionBottomSheet;
