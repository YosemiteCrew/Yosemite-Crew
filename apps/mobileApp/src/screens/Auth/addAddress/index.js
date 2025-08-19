import {
  Image,
  Keyboard,
  ScrollView,
  Text,
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
import {useAppDispatch} from '../../../redux/store/storeUtils';
import {sign_up} from '../../../redux/slices/authSlice';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {GooglePlacesAutocomplete} from 'react-native-google-places-autocomplete';
import {GOOGLE_API_KEY} from '../../../constants';
import {colors} from '../../../../assets/colors';

const AddAddress = ({navigation, route}) => {
  const {userDetails, apiCallImage} = route?.params;
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const dispatch = useAppDispatch();
  const {t} = useTranslation();

  const [formValue, setFormValue] = useState({
    city: '',
    area: '',
    postal_code: '',
    addressLine1: '',
    state: '',
  });

  const [isChecked, setIsChecked] = useState(false);

  const toggleCheckbox = () => {
    setIsChecked(!isChecked);
  };

  const sign_up_hit = () => {
    let input = {
      email: userDetails?.email?.trim(),
      firstName: userDetails?.firstName?.trim(),
      lastName: userDetails?.lastName?.trim(),
      mobilePhone: userDetails?.phone?.trim(),
      countryCode: userDetails?.countryCode?.trim(),
      addressLine1: formValue?.addressLine1?.trim(),
      area: formValue?.area?.trim(),
      state: formValue?.state?.trim(),
      city: formValue?.city?.trim(),
      zipcode: formValue?.postal_code?.trim(),
      dateOfBirth: userDetails?.dob,
    };
    const api_credentials = {
      data: input,
      files: [apiCallImage],
    };

    dispatch(sign_up(api_credentials)).then(res => {
      if (sign_up.fulfilled.match(res)) {
        if (res?.payload?.status === 1) {
          navigation?.navigate('ConfirmSignUp', {
            email: userDetails?.email,
          });
        }
      }
    });
  };

  return (
    <KeyboardAwareScrollView bottomOffset={20} style={styles.scrollView}>
      <GText
        GrMedium
        text={t('create_an_account_string')}
        style={[
          styles.createAccountText,
          {marginTop: scaledValue(statusBarHeight + scaledValue(17))},
        ]}
      />
      <View style={styles.profileButton}>
        <Image source={{uri: apiCallImage?.uri}} style={styles.profileImage} />
      </View>
      <GText GrMedium style={styles.headerText} text="Add Address" />
      <View style={styles.formContainer}>
        <Input
          value={formValue.addressLine1}
          label={t('address_first_string')}
          onChangeText={value =>
            setFormValue({...formValue, addressLine1: value})
          }
          style={styles.input}
          keyboardType={'email-address'}
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
            label={t('city_string')}
            onChangeText={value => setFormValue({...formValue, city: value})}
            style={styles.cityInput}
          />
          <Input
            value={formValue.postal_code}
            label={t('postal_code_string')}
            onChangeText={value =>
              setFormValue({...formValue, postal_code: value})
            }
            style={styles.zipInput}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.container}>
          <View style={styles.checkboxContainer}>
            <TouchableOpacity onPress={toggleCheckbox}>
              <Image
                source={isChecked ? Images.Check_fill : Images.UnCheck}
                style={styles.checkboxIcon}
              />
            </TouchableOpacity>

            <Text
              onPress={() => navigation.navigate('Terms')}
              style={styles.text}>
              {t('terms_agreement_string')}
              <Text style={styles.link}>{t('terms_conditions_string')}</Text>
              {t('and_string')}
              <Text
                onPress={() => navigation.navigate('Privacy')}
                style={styles.link}>
                {t('privacy_policy_string')}
              </Text>
            </Text>
          </View>
        </View>
        <GButton
          onPress={() => {
            sign_up_hit();
          }}
          title={t('create_account_button')}
          style={styles.createAccountButton}
          textStyle={styles.createAccountButtonText}
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
  );
};

export default AddAddress;
