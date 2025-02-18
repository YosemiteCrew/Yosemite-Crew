import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useState} from 'react';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {scaledValue} from '../../../utils/design.utils';
import {colors} from '../../../../assets/colors';
import Input from '../../../components/Input';
import GButton from '../../../components/GButton';
import GTextButton from '../../../components/GTextButton/GTextButton';
import {setUserData} from '../../../redux/slices/authSlice';
import {useDispatch} from 'react-redux';

const PetBoardingDetails = ({navigation}) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  const [visible, setVisible] = useState(false);
  const [formValue, setFormValue] = useState({
    clinic_name: '',
    vet_name: '',
    address: '',
    city: '',
    country: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
  });
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.headerContainer,
            {marginTop: statusBarHeight + scaledValue(20)},
          ]}>
          <TouchableOpacity
            onPress={() => {
              navigation?.goBack();
            }}
            style={styles.backButton}>
            <Image
              source={Images.Left_Circle_Arrow}
              style={styles.backButtonImage}
            />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <GText
              GrMedium
              text={t('pet_boarding_text_string')}
              style={styles.headerText}
            />
            <GText
              GrMedium
              text={` ${t('details_string')}`}
              style={[
                styles.headerText,
                {
                  color: colors.darkPurple,
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.petProfileContainer}>
          <Image source={Images.Kizi} style={styles.petImg} />
        </View>
        <GText GrMedium text={'Kizie'} style={styles.petName} />
        <GText SatoshiMedium text={'Beagle'} style={styles.breed} />
        <View style={styles.inputView}>
          <Input
            value={formValue.clinic_name}
            label={t('name_string')}
            onChangeText={value =>
              setFormValue({...formValue, clinic_name: value})
            }
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.address}
            label={t('address_string')}
            onChangeText={value => setFormValue({...formValue, address: value})}
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
          <View style={styles.cityMainView}>
            <TouchableOpacity style={styles.cityView}>
              <GText
                SatoshiRegular
                text={t('city_string')}
                style={styles.cityText}
              />
              <Image source={Images.ArrowDown} style={styles.arrowIcon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cityView}>
              <GText
                SatoshiRegular
                text={t('country_string')}
                style={styles.cityText}
              />
              <Image source={Images.ArrowDown} style={styles.arrowIcon} />
            </TouchableOpacity>
          </View>
          <Input
            value={formValue.zip}
            label={t('zip_code_string')}
            onChangeText={value => setFormValue({...formValue, zip: value})}
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.phone}
            label={t('telephone_string')}
            onChangeText={value => setFormValue({...formValue, phone: value})}
            style={styles.inputStyle}
            keyboardType="number-pad"
          />
          <Input
            value={formValue.email}
            label={t('email_address_string')}
            onChangeText={value => setFormValue({...formValue, email: value})}
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.website}
            label={t('website_string')}
            onChangeText={value => setFormValue({...formValue, website: value})}
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
        </View>
        <GTextButton
          onPress={() => {
            setVisible(true);
          }}
          title={t('skip_for_now_string')}
          titleStyle={styles.textButton}
        />
        <GButton
          onPress={() => {
            dispatch(
              setUserData({
                name: 'Yosemite',
              }),
            );
          }}
          title={t('save_details_string')}
          style={styles.buttonStyle}
          textStyle={styles.buttonText}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default PetBoardingDetails;
