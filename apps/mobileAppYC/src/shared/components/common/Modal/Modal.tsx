// src/components/common/Modal/Modal.tsx
import React from 'react';
import {
  Modal as RNModal,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  animationType?: 'slide' | 'fade' | 'none';
  transparent?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  animationType = 'fade',
  transparent = true,
}) => {
  const {theme} = useTheme();
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const styles = React.useMemo(
    () => createStyles(theme, screenWidth, screenHeight),
    [theme, screenWidth, screenHeight],
  );

  return (
    <RNModal
      visible={visible}
      animationType={animationType}
      transparent={transparent}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <PressableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[styles.content, {backgroundColor: theme.colors.background}]}>
          {children}
        </View>
      </View>
    </RNModal>
  );
};

const createStyles = (theme: any, screenWidth: number, screenHeight: number) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.overlay,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    content: {
      width: screenWidth * 0.9,
      maxHeight: screenHeight * 0.8,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['6'],
      alignItems: 'center',
    },
  });
