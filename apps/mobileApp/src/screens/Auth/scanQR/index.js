import React, {useState, useEffect, useRef} from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import HeaderButton from '../../../components/HeaderButton';
import {Images} from '../../../utils';
import {colors} from '../../../../assets/colors';
import {styles} from './styles';
import {openSettings, PERMISSIONS, request} from 'react-native-permissions';

const ScanQR = ({navigation, route}) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const device = useCameraDevice('back');
  // Use a ref to track if a QR code has been scanned and prevent further scans.
  const isCodeScanned = useRef(false);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, [navigation]);

  const handlePicker = async () => {
    if (Platform.OS == 'android') {
      const status = await PermissionsAndroid.request(
        'android.permission.CAMERA',
      );
      console.log('statusstatusstatus', JSON.stringify(status));

      if (status === 'granted' || status === 'never_ask_again') {
        setHasPermission(true);
      } else if (status === 'denied' || status === 'blocked') {
        Alert.alert(
          'Permission Blocked',
          'Please grant permission to access camera in order to scan the QR Code.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => console.log('cancel'),
            },
            {
              text: 'Open Settings',
              onPress: () => openSettings(),
            },
          ],
        );
      }
    } else {
      const status = await request(PERMISSIONS.IOS.CAMERA);
      if (status === 'granted' || status === 'limited') {
        setHasPermission(true);
      } else if (status === 'denied') {
        Alert.alert(
          'Permission Denied',
          'Please grant permission to access camera in order to scan the QR Code.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => console.log('cancel'),
            },
            {
              text: 'Open Settings',
              onPress: () => openSettings(),
            },
          ],
        );
      } else if (status === 'blocked') {
        Alert.alert(
          'Permission Blocked',
          'Please grant permission to access photos in order to select an image.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => console.log('cancel'),
            },
            {
              text: 'Open Settings',
              onPress: () => openSettings(),
            },
          ],
        );
      }
    }
  };

  useEffect(() => {
    // const requestCameraPermission = async () => {
    //   const permission = await Camera.requestCameraPermission();
    //   console.log('Camera Permission:', permission);
    //   setHasPermission(permission === 'granted');
    // };

    // requestCameraPermission();

    const handlePicker = async () => {
      if (Platform.OS == 'android') {
        const status = await PermissionsAndroid.request(
          'android.permission.CAMERA',
        );
        console.log('statusstatusstatus', JSON.stringify(status));

        if (status === 'granted') {
          setHasPermission(true);
        } else if (
          status === 'denied' ||
          status === 'blocked' ||
          status === 'never_ask_again'
        ) {
          Alert.alert(
            'Permission Denied',
            'Please grant permission to access camera in order to scan the QR Code.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => console.log('cancel'),
              },
              {
                text: 'Open Settings',
                onPress: () => openSettings(),
              },
            ],
          );
        }
      } else {
        const status = await request(PERMISSIONS.IOS.CAMERA);
        if (status === 'granted' || status === 'limited') {
          setHasPermission(true);
        } else if (status === 'denied') {
          Alert.alert(
            'Permission Denied',
            'Please grant permission to access camera in order to scan the QR Code.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => console.log('cancel'),
              },
              {
                text: 'Open Settings',
                onPress: () => openSettings(),
              },
            ],
          );
        } else if (status === 'blocked') {
          Alert.alert(
            'Permission Blocked',
            'Please grant permission to access photos in order to select an image.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => console.log('cancel'),
              },
              {
                text: 'Open Settings',
                onPress: () => openSettings(),
              },
            ],
          );
        }
      }
    };

    handlePicker();
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (codes.length > 0 && !isCodeScanned.current) {
        isCodeScanned.current = true;
        const scannedValue = codes[0].value.trim();

        let pmsCode = '';

        try {
          const parsedData = JSON.parse(scannedValue);
          if (parsedData?.pmsCode) {
            pmsCode = parsedData.pmsCode;
          } else {
            throw new Error('PMS code not found');
          }
        } catch (error) {
          // If not JSON, treat as plain code
          pmsCode = scannedValue;
        }

        console.log('Scanned PMS Code:', pmsCode);
        route.params.onGoBack?.(pmsCode);
        navigation.goBack();
      }
    },
  });

  if (!device) {
    return (
      <View style={styles.page2}>
        <Text style={styles.text}>Camera not available</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.page2}>
        <Text style={styles.text}>Camera permission required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {device != null && (
        <Camera
          codeScanner={codeScanner}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
        />
      )}

      <View style={styles.overlay}>
        <View style={styles.borderStyle} />
      </View>
    </View>
  );
};

export default ScanQR;
