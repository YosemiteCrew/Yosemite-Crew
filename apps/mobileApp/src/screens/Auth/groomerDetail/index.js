import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
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
import {useDispatch} from 'react-redux';
import {setUserData} from '../../../redux/slices/authSlice';
import GImage from '../../../components/GImage';
import HeaderButton from '../../../components/HeaderButton';

const GroomerDetails = ({navigation, route}) => {
  const {petDetails} = route?.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();

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
  }, [navigation, t]);
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
        <View style={styles.petImageWrapper}>
          <GImage
            image={petDetails?.petImage?.url}
            style={styles.petImg}
            noImageSource={Images.Kizi}
          />
        </View>
        <GText GrMedium text={'Kizie'} style={styles.petName} />
        <GText SatoshiMedium text={'Beagle'} style={styles.breed} />
        <View style={styles.inputView}>
          <Input
            value={formValue.clinic_name}
            label={t('breeder_name_string')}
            onChangeText={value =>
              setFormValue({...formValue, clinic_name: value})
            }
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.address}
            label={t('breeder_address_string')}
            onChangeText={value => setFormValue({...formValue, address: value})}
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />

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
            keyboardType={'number-pad'}
          />
          <Input
            value={formValue.email}
            label={t('email_address_string')}
            onChangeText={value => setFormValue({...formValue, email: value})}
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
        </View>

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
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default GroomerDetails;
