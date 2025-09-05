import {
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useRef, useState} from 'react';
import {scaledValue} from '../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import Input from '../../../components/Input';
import GButton from '../../../components/GButton';
import GTextButton from '../../../components/GTextButton/GTextButton';
import {styles} from './styles';
import GMultipleOptions from '../../../components/GMultipleOptions';
import {useAppDispatch} from '../../../redux/store/storeUtils';
import {sign_up} from '../../../redux/slices/authSlice';
import {colors} from '../../../../assets/colors';
import DatePicker from 'react-native-date-picker';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import ImagePicker from 'react-native-image-crop-picker';
import {openSettings, PERMISSIONS, request} from 'react-native-permissions';
import {fonts} from '../../../utils/fonts';
import {showToast} from '../../../components/Toast';

const CreateAccount = ({navigation, route}) => {
  const {userDetails} = route?.params;

  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const [apiCallImage, setApiCallImage] = useState({
    uri: userDetails?.picture,
  });
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [formValue, setFormValue] = useState({
    firstName: userDetails?.firstName || '',
    lastName: userDetails?.lastName || '',
    countryCode: '+1',
    phone: '',
    email: userDetails?.email,
    dob: '',
    flag: '🇺🇸',
  });

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const handlePicker = async () => {
    if (Platform.OS == 'android') {
      const status = await PermissionsAndroid.request(
        'android.permission.READ_MEDIA_IMAGES',
      );
      console.log('statusstatusstatus', JSON.stringify(status));

      if (
        status === 'granted' ||
        status === 'unavailable' ||
        status === 'never_ask_again'
      ) {
        ImagePicker.openPicker({
          width: 800,
          height: 800,
          cropping: false,
          compressImageMaxHeight: 800,
          compressImageMaxWidth: 800,
          // mediaType: 'photo',
        })
          .then(image => {
            let name =
              Platform.OS == 'android'
                ? image?.path.substring(image?.path.lastIndexOf('/') + 1)
                : image?.filename;
            let type = image?.mime;
            let localUri = image?.path;
            setApiCallImage({name, uri: localUri, type});

            // setImage(image?.path);
          })
          .catch(error => {
            console.error('Error opening picker:', error);
          });
      } else if (status === 'denied' || status === 'blocked') {
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
    } else {
      const status = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (status === 'granted' || status === 'limited') {
        ImagePicker.openPicker({
          width: 800,
          height: 800,
          cropping: false,
          compressImageMaxHeight: 800,
          compressImageMaxWidth: 800,
          mediaType: 'photo',
        }).then(image => {
          let name =
            Platform.OS == 'android'
              ? image?.path.substring(image?.path.lastIndexOf('/') + 1)
              : image?.filename;
          let type = image?.mime;
          let localUri = image?.path;
          setApiCallImage({name, uri: localUri, type});
        });
      } else if (status === 'denied') {
        Alert.alert(
          'Permission Denied',
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

  return (
    <>
      <KeyboardAwareScrollView style={styles.scrollView} bottomOffset={20}>
        <GText
          GrMedium
          text={t('create_an_account_string')}
          style={[
            styles.createAccountText,
            {marginTop: scaledValue(statusBarHeight + scaledValue(17))},
          ]}
        />
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={handlePicker}
          style={styles.profileButton(apiCallImage?.uri)}>
          <Image
            source={
              apiCallImage?.uri
                ? {uri: apiCallImage?.uri}
                : Images.importProfile
            }
            style={styles.profileImage}
          />
        </TouchableOpacity>
        <GText
          GrMedium
          text={t('personal_details_string')}
          style={{
            marginTop: scaledValue(67),
            paddingHorizontal: scaledValue(35),
          }}
        />
        <View style={styles.formContainer}>
          <Input
            value={formValue.firstName}
            label={t('first_name_string')}
            onChangeText={value =>
              setFormValue({...formValue, firstName: value})
            }
            style={styles.input}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.lastName}
            label={t('last_name_string')}
            onChangeText={value =>
              setFormValue({...formValue, lastName: value})
            }
            style={styles.input}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.phone}
            isShowPhone={true}
            label={t('mobile_number_string')}
            countryCode={formValue?.flag + ' ' + formValue?.countryCode}
            formValue={formValue}
            setCountryCode={setFormValue}
            onChangeText={value => setFormValue({...formValue, phone: value})}
            style={styles.phoneInput}
            keyboardType="phone-pad"
          />

          <Input
            value={formValue.email}
            disabled={userDetails?.email && true}
            label={t('email_address_string')}
            onChangeText={value => setFormValue({...formValue, email: value})}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <View style={styles.inputWrapper}>
            {date && (
              <View style={styles.inlineLabelWrapper}>
                <GText
                  SatoshiBold
                  text={t('dob_string')}
                  style={styles.inlineLabel}
                />
              </View>
            )}
            <TouchableOpacity
              onPress={() => setOpen(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                borderWidth: date ? scaledValue(1) : scaledValue(0.5),
                height: scaledValue(48),
                borderRadius: scaledValue(24),
                borderColor: colors.jetBlack,
                paddingHorizontal: scaledValue(20),
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <GText
                text={date ? formatDate(date) : t('dob_string')}
                style={{
                  fontSize: scaledValue(16),
                  opacity: date ? 0.8 : 0.6,
                  color: colors.jetBlack,
                  fontFamily: fonts.SATOSHI_MEDIUM,
                }}
              />
              <Image source={Images.Calender} style={styles.scanIcon} />
            </TouchableOpacity>
          </View>
          <GButton
            onPress={() => {
              if (
                !formValue?.firstName ||
                !formValue?.lastName ||
                !formValue?.phone ||
                !formValue?.email ||
                !formValue?.dob
              ) {
                showToast(0, 'Please fill all the details!');
              } else {
                navigation?.navigate('AddAddress', {
                  userDetails: formValue,
                  apiCallImage: apiCallImage,
                  type: userDetails?.type,
                });
              }
            }}
            title={t('add_address_string')}
            style={styles.createAccountButton}
          />
          <View style={styles.memberContainer}>
            <GText
              SatoshiBold
              text={t('already_member_string')}
              style={styles.alreadyMemberText}
            />
            <GTextButton
              onPress={() => navigation?.navigate('SignIn')}
              title={t('sign_in_string')}
              titleStyle={styles.signInText}
            />
          </View>
        </View>
      </KeyboardAwareScrollView>

      <DatePicker
        modal
        open={open}
        date={date || new Date()}
        mode="date"
        onConfirm={date => {
          setOpen(false);
          setDate(date);
          setFormValue({...formValue, dob: formatDate(date)});
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
};

export default CreateAccount;

const professionalList = [
  {
    id: 1,
    name: 'Pet Parent',
  },
  {
    id: 2,
    name: 'Veterinarian',
  },
  {
    id: 3,
    name: 'Breeder',
  },
  {
    id: 4,
    name: 'Groomer',
  },
  {
    id: 5,
    name: 'Pet Home Owner',
  },
];
