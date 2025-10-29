// src/components/common/Modal/Modal.tsx
import React from 'react';
import {
  Modal as RNModal,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/hooks';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  animationType?: 'slide' | 'fade' | 'none';
  transparent?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  animationType = 'fade',
  transparent = true,
}) => {
  const { theme } = useTheme();

  return (
    <RNModal
      visible={visible}
      animationType={animationType}
      transparent={transparent}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.content, { backgroundColor: theme.colors.background }]}>
          {children}
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
});