import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import {colors} from '../../../../assets/colors';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import Input from '../../../components/Input';
import GButton from '../../../components/GButton';
import {useAppSelector} from '../../../redux/store/storeUtils';
import {useDispatch} from 'react-redux';
import {add_pet, edit_pet_api} from '../../../redux/slices/petSlice';
import {buildPetFHIRResource} from '../../../helpers/buildPetFHIRResource';
import HeaderButton from '../../../components/HeaderButton';
import {openSettings, PERMISSIONS, request} from 'react-native-permissions';
import ImagePicker from 'react-native-image-crop-picker';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';

const MorePetDetails = ({navigation, route}) => {
  const {choosePetDetail} = route?.params;

  const {t} = useTranslation();
  const authState = useAppSelector(state => state.auth);
  const dispatch = useDispatch();
  const [selectedId, setSelectedId] = useState(null);
  const [selectPlace, setSelectPlace] = useState(null);

  const [formValue, setFormValue] = useState({
    age: '',
    microchip_number: '',
    insured: '',
    company: '',
    policy_number: '',
    passport_number: '',
    pet_comes_from: '',
    country: '',
    pet_image: choosePetDetail?.petImage || '',
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
      headerTitle: () => (
        <View style={styles.headerTextContainer}>
          <GText GrMedium text={t('more_string')} style={styles.headerText} />
          <GText
            GrMedium
            text={` ${choosePetDetail?.name}`}
            style={styles.headerText}
          />
        </View>
      ),
    });
  }, [navigation]);

  const handlePress = id => setSelectedId(id);

  const calculateAge = dobString => {
    const dob = new Date(dobString.split('/').reverse().join('-'));
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) {
      age--;
    }
    return age;
  };

  const addPet = () => {
    const [day, month, year] = choosePetDetail?.dob.split('/');
    const formattedDate = `${year}/${month}/${day}`;
    const petData = {
      id: authState?.user?._id,
      name: choosePetDetail?.name?.trim(),
      gender: choosePetDetail?.gender?.trim(),
      birthDate: formattedDate,
      speciesDisplay: choosePetDetail?.petType,
      breed: choosePetDetail?.pet_breed?.trim(),
      genderStatusDisplay: choosePetDetail?.neutered?.trim(),
      weight: choosePetDetail?.weight?.trim(),
      color: choosePetDetail?.color?.trim(),
      ageWhenNeutered: choosePetDetail?.neutered_age?.trim(),
      microchipNumber: formValue?.microchip_number?.trim(),
      insuranceCompany: formValue?.insured?.trim(),
      policyNumber: formValue?.policy_number?.trim(),
      passportNumber: formValue?.passport_number?.trim(),
      origin: formValue?.pet_comes_from?.trim(),
      isInsured: formValue?.insured?.trim(),
    };
    const fhirPayload = buildPetFHIRResource(petData);
    const apiData = {data: fhirPayload, files: [choosePetDetail?.apiCallImage]};

    dispatch(add_pet(apiData));
  };

  const handleImagePicker = async () => {
    if (Platform.OS === 'android') {
      const status = await PermissionsAndroid.request(
        'android.permission.READ_MEDIA_IMAGES',
      );
      if (status === 'granted') pickImage();
      else showPermissionAlert();
    } else {
      const status = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (status === 'granted' || status === 'limited') pickImage();
      else showPermissionAlert();
    }
  };

  const pickImage = () => {
    ImagePicker.openPicker({
      width: 800,
      height: 800,
      cropping: false,
      compressImageMaxHeight: 800,
      compressImageMaxWidth: 800,
    }).then(image => {
      const name =
        Platform.OS === 'android'
          ? image.path.substring(image.path.lastIndexOf('/') + 1)
          : image.filename;
      const {path, mime} = image;
      setFormValue({...formValue, pet_image: path});
      choosePetDetail?.setImage(path);
      choosePetDetail?.setApiCallImage({name, uri: path, type: mime});
    });
  };

  const showPermissionAlert = () => {
    Alert.alert('Permission Required', 'Please grant access to your photos.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Open Settings', onPress: openSettings},
    ]);
  };

  const insured = [
    {id: 1, insure: t('insured_string')},
    {id: 2, insure: t('not_insured_string')},
  ];

  const place = [
    {id: 3, name: t('pet_shop_string')},
    {id: 2, name: t('foster_string')},
    {id: 1, name: t('breeder_string')},
    {id: 6, name: t('unknown_string')},
    {id: 4, name: t('friends_string')},
    {id: 5, name: t('others_country_string')},
  ];

  return (
    <KeyboardAwareScrollView bottomOffset={20} style={styles.container}>
      <View style={styles.petProfileContainer}>
        <View style={styles.petImageContainer}>
          <Image
            source={
              formValue?.pet_image ? {uri: formValue?.pet_image} : Images.Kizi
            }
            style={styles.petImg}
          />

          <TouchableOpacity
            onPress={handleImagePicker}
            style={styles.cameraView}>
            <Image source={Images.ProfileCamera} style={styles.cameraImg} />
          </TouchableOpacity>
        </View>
        <View style={styles.infoView}>
          <GText GrMedium text={choosePetDetail?.name} style={styles.petName} />
          <GText
            SatoshiMedium
            text={choosePetDetail?.pet_breed}
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
          value={formValue.microchip_number}
          label={t('microchip_string')}
          onChangeText={value =>
            setFormValue({...formValue, microchip_number: value})
          }
          style={styles.inputStyle}
        />
        <Input
          value={formValue.passport_number}
          label={t('passport_string')}
          onChangeText={value =>
            setFormValue({...formValue, passport_number: value})
          }
          style={styles.inputStyle}
        />
        <View style={styles.insuredView}>
          {insured.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                setFormValue({...formValue, insured: item.insure});
                handlePress(item.id);
              }}
              style={styles.tile(selectedId, item.id)}>
              <GText
                text={item.insure}
                style={styles.insuredText(selectedId, item.id)}
              />
            </TouchableOpacity>
          ))}
        </View>
        {formValue?.insured === t('insured_string') && (
          <>
            <TouchableOpacity
              onPress={() => refRBSheet?.current?.open()}
              style={styles.companyTile}>
              <GText
                SatoshiRegular
                text={formValue?.company || t('insurance_company_string')}
                style={styles.companyText(formValue?.company)}
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
            />
          </>
        )}
      </View>

      <GText
        SatoshiBold
        text={t('pet_comes_string')}
        style={styles.titleText}
      />

      <View style={styles.flatListView}>
        <FlatList
          data={place}
          contentContainerStyle={{flexWrap: 'wrap', flexDirection: 'row'}}
          renderItem={({item}) => (
            <TouchableOpacity
              onPress={() => {
                setFormValue({...formValue, pet_comes_from: item.name});
                setSelectPlace(item.id);
              }}
              style={styles.placeView(selectPlace, item.id)}>
              <GText
                text={item.name}
                style={styles.placeText(selectPlace, item.id)}
              />
            </TouchableOpacity>
          )}
        />
      </View>

      {/* <View style={styles.countrySelectView}>
        <TouchableOpacity style={styles.companyTile}>
          <GText
            SatoshiRegular
            text={t('choose_country_string')}
            style={styles.companyText(formValue?.country)}
          />
          <Image source={Images.ArrowDown} style={styles.cameraImg} />
        </TouchableOpacity>
      </View> */}

      <View style={styles.btnView}>
        <GButton
          onPress={() =>
            authState?.user ? addPet() : navigation.navigate('PetProfileList')
          }
          title={t('complete_string')}
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

export default MorePetDetails;
