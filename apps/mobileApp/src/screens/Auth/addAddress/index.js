import {FlatList, Image, Text, TouchableOpacity, View} from 'react-native';
import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import {setUserData, sign_up} from '../../../redux/slices/authSlice';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {colors} from '../../../../assets/colors';
import {showToast} from '../../../components/Toast';
import countriescities from '../../../../assets/countriescities.json';
import GOptions from '../../../components/GOptions';
import {fonts} from '../../../utils/fonts';
import GooglePlacesInput from '../../../components/GooglePlacesInput';
import HeaderButton from '../../../components/HeaderButton';

const AddAddress = ({navigation, route}) => {
  const {userDetails, apiCallImage, type} = route?.params;

  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const refRBSheetCountry = useRef();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          style={{marginLeft: scaledValue(20)}}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, [navigation]);

  const [formValue, setFormValue] = useState({
    city: '',
    area: '',
    postal_code: '',
    addressLine1: '',
    state: '',
    country: '',
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
      type: type ? type : 'email',
      flag: userDetails?.flag,
    };
    const api_credentials = {
      data: input,
      files: [apiCallImage],
    };

    console.log('api_credentials', JSON.stringify(api_credentials));

    dispatch(sign_up(api_credentials)).then(res => {
      if (sign_up.fulfilled.match(res)) {
        if (res?.payload?.status === 1) {
          if (type === 'email') {
            navigation?.navigate('ConfirmSignUp', {
              email: userDetails?.email,
            });
          } else {
            dispatch(setUserData(res?.payload?.data));
          }
        }
      }
    });
  };

  return (
    <KeyboardAwareScrollView bottomOffset={20} style={styles.scrollView}>
      <View style={styles.profileButton}>
        <Image
          source={apiCallImage?.uri ? {uri: apiCallImage?.uri} : Images.appLogo}
          style={styles.profileImage}
        />
      </View>
      <GText GrMedium style={styles.headerText} text="Address Details" />
      <View style={styles.formContainer}>
        <View style={styles.inputWrapper}>
          {formValue?.country && (
            <View style={styles.inlineLabelWrapper}>
              <GText
                SatoshiBold
                text={t('country_string')}
                style={styles.inlineLabel}
              />
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              refRBSheetCountry?.current?.open();
            }}
            style={{
              flexDirection: 'row',
              borderWidth: formValue?.country
                ? scaledValue(1)
                : scaledValue(0.5),
              height: scaledValue(48),
              alignItems: 'center',
              borderRadius: scaledValue(24),
              borderColor: colors.jetBlack,
              paddingHorizontal: scaledValue(20),
              justifyContent: 'space-between',
            }}>
            <GText
              componentProps={{numberOfLines: 1, ellipsizeMode: 'tail'}}
              text={formValue?.country || 'Choose Country'}
              style={{
                fontSize: scaledValue(16),
                opacity: formValue?.country ? 0.8 : 0.6,
                color: colors.jetBlack,
                fontFamily: fonts.SATOSHI_MEDIUM,
              }}
            />
            <Image source={Images.ArrowDown} style={styles.rightIcon} />
          </TouchableOpacity>
        </View>
        <GooglePlacesInput
          label={t('address_first_string')}
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
              postal_code: details.postal_code,
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
            if (
              !formValue?.area ||
              !formValue?.city ||
              !formValue?.postal_code ||
              !formValue?.state ||
              !formValue?.addressLine1
            ) {
              showToast(0, 'Please fill all the address.');
            } else if (!isChecked) {
              showToast(0, 'You must accept the terms and conditions.');
            } else {
              sign_up_hit();
            }
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
      <GOptions
        refRBSheet={refRBSheetCountry}
        title="Select Country"
        options={countriescities}
        search={true}
        onChoose={val => {
          setFormValue({...formValue, country: val?.name, city: ''});
          refRBSheetCountry?.current?.close();
        }}
      />
    </KeyboardAwareScrollView>
  );
};

export default AddAddress;
