import {View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {colors} from '../../../../assets/colors';
import Input from '../../../components/Input';
import GButton from '../../../components/GButton';
import {setUserData} from '../../../redux/slices/authSlice';
import {useDispatch} from 'react-redux';
import GImage from '../../../components/GImage';
import HeaderButton from '../../../components/HeaderButton';
import GooglePlacesInput from '../../../components/GooglePlacesInput';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import useDataFactory from '../../../components/UseDataFactory/useDataFactory';
import {parseOrganizations} from '../../../helpers/parseOrganizations';
import Spinner from 'react-native-loading-spinner-overlay';
import {scaledValue} from '../../../utils/design.utils';

const PetBoardingDetails = ({navigation, route}) => {
  const {petData} = route?.params;
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

  const [formValue, setFormValue] = useState({
    clinic_name: '',
    addressLine1: '',
    address: '',
    city: '',
    country: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
  });

  const {
    loading,
    data,
    setData,
    extraData,
    refreshData,
    loadMore,
    Placeholder,
    Loader,
  } = useDataFactory(
    'getPetBoardingDetails',
    false,
    {
      petId: petData?.id,
    },
    'GET',
  );

  const petBoardingData = parseOrganizations(data?.data);

  const petBoardingDetails = [
    {
      label: 'Breeder’s Business Name:',
      value: petBoardingData[0]?.name || 'N/A',
    },
    {label: 'Email Address:', value: petBoardingData[0]?.email || 'N/A'},
    {label: 'Website:', value: petBoardingData[0]?.website || 'N/A'},
    {label: 'Phone number:', value: petBoardingData[0]?.phone || 'N/A'},
    {label: 'City:', value: petBoardingData[0]?.city || 'N/A'},
    {label: 'Address:', value: petBoardingData[0]?.address || 'N/A'},
  ];

  return (
    <KeyboardAwareScrollView bottomOffset={20} style={styles.container}>
      <GImage
        image={petData?.petImages}
        style={styles.petImg}
        noImageSource={Images.Kizi}
      />
      <GText GrMedium text={petData?.name} style={styles.petName} />
      <GText SatoshiMedium text={petData?.breed} style={styles.breed} />
      {!loading && (
        <>
          {petBoardingData?.length > 0 ? (
            <View style={styles.card}>
              {petBoardingDetails.map((item, index) => {
                return (
                  <>
                    <View style={styles.row()}>
                      <GText
                        SatoshiBold
                        text={item?.label}
                        style={styles.label}
                      />
                      <GText
                        componentProps={
                          item?.label !== 'Address:' && {
                            numberOfLines: 1,
                            ellipsizeMode: 'tail',
                          }
                        }
                        SatoshiBold
                        text={item?.value}
                        style={[
                          styles.value,
                          {
                            // textAlign: label !== 'Address:' ? 'right' : 'left',
                          },
                        ]}
                      />
                    </View>
                    {index !== petBoardingDetails?.length - 1 && (
                      <View
                        style={{
                          height: scaledValue(1),
                          backgroundColor: colors.jetBlack50,
                        }}
                      />
                    )}
                  </>
                );
              })}
            </View>
          ) : (
            <>
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
                  value={formValue.email}
                  label={t('email_address_string')}
                  onChangeText={value =>
                    setFormValue({...formValue, email: value})
                  }
                  style={styles.inputStyle}
                  keyboardType={'email-address'}
                />
                <Input
                  value={formValue.website}
                  label={t('website_string')}
                  onChangeText={value =>
                    setFormValue({...formValue, website: value})
                  }
                  style={styles.inputStyle}
                  keyboardType={'email-address'}
                />
                <Input
                  value={formValue.phone}
                  label={t('telephone_string')}
                  onChangeText={value =>
                    setFormValue({...formValue, phone: value})
                  }
                  style={styles.inputStyle}
                  keyboardType={'number-pad'}
                />
                <GooglePlacesInput
                  label="Groomer’s Address (optional)"
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
                      country: details?.country,
                    });
                  }}
                />
                <View style={styles.cityZipContainer(formValue.addressLine1)}>
                  <Input
                    value={formValue.city}
                    multiline={false}
                    label={t('city_string')}
                    onChangeText={value =>
                      setFormValue({...formValue, city: value})
                    }
                    style={styles.cityInput}
                  />
                  <Input
                    value={formValue.country}
                    label={t('country_string')}
                    onChangeText={value =>
                      setFormValue({...formValue, country: value})
                    }
                    style={styles.zipInput}
                    keyboardType="phone-pad"
                  />
                </View>
                <Input
                  value={formValue.postal_code}
                  label={t('postal_code_string')}
                  onChangeText={value =>
                    setFormValue({...formValue, postal_code: value})
                  }
                  style={[
                    styles.inputStyle,
                    {
                      opacity: formValue?.addressLine1 ? 1 : 0.4,
                    },
                  ]}
                  keyboardType="phone-pad"
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
            </>
          )}
        </>
      )}
      <Spinner visible={loading} />
    </KeyboardAwareScrollView>
  );
};

export default PetBoardingDetails;
