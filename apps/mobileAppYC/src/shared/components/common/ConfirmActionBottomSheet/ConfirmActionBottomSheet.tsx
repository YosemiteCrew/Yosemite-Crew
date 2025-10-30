import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/shared/components/common/BottomSheet/BottomSheet';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
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
  titleStyle?: StyleProp<TextStyle>;
  messageStyle?: StyleProp<TextStyle>;
  buttonContainerStyle?: StyleProp<ViewStyle>;
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
      titleStyle,
      messageStyle,
      buttonContainerStyle,
    },
    ref,
  ) => {
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const bottomSheetRef = useRef<BottomSheetRef>(null);
    // Initialize based on initialIndex - only visible if initialIndex is NOT -1
    const [isSheetVisible, setIsSheetVisible] = React.useState(initialIndex !== -1);

    useImperativeHandle(ref, () => ({
      open: () => {
        setIsSheetVisible(true);
        bottomSheetRef.current?.snapToIndex(0);
      },
      close: () => {
        bottomSheetRef.current?.close();
      },
    }));

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
        />
      );
    };

    return (
      <CustomBottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        initialIndex={initialIndex}
        onChange={index => {
          setIsSheetVisible(index !== -1);
        }}
        enablePanDownToClose
        enableBackdrop={isSheetVisible}
        enableHandlePanningGesture
        enableContentPanningGesture={false}
        backdropOpacity={0.5}
        backdropAppearsOnIndex={0}
        backdropDisappearsOnIndex={-1}
        backdropPressBehavior="close"
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetHandle}
        contentType="view">
        <View style={[styles.container, containerStyle]}>
          <Text style={[styles.title, titleStyle]}>{title}</Text>
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
      </CustomBottomSheet>
    );
  },
);

ConfirmActionBottomSheet.displayName = 'ConfirmActionBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    bottomSheetBackground: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius['3xl'],
      borderTopRightRadius: theme.borderRadius['3xl'],
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.borderMuted,
    },
    container: {
      gap: theme.spacing['4'],
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['6'],
    },
    title: {
      ...theme.typography.h5Clash23,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    message: {
      ...theme.typography.paragraph18Bold,
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
