import {
  Image,
  KeyboardAvoidingView,
  Platform,
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
import GMultipleOptions from '../../../components/GMultipleOptions';
import {useAppDispatch} from '../../../redux/store/storeUtils';
import {sign_up} from '../../../redux/slices/authSlice';

const CreateAccount = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const dispatch = useAppDispatch();
  const refRBSheet = useRef();
  const {t} = useTranslation();
  const [selectProfessional, setSelectProfessional] = useState();
  console.log('selectProfessional', selectProfessional);

  const [formValue, setFormValue] = useState({
    firstName: '',
    lastName: '',
    countryCode: '+1',
    phone: '',
    email: '',
    city: '',
    zip: '',
    pimsCode: '',
  });

  const [isChecked, setIsChecked] = useState(false);

  const toggleCheckbox = () => {
    setIsChecked(!isChecked);
  };

  const sign_up_hit = () => {
    let input = {
      email: formValue?.email,
      firstName: formValue?.firstName,
      lastName: formValue?.lastName,
      mobilePhone: formValue?.phone,
      city: formValue?.city,
      zipcode: formValue?.zip,
      professionType: JSON.stringify(selectProfessional),
      pimsCode: formValue?.pimsCode,
      countryCode: formValue?.countryCode,
      isProfessional: 'yes',
    };

    dispatch(sign_up(input)).then(res => {
      if (sign_up.fulfilled.match(res)) {
        console.log('res0123', res);

        if (res?.payload?.status === 1) {
          navigation?.navigate('ConfirmSignUp', {
            email: formValue?.email,
          });
        }
      }
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.scrollView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <GText
          GrMedium
          text={t('create_an_account_string')}
          style={[
            styles.createAccountText,
            {marginTop: scaledValue(statusBarHeight + scaledValue(17))},
          ]}
        />
        <TouchableOpacity style={styles.profileButton}>
          <Image source={Images.importProfile} style={styles.profileImage} />
        </TouchableOpacity>
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
            countryCode={formValue?.countryCode}
            formValue={formValue}
            setCountryCode={setFormValue}
            onChangeText={value => setFormValue({...formValue, phone: value})}
            style={styles.phoneInput}
            keyboardType="phone-pad"
          />
          <View style={styles.cityZipContainer}>
            <Input
              value={formValue.city}
              label={t('city_string')}
              onChangeText={value => setFormValue({...formValue, city: value})}
              style={styles.cityInput}
              keyboardType={'email-address'}
            />
            <Input
              value={formValue.zip}
              label={t('zip_code_string')}
              onChangeText={value => setFormValue({...formValue, zip: value})}
              style={styles.zipInput}
              keyboardType="phone-pad"
            />
          </View>
          <Input
            value={formValue.email}
            label={t('email_address_string')}
            onChangeText={value => setFormValue({...formValue, email: value})}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <TouchableOpacity
            onPress={() => {
              refRBSheet?.current?.open();
            }}
            style={styles.professionalButton}>
            <GText
              SatoshiRegular
              text={t('are_you_pet_professional_string')}
              style={styles.professionalText}
            />
            <Image source={Images.ArrowDown} style={styles.arrowIcon} />
          </TouchableOpacity>
          <Input
            value={formValue.pimsCode}
            label={t('pims_code_string')}
            rightIcon={Images.Scan}
            iconStyle={styles.scanIcon}
            keyboardType="phone-pad"
            onChangeText={value =>
              setFormValue({...formValue, pimsCode: value})
            }
            style={styles.input}
          />

          <View style={styles.container}>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity onPress={toggleCheckbox}>
                <Image
                  source={isChecked ? Images.Check_fill : Images.UnCheck}
                  style={styles.checkboxIcon}
                />
              </TouchableOpacity>

              <Text style={styles.text}>
                {t('terms_agreement_string')}
                <Text style={styles.link}>{t('terms_conditions_string')}</Text>
                {t('and_string')}
                <Text style={styles.link}>{t('privacy_policy_string')}</Text>
              </Text>
            </View>
          </View>
          <GButton
            onPress={() => {
              sign_up_hit();
              // navigation?.navigate('CreatePetProfile');
              // navigation?.navigate('CreatePetProfile');
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
      </ScrollView>
    </KeyboardAvoidingView>
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
