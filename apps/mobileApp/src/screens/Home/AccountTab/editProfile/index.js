import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import HeaderButton from '../../../../components/HeaderButton';
import { Images } from '../../../../utils';
import { colors } from '../../../../../assets/colors';
import { styles } from './styles';
import GText from '../../../../components/GText/GText';
import Input from '../../../../components/Input';
import GButton from '../../../../components/GButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../redux/store/storeUtils';
import { useTranslation } from 'react-i18next';
import GMultipleOptions from '../../../../components/GMultipleOptions';
import { scaledValue } from '../../../../utils/design.utils';

const EditProfile = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const userData = useAppSelector((state) => state.auth.user);
  const refRBSheet = useRef();
  const { t } = useTranslation();
  const [selectProfessional, setSelectProfessional] = useState();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const [formValue, setFormValue] = useState({
    firstName: userData?.firstName,
    lastName: userData?.lastName,
    countryCode: '+1',
    phone: userData?.mobilePhone,
    email: userData?.email,
    city: userData?.city,
    zip: userData?.zipcode,
    pimsCode: userData?.pimsCode,
  });

  return (
    <View style={styles.dashboardMainView}>
      <KeyboardAvoidingView
        style={styles.scrollView}
        behavior={Platform.OS === 'ios' ? 'padding' : ''}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView>
          <TouchableOpacity style={styles.profileButton}>
            <Image source={Images.importProfile} style={styles.profileImage} />
          </TouchableOpacity>
          <View style={styles.formContainer}>
            <Input
              value={formValue.firstName}
              label={t('first_name_string')}
              onChangeText={(value) =>
                setFormValue({ ...formValue, firstName: value })
              }
              style={styles.input}
              keyboardType={'email-address'}
            />
            <Input
              value={formValue.lastName}
              label={t('last_name_string')}
              onChangeText={(value) =>
                setFormValue({ ...formValue, lastName: value })
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
              onChangeText={(value) =>
                setFormValue({ ...formValue, phone: value })
              }
              style={styles.phoneInput}
              keyboardType="phone-pad"
            />
            <View style={styles.cityZipContainer}>
              <Input
                value={formValue.city}
                label={t('city_string')}
                onChangeText={(value) =>
                  setFormValue({ ...formValue, city: value })
                }
                style={styles.cityInput}
                keyboardType={'email-address'}
              />
              <Input
                value={formValue.zip}
                label={t('zip_code_string')}
                onChangeText={(value) =>
                  setFormValue({ ...formValue, zip: value })
                }
                style={styles.zipInput}
                keyboardType="phone-pad"
              />
            </View>
            <Input
              value={formValue.email}
              label={t('email_address_string')}
              onChangeText={(value) =>
                setFormValue({ ...formValue, email: value })
              }
              style={styles.input}
              keyboardType={'email-address'}
            />
            <TouchableOpacity
              onPress={() => {
                refRBSheet?.current?.open();
              }}
              style={styles.professionalButton}
            >
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
              onChangeText={(value) =>
                setFormValue({ ...formValue, pimsCode: value })
              }
              style={styles.input}
            />

            <GButton
              onPress={() => {}}
              title={t('update_profile_string')}
              style={styles.createAccountButton}
              textStyle={styles.createAccountButtonText}
            />
          </View>
          <GMultipleOptions
            refRBSheet={refRBSheet}
            title="Are you a pet professional?"
            options={professionalList}
            search={false}
            value={selectProfessional}
            multiSelect={true}
            onChoose={(val) => {
              setSelectProfessional(val);
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
