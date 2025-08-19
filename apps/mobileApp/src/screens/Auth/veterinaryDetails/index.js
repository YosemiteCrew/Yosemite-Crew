import {
  FlatList,
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
import {useDispatch} from 'react-redux';
import HeaderButton from '../../../components/HeaderButton';
import GImage from '../../../components/GImage';

const VeterinaryDetails = ({navigation, route}) => {
  const {petDetails} = route?.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <>
          <Input
            // value={}
            label={t('search_hospital_clinic_string')}
            onChangeText={value => setFormValue({...formValue, weight: value})}
            style={styles.input}
            rightIcon={Images.Search}
            iconStyle={{width: scaledValue(20), height: scaledValue(20)}}
          />
          <Image
            source={Images.add_vet}
            style={{
              width: scaledValue(188.71),
              height: scaledValue(201.25),
              alignSelf: 'center',
              marginTop: scaledValue(16),
            }}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: scaledValue(8),
              borderWidth: scaledValue(1),
              paddingHorizontal: scaledValue(28),
              paddingVertical: scaledValue(17),
              borderRadius: scaledValue(28),
              width: scaledValue(208),
              alignSelf: 'center',
            }}>
            <Image
              source={Images.Scan}
              style={{width: scaledValue(20), height: scaledValue(20)}}
            />
            <GText GrMedium text={t('scan_pms_string')} />
          </TouchableOpacity>
          <View
            style={{
              flexDirection: 'row',
              width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: scaledValue(30),
              gap: scaledValue(18),
            }}>
            <View
              style={{
                height: scaledValue(1),
                backgroundColor: colors.black,
                flex: 1,
              }}
            />
            <GText
              GrMedium
              text={t('send_or_invite_string')}
              style={styles.sendText}
            />
            <View
              style={{
                height: scaledValue(1),
                backgroundColor: colors.black,
                flex: 1,
              }}
            />
          </View>
          <View style={styles.inputView}>
            <Input
              value={formValue.clinic_name}
              label={t('clinic_name_string')}
              onChangeText={value =>
                setFormValue({...formValue, clinic_name: value})
              }
              style={styles.inputStyle}
              keyboardType={'email-address'}
            />
            <Input
              value={formValue.vet_name}
              label={t('vet_name_string')}
              onChangeText={value =>
                setFormValue({...formValue, vet_name: value})
              }
              style={styles.inputStyle}
              keyboardType={'email-address'}
            />
            <Input
              value={formValue.address}
              label={t('clinic_address_string')}
              onChangeText={value =>
                setFormValue({...formValue, address: value})
              }
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
              keyboardType="number-pad"
            />
            <Input
              value={formValue.email}
              label={t('email_address_string')}
              onChangeText={value => setFormValue({...formValue, email: value})}
              style={styles.inputStyle}
              keyboardType={'email-address'}
            />
          </View>
          <View
            style={{
              marginBottom: insets.bottom + scaledValue(40),
              alignSelf: 'center',
              width: '100%',
              marginTop: scaledValue(44),
            }}>
            <GButton
              onPress={() =>
                navigation.navigate('StackScreens', {
                  screen: authState?.user ? 'ChooseYourPet' : 'PetSummary',
                })
              }
              title={t('add_new_pet_string')}
              icon={Images?.tickImage}
              iconStyle={styles.iconStyle}
              style={styles.buttonStyle}
            />
          </View>
        </>
        <View style={styles.petImageWrapper}>
          <GImage
            image={petDetails?.petImage?.url}
            style={styles.petImg}
            noImageSource={Images.Kizi}
          />
        </View>
        <GText GrMedium text={'Kizie'} style={styles.petName} />
        <GText SatoshiMedium text={'Beagle'} style={styles.breed} />
        <FlatList
          data={[1, 2]}
          contentContainerStyle={{
            marginTop: scaledValue(24),
            gap: scaledValue(24),
          }}
          renderItem={({item, index}) => {
            return (
              <View
                style={{
                  borderWidth: scaledValue(1),
                  borderColor: '#EAEAEA',
                  borderRadius: scaledValue(24),
                  paddingVertical: scaledValue(12),
                  paddingHorizontal: scaledValue(12),
                  width: '100%',
                }}>
                <View style={{flexDirection: 'row', gap: scaledValue(8)}}>
                  <GImage
                    image={petDetails?.petImage?.url}
                    style={{
                      width: scaledValue(88),
                      height: scaledValue(88),
                      borderRadius: scaledValue(12),
                    }}
                    noImageSource={Images.Kizi}
                  />
                  <View
                    style={{
                      gap: scaledValue(2),
                      flexWrap: 'wrap',
                    }}>
                    <GText
                      GrMedium
                      text={'Dr. Emily Johnson'}
                      style={{letterSpacing: scaledValue(18 * -0.02)}}
                    />
                    <GText
                      SatoshiBold
                      text={'Cardiology'}
                      style={{
                        letterSpacing: scaledValue(14 * -0.02),
                        fontSize: scaledValue(14),
                        color: colors.jetBlack300,
                      }}
                    />
                    <GText
                      SatoshiBold
                      componentProps={{
                        numberOfLines: 2,
                      }}
                      text={'San Francisco Animal Medical Center'}
                      style={{
                        letterSpacing: scaledValue(14 * -0.02),
                        fontSize: scaledValue(14),
                        color: colors.jetBlack300,
                        flexWrap: 'wrap',
                        width: '85%',
                      }}
                    />
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: '84%',
                      }}>
                      <GText
                        text={'SFAM Building 36 square D Road SanFrancisco '}
                        style={{
                          letterSpacing: scaledValue(13 * -0.02),
                          fontSize: scaledValue(13),
                          // flexWrap: 'wrap',
                          width: '70%',
                          // backgroundColor: 'blue',
                        }}
                      />
                      <TouchableOpacity>
                        <Image
                          source={Images.arrowSquare}
                          style={{
                            width: scaledValue(20),
                            height: scaledValue(20),
                          }}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <GButton
                  onPress={() =>
                    navigation.navigate('StackScreens', {
                      screen: authState?.user ? 'ChooseYourPet' : 'PetSummary',
                    })
                  }
                  title={t('create_appointment_string')}
                  icon={Images?.add_plus}
                  iconStyle={[styles.iconStyle]}
                  textStyle={{color: colors.jetBlack}}
                  style={{
                    backgroundColor: 'transparent',
                    borderWidth: scaledValue(1),
                    marginTop: scaledValue(10),
                    gap: scaledValue(8),
                  }}
                />
                <GButton
                  onPress={() =>
                    navigation.navigate('StackScreens', {
                      screen: authState?.user ? 'ChooseYourPet' : 'PetSummary',
                    })
                  }
                  title={t('chat_string')}
                  icon={Images?.chat_like}
                  iconStyle={[styles.iconStyle]}
                  textStyle={{color: colors.jetBlack}}
                  style={{
                    backgroundColor: 'transparent',
                    borderWidth: scaledValue(1),
                    marginTop: scaledValue(10),
                    gap: scaledValue(8),
                  }}
                />
              </View>
            );
          }}
        />
        <GButton
          onPress={() =>
            navigation.navigate('StackScreens', {
              screen: authState?.user ? 'ChooseYourPet' : 'PetSummary',
            })
          }
          title={t('add_pet_string')}
          icon={Images?.PlusIcon}
          iconStyle={[styles.iconStyle]}
          style={{
            gap: scaledValue(8),
            marginTop: scaledValue(24),
            marginBottom: scaledValue(47),
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default VeterinaryDetails;
