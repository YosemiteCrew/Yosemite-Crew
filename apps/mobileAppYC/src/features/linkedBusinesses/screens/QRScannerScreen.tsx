import React, {useCallback, useMemo} from 'react';
import {View, StyleSheet, Text, Alert, Dimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {
  searchBusinessByQRCode,
  selectLinkedBusinessesLoading,
} from '../index';
import type {LinkedBusinessStackParamList} from '@/navigation/types';

type Props = NativeStackScreenProps<LinkedBusinessStackParamList, 'QRScanner'>;

export const QRScannerScreen: React.FC<Props> = ({route, navigation}) => {
  const {companionId, companionName, companionBreed, companionImage, category} =
    route.params;
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  useSelector(selectLinkedBusinessesLoading);

  // QR Scanner handler - will be integrated with react-native-vision-camera in production
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleQRScanned = useCallback(
    async (data: string) => {
      try {
        // Extract PMSBusinessCode from QR data
        const pmsBusinessCode = data.includes('PMS_')
          ? data.match(/PMS_\w+_\d+/)?.[0] || data
          : data;

        console.log('[QRScanner] Scanned code:', pmsBusinessCode);

        const business = await dispatch(
          searchBusinessByQRCode(pmsBusinessCode),
        ).unwrap();

        // Navigate to business details
        navigation.navigate('BusinessDetails', {
          companionId,
          companionName,
          companionBreed,
          companionImage,
          category,
          businessId: business.businessId || business.id,
          businessName: business.name,
          businessAddress: business.address,
          isPMSRecord: business.isPMSRecord,
          rating: business.rating,
          distance: business.distance,
        });
      } catch (error) {
        console.error('[QRScanner] Failed to process QR code:', error);
        Alert.alert(
          'Invalid QR Code',
          'The scanned QR code does not match any known business. Please try again.',
        );
      }
    },
    [dispatch, navigation, companionId, companionName, companionBreed, companionImage, category],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  // For now, show a mock scanner UI with instructions
  // In production, integrate react-native-vision-camera with vision-camera-code-scanner
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Scan QR Code" showBackButton onBack={handleBack} />

      <View style={styles.content}>
        <View style={styles.scannerPlaceholder}>
          <Text style={styles.scannerText}>📱</Text>
          <Text style={styles.placeholderTitle}>QR Code Scanner</Text>
          <Text style={styles.placeholderMessage}>
            Point your camera at the QR code to scan it
          </Text>
        </View>

        <View style={styles.mockScannerArea}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        <View style={styles.mockButtonsContainer}>
          <Text style={styles.mockButtonText}>Mock QR Scanner</Text>
          <Text style={styles.mockHintText}>
            Available integration:{'\n'}
            react-native-vision-camera + vision-camera-code-scanner
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => {
  const {width} = Dimensions.get('window');
  const scannerSize = width - 80;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing[6],
    },
    scannerPlaceholder: {
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    scannerText: {
      fontSize: 48,
    },
    placeholderTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    placeholderMessage: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    mockScannerArea: {
      width: scannerSize,
      height: scannerSize,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      position: 'relative',
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
    },
    cornerTopLeft: {
      position: 'absolute',
      top: -8,
      left: -8,
      width: 40,
      height: 40,
      borderTopWidth: 3,
      borderLeftWidth: 3,
      borderColor: theme.colors.primary,
    },
    cornerTopRight: {
      position: 'absolute',
      top: -8,
      right: -8,
      width: 40,
      height: 40,
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderColor: theme.colors.primary,
    },
    cornerBottomLeft: {
      position: 'absolute',
      bottom: -8,
      left: -8,
      width: 40,
      height: 40,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderColor: theme.colors.primary,
    },
    cornerBottomRight: {
      position: 'absolute',
      bottom: -8,
      right: -8,
      width: 40,
      height: 40,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderColor: theme.colors.primary,
    },
    mockButtonsContainer: {
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    mockButtonText: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
    },
    mockHintText: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
};
