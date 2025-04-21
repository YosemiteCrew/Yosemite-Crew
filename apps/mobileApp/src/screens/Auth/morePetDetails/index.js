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
import {useAppSelector} from '../../../redux/store/storeUtils';
import {useDispatch} from 'react-redux';
import {
  add_pet,
  edit_pet_api,
  updatePetList,
} from '../../../redux/slices/petSlice';
import {buildPetFHIRResource} from '../../../helpers/buildPetFHIRResource';

const MorePetDetails = ({navigation, route}) => {
  const {choosePetDetail, petDetails} = route?.params;
  console.log('petDetailspetDetails', petDetails);
  const userPetDetails = petDetails?.extension?.reduce((acc, item) => {
    acc[item.title] = item.valueString;
    return acc;
  }, {});

  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const authState = useAppSelector(state => state.auth);
  const petList = useAppSelector(state => state.pets?.petLists);
  const {t} = useTranslation();
  const [selectedId, setSelectedId] = useState(null);
  const [selectPlace, setSelectPlace] = useState(null);
  const handlePress = id => {
    setSelectedId(id);
  };

  const dispatch = useDispatch();
  const [formValue, setFormValue] = useState({
    age: userPetDetails?.ageWhenNeutered || '',
    microchip_number: userPetDetails?.microChipNumber || '',
    insured: '',
    company: '',
    policy_number: userPetDetails?.policyNumber || '',
    passport_number: userPetDetails?.passportNumber || '',
    pert_comes_from: userPetDetails?.petFrom || '',
  });
  const add_pet_hit = () => {
    let petData = {
      id: authState?.user?._id,
      name: choosePetDetail?.name,
      gender: choosePetDetail?.gender,
      birthDate: choosePetDetail?.dob,
      speciesDisplay: choosePetDetail?.petType,
      breed: choosePetDetail?.petBreed,
      genderStatusDisplay: choosePetDetail?.neutered,
      weight: choosePetDetail?.weight,
      color: choosePetDetail?.color,
      bloodGroup: choosePetDetail?.blood_group,
      ageWhenNeutered: formValue?.age,
      microchipNumber: formValue?.microchip_number,
      insuranceCompany: formValue?.insured,
      policyNumber: formValue?.policy_number,
      passportNumber: formValue?.passport_number,
      origin: formValue?.pert_comes_from,
      isInsured: formValue?.insured,
      // files: choosePetDetail?.petImage,
    };

    const fhirPayload = buildPetFHIRResource(petData);

    const input = {
      petId: petDetails?.id,
      api_credentials: fhirPayload,
    };

    if (petDetails?.id) {
      dispatch(edit_pet_api(input)).then(res => {
        //  if (edit_pet_api.fulfilled.match(res)) {
        //    const updatedBundle = {
        //      ...petList,
        //      total: petList.total + 1,
        //      entry: [res?.payload, ...petList.entry],
        //    };
        //    dispatch(updatePetList(updatedBundle));
        //  }
      });
    } else {
      dispatch(add_pet(fhirPayload)).then(res => {
        if (add_pet.fulfilled.match(res)) {
          const updatedBundle = {
            ...petList,
            total: petList.total + 1,
            entry: [res?.payload, ...petList.entry],
          };
          dispatch(updatePetList(updatedBundle));
        }
      });
    }
  };

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

  const calculateAge = dobString => {
    const dob = new Date(dobString.split('/').reverse().join('-')); // Convert "DD/MM/YYYY" to "YYYY-MM-DD"
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();

    // Adjust if the birth date hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }

    return age;
  };

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
              text={` ${choosePetDetail?.name}`}
              style={styles.headerTextHighlighted}
            />
          </View>
        </View>
        <View style={styles.petProfileContainer}>
          <View style={{}}>
            <Image
              source={
                choosePetDetail?.petImage
                  ? {uri: choosePetDetail?.petImage}
                  : Images.Kizi
              }
              style={styles.petImg}
            />
            <TouchableOpacity style={styles.cameraView}>
              <Image source={Images.ProfileCamera} style={styles.cameraImg} />
            </TouchableOpacity>
          </View>
          <View style={styles.infoView}>
            <GText
              GrMedium
              text={choosePetDetail?.name}
              style={styles.petName}
            />
            <GText
              SatoshiMedium
              text={choosePetDetail?.petBreed}
              style={styles.breed}
            />
            <View style={styles.otherInfoView}>
              <GText
                SatoshiMedium
                text={choosePetDetail?.gender}
                style={styles.gender}
              />
              <View style={styles.pointer} />
              <GText
                SatoshiMedium
                text={`${calculateAge(choosePetDetail?.dob)}Y`}
                style={styles.gender}
              />
              <View style={styles.pointer} />
              <GText
                SatoshiMedium
                text={`${choosePetDetail?.weight} lbs`}
                style={styles.gender}
              />
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
            label={t('passport_number_string')}
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
            } else {
              add_pet_hit();

              // navigationContainerRef?.navigate('MyPets');
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
