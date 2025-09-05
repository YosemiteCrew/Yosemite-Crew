import {
  Alert,
  Image,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import HeaderButton from '../../../../components/HeaderButton';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../components/GText/GText';
import Input from '../../../../components/Input';
import GButton from '../../../../components/GButton';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../redux/store/storeUtils';
import {useTranslation} from 'react-i18next';
import GMultipleOptions from '../../../../components/GMultipleOptions';
import {scaledValue} from '../../../../utils/design.utils';
import DatePicker from 'react-native-date-picker';
import {fonts} from '../../../../utils/fonts';
import GooglePlacesInput from '../../../../components/GooglePlacesInput';
import GImage from '../../../../components/GImage';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {
  edi_user_profile,
  setUserData,
} from '../../../../redux/slices/authSlice';
import ImagePicker from 'react-native-image-crop-picker';
import {openSettings, PERMISSIONS, request} from 'react-native-permissions';

const EditProfile = ({navigation}) => {
  const dispatch = useAppDispatch();
  const userData = useAppSelector(state => state.auth.user);
  console.log('userDatauserData', JSON.stringify(userData));

  const [apiCallImage, setApiCallImage] = useState();
  const [image, setImage] = useState();
  const refRBSheet = useRef();
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [selectProfessional, setSelectProfessional] = useState();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const handleImagePicker = async () => {
    if (Platform.OS === 'android') {
      const status = await PermissionsAndroid.request(
        'android.permission.READ_MEDIA_IMAGES',
      );
      if (status === 'granted') {
        pickImage();
      } else {
        showPermissionAlert();
      }
    } else {
      const status = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (status === 'granted' || status === 'limited') {
        pickImage();
      } else {
        showPermissionAlert();
      }
    }
  };

  const pickImage = () => {
    ImagePicker.openPicker({
      width: 800,
      height: 800,
      cropping: false,
      compressImageMaxHeight: 800,
      compressImageMaxWidth: 800,
    }).then(image => {
      const name =
        Platform.OS === 'android'
          ? image.path.substring(image.path.lastIndexOf('/') + 1)
          : image.filename;
      const {path, mime} = image;
      setImage(path);
      setApiCallImage({name, uri: path, type: mime});
    });
  };

  const showPermissionAlert = () => {
    Alert.alert(
      'Permission Required',
      'Please grant access to your photos to select an image.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: openSettings},
      ],
    );
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const [formValue, setFormValue] = useState({
    firstName: userData?.firstName,
    lastName: userData?.lastName,
    countryCode: userData?.countryCode || '🇺🇸 +1',
    phone: userData?.mobilePhone,
    email: userData?.email,
    dob: formatDate(userData?.dateOfBirth),
    city: userData?.city,
    zip: userData?.zipcode,
    addressLine1: userData?.address,
    area: userData?.area || '',
    state: userData?.state || '',
  });

  const editProfile = () => {
    let input = {
      email: formValue?.email?.trim(),
      firstName: formValue?.firstName?.trim(),
      lastName: formValue?.lastName?.trim(),
      mobilePhone: formValue?.phone?.trim(),
      countryCode: formValue?.countryCode?.trim(),
      addressLine1: formValue?.addressLine1?.trim(),
      area: formValue?.area?.trim(),
      state: formValue?.state?.trim(),
      city: formValue?.city?.trim(),
      zipcode: formValue?.zip?.trim(),
      dateOfBirth: formValue?.dob,
    };
    const api_credentials = {
      data: input,
      files: [apiCallImage],
    };
    console.log(JSON.stringify(input));

    dispatch(edi_user_profile(api_credentials)).then(res => {
      if (edi_user_profile.fulfilled.match(res)) {
        console.log('res0123456', JSON.stringify(res));

        if (res?.payload?.status === 1) {
          const updatedData = {
            ...userData,
            ...res?.payload?.data,
          };
          delete updatedData?.password;
          dispatch(setUserData(updatedData));
          navigation?.goBack();
        }
      }
    });
  };

  return (
    <KeyboardAwareScrollView bottomOffset={50} style={styles.dashboardMainView}>
      <TouchableOpacity
        onPress={handleImagePicker}
        style={styles.profileButton}>
        {image ? (
          <Image
            source={image ? {uri: image} : Images.importProfile}
            style={styles.profileImage}
          />
        ) : (
          <GImage
            image={userData?.profileImage[0]?.url}
            style={styles.profileImage}
          />
        )}
      </TouchableOpacity>
      <GText
        GrMedium
        text={'Personal Details'}
        style={{
          fontSize: scaledValue(18),
          letterSpacing: scaledValue(18 * -0.01),
          paddingHorizontal: scaledValue(20),
          marginTop: scaledValue(47),
        }}
      />
      <View style={styles.formContainer}>
        <Input
          value={formValue.firstName}
          label={t('first_name_string')}
          onChangeText={value => setFormValue({...formValue, firstName: value})}
          style={styles.input}
          keyboardType={'email-address'}
        />
        <Input
          value={formValue.lastName}
          label={t('last_name_string')}
          onChangeText={value => setFormValue({...formValue, lastName: value})}
          style={styles.input}
          keyboardType={'email-address'}
        />
        <Input
          value={formValue.phone}
          isShowPhone={true}
          label={t('mobile_number_string')}
          countryCode={formValue?.countryCode}
          formValue={formValue}
          setCountryCode={setFormValue}
          onChangeText={value => setFormValue({...formValue, phone: value})}
          style={styles.phoneInput}
          keyboardType="phone-pad"
        />
        <Input
          value={formValue.email}
          label={t('email_address_string')}
          onChangeText={value => setFormValue({...formValue, email: value})}
          style={styles.input}
          keyboardType={'email-address'}
        />
        <View style={styles.inputWrapper}>
          {/* {date ||
            (userData?.dateOfBirth && (
              <View style={styles.inlineLabelWrapper}>
                <GText
                  SatoshiBold
                  text={t('dob_string')}
                  style={styles.inlineLabel}
                />
              </View>
            ))} */}
          <TouchableOpacity
            onPress={() => setOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              borderWidth:
                date || userData?.dateOfBirth
                  ? scaledValue(1)
                  : scaledValue(0.5),
              height: scaledValue(48),
              borderRadius: scaledValue(24),
              borderColor: colors.jetBlack,
              paddingHorizontal: scaledValue(20),
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <GText
              text={
                date
                  ? formatDate(date)
                  : userData?.dateOfBirth
                  ? formatDate(userData?.dateOfBirth)
                  : t('dob_string')
              }
              style={[styles.dateText(date || userData?.dateOfBirth)]}
            />
            <Image source={Images.Calender} style={styles.scanIcon} />
          </TouchableOpacity>
        </View>
        <GText
          GrMedium
          text={'Address Details'}
          style={{
            fontSize: scaledValue(18),
            letterSpacing: scaledValue(18 * -0.01),
            paddingHorizontal: scaledValue(20),
          }}
        />
        <GooglePlacesInput
          label="Address 1"
          value={formValue.addressLine1}
          onChangeText={text =>
            setFormValue({...formValue, addressLine1: text})
          }
          onSelect={details => {
            setFormValue({
              ...formValue,
              addressLine1: details.full_address,
              city: details.city,
              state: details.state,
              zip: details.postal_code,
              area: details.area,
            });
          }}
        />

        <View style={styles.cityZipContainer}>
          <Input
            value={formValue.area}
            label={t('area_string')}
            onChangeText={value => setFormValue({...formValue, area: value})}
            style={styles.cityInput}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.state}
            label={t('state_province_string')}
            onChangeText={value => setFormValue({...formValue, state: value})}
            style={styles.zipInput}
          />
        </View>
        <View style={styles.cityZipContainer}>
          <Input
            value={formValue.city}
            multiline={false}
            label={t('city_string')}
            onChangeText={value => setFormValue({...formValue, city: value})}
            style={styles.cityInput}
          />
          <Input
            value={formValue.zip}
            label={t('postal_code_string')}
            onChangeText={value => setFormValue({...formValue, zip: value})}
            style={styles.zipInput}
            keyboardType="phone-pad"
          />
        </View>
        <GButton
          onPress={() => {
            editProfile();
          }}
          title={t('save_details_string')}
          style={styles.createAccountButton}
        />
      </View>
      <GMultipleOptions
        refRBSheet={refRBSheet}
        title="Are you a pet professional?"
        options={professionalList}
        search={false}
        value={selectProfessional}
        multiSelect={true}
        onChoose={val => {
          setSelectProfessional(val);
        }}
      />

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
    </KeyboardAwareScrollView>
  );
};

export default EditProfile;

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
