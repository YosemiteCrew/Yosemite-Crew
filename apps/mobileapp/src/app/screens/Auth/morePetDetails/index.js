import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useState} from 'react';
import {colors} from '../../../../assets/colors';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {scaledValue} from '../../../utils/design.utils';
import {styles} from './styles';
import Input from '../../../components/Input';
import LinearGradient from 'react-native-linear-gradient';
import {fonts} from '../../../utils/fonts';
import GButton from '../../../components/GButton';
import GTextButton from '../../../components/GTextButton/GTextButton';
import {navigationContainerRef} from '../../../../App';
import {CommonActions} from '@react-navigation/native';
import {useAppSelector} from '../../../redux/store/storeUtils';

const MorePetDetails = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const authState = useAppSelector(state => state.auth);
  const {t} = useTranslation();
  const [selectedId, setSelectedId] = useState(null);
  const [selectPlace, setSelectPlace] = useState(null);
  const handlePress = id => {
    setSelectedId(id);
  };
  const [formValue, setFormValue] = useState({
    age: '',
    microchip_number: '',
    insured: '',
    company: '',
    policy_number: '',
    passport_number: '',
    pert_comes_from: '',
  });

  const insured = [
    {
      id: 1,
      insure: t('insured_string'),
    },
    {
      id: 2,
      insure: t('not_insured_string'),
    },
  ];

  const place = [
    {
      id: 1,
      name: t('breeder_string'),
    },
    {
      id: 2,
      name: t('foster_string'),
    },
    {
      id: 3,
      name: t('pet_shop_string'),
    },
    {
      id: 4,
      name: t('friends_string'),
    },
    {
      id: 5,
      name: t('others_string'),
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.headerContainer,
            {marginTop: statusBarHeight + scaledValue(18)},
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
            <GText GrMedium text={t('more_string')} style={styles.headerText} />
            <GText
              GrMedium
              text={'Beagle'}
              style={styles.headerTextHighlighted}
            />
          </View>
        </View>
        <View style={styles.petProfileContainer}>
          <View style={{}}>
            <Image source={Images.Kizi} style={styles.petImg} />
            <TouchableOpacity style={styles.cameraView}>
              <Image source={Images.ProfileCamera} style={styles.cameraImg} />
            </TouchableOpacity>
          </View>
          <View style={styles.infoView}>
            <GText GrMedium text={'Kizie'} style={styles.petName} />
            <GText SatoshiMedium text={'Beagle'} style={styles.breed} />
            <View style={styles.otherInfoView}>
              <GText SatoshiMedium text={'Female'} style={styles.gender} />
              <View style={styles.pointer} />
              <GText SatoshiMedium text={'3Y'} style={styles.gender} />
              <View style={styles.pointer} />
              <GText SatoshiMedium text={'28 lbs'} style={styles.gender} />
            </View>
          </View>
        </View>
        <View style={styles.inputView}>
          <Input
            value={formValue.age}
            label={t('age_when_neutered_string')}
            onChangeText={value => setFormValue({...formValue, age: value})}
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.microchip_number}
            label={t('microchip_string')}
            onChangeText={value =>
              setFormValue({...formValue, microchip_number: value})
            }
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
          <View style={styles.insuredView}>
            {insured.map((item, index) => (
              <LinearGradient
                key={index}
                style={styles.linear}
                colors={
                  selectedId === item.id
                    ? ['rgba(253, 189, 116, 0.21)', 'rgba(253, 189, 116, 0.07)']
                    : [colors.themeColor, colors.themeColor]
                }>
                <TouchableOpacity
                  onPress={() => {
                    setFormValue({...formValue, insured: item.insure});
                    handlePress(item.id);
                  }}
                  style={[
                    styles.tile,
                    {
                      borderWidth:
                        selectedId === item.id
                          ? scaledValue(1)
                          : scaledValue(0.5),
                      borderColor:
                        selectedId === item.id ? colors.appRed : '#312943',
                    },
                  ]}>
                  <GText
                    text={item.insure}
                    style={[
                      styles.insuredText,
                      {
                        color:
                          selectedId === item.id ? colors.appRed : '#312943',
                        fontFamily:
                          selectedId === item.id
                            ? fonts.SATOSHI_BOLD
                            : fonts.SATOSHI_REGULAR,
                      },
                    ]}
                  />
                </TouchableOpacity>
              </LinearGradient>
            ))}
          </View>
          <TouchableOpacity style={styles.companyTile}>
            <GText
              SatoshiRegular
              text={t('insurance_company_string')}
              style={styles.companyText}
            />
            <Image source={Images.ArrowDown} style={styles.cameraImg} />
          </TouchableOpacity>
          <Input
            value={formValue.policy_number}
            label={t('insurance_policy_string')}
            onChangeText={value =>
              setFormValue({...formValue, policy_number: value})
            }
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.passport_number}
            label={t('passport_string')}
            onChangeText={value =>
              setFormValue({...formValue, passport_number: value})
            }
            style={styles.inputStyle}
            keyboardType={'email-address'}
          />
        </View>
        <GText
          SatoshiBold
          text={t('pet_comes_string')}
          style={styles.titleText}
        />
        <View style={styles.flatListView}>
          <FlatList
            data={place}
            numColumns={3}
            renderItem={({item, index}) => {
              return (
                <LinearGradient
                  key={index}
                  style={styles.linearView}
                  colors={
                    selectPlace === item.id
                      ? [
                          'rgba(253, 189, 116, 0.21)',
                          'rgba(253, 189, 116, 0.07)',
                        ]
                      : [colors.themeColor, colors.themeColor]
                  }>
                  <TouchableOpacity
                    onPress={() => {
                      setFormValue({
                        ...formValue,
                        pert_comes_from: item.name,
                      });
                      setSelectPlace(item.id);
                    }}
                    style={[
                      styles.placeView,
                      {
                        borderWidth:
                          selectPlace === item.id
                            ? scaledValue(1)
                            : scaledValue(0.5),
                        borderColor:
                          selectPlace === item.id ? colors.appRed : '#312943',
                      },
                    ]}>
                    <GText
                      text={item.name}
                      style={[
                        styles.placeText,
                        {
                          color:
                            selectPlace === item.id ? colors.appRed : '#312943',
                          fontFamily:
                            selectPlace === item.id
                              ? fonts.SATOSHI_BOLD
                              : fonts.SATOSHI_REGULAR,
                        },
                      ]}
                    />
                  </TouchableOpacity>
                </LinearGradient>
              );
            }}
          />
        </View>
        <GTextButton
          title={t('skip_for_now_string')}
          titleStyle={styles.textButton}
        />
        <GButton
          onPress={() => {
            if (!authState?.user) {
              navigation?.navigate('PetProfileList');
              // navigationContainerRef?.navigate('MyPetStack');
            } else {
              navigationContainerRef?.navigate('MyPets');
              // navigation.dispatch(
              //   CommonActions.reset({
              //     // index: 1, // Second tab (0-based index)
              //     name: 'MyPets',
              //     routes: [
              //       {name: 'Home'}, // Optional: reset first tab
              //       {name: 'MyPets'}, // Navigate to second tab
              //     ],
              //   }),
              // );
            }
          }}
          title={t('add_pet_string')}
          style={styles.buttonStyle}
          textStyle={styles.buttonText}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default MorePetDetails;
