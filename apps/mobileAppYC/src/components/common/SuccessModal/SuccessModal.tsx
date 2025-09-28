// src/components/common/SuccessModal/SuccessModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { useTheme } from '../../../hooks';
import { Images } from '../../../assets/images';

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  illustration?: any;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  onClose,
  title,
  message,
  buttonText = 'Okay',
  illustration,
}) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={styles.content}>
        {illustration && (
          <Image
            source={illustration || Images.verificationSuccess}
            style={styles.illustration}
            resizeMode="contain"
          />
        )}
        
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
        
        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
          {message}
        </Text>
        
        <Button
          title={buttonText}
          onPress={onClose}
          style={styles.button}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    width: '100%',
  },
  illustration: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    width: '100%',
  },
});