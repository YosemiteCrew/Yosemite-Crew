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
import React, {useEffect, useRef, useState} from 'react';
import {colors} from '../../../../assets/colors';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import Input from '../../../components/Input';
import GButton from '../../../components/GButton';
import {useAppSelector} from '../../../redux/store/storeUtils';
import {useDispatch} from 'react-redux';
import {
  add_pet,
  edit_pet_api,
  updatePetList,
} from '../../../redux/slices/petSlice';
import {buildPetFHIRResource} from '../../../helpers/buildPetFHIRResource';
import HeaderButton from '../../../components/HeaderButton';
import {openSettings, PERMISSIONS, request} from 'react-native-permissions';
import ImagePicker from 'react-native-image-crop-picker';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import GImage from '../../../components/GImage';
import OptionMenuSheet from '../../../components/OptionMenuSheet';
import {transformPets} from '../../../helpers/transformPetListData';
import {navigationContainerRef} from '../../../../App';

const EditMorePetDetails = ({navigation, route}) => {
  const {choosePetDetail, petDetails} = route?.params;
  const refRBSheet = useRef();
  console.log('petDetailspetDetails', JSON.stringify(petDetails));
  const [selectCompany, setSelectCompany] = useState('');
  const {t} = useTranslation();
  const authState = useAppSelector(state => state.auth);
  const dispatch = useDispatch();
  const [selectedId, setSelectedId] = useState('Not Insured');
  const [selectPlace, setSelectPlace] = useState(petDetails?.petFrom);
  const petList = useAppSelector(state => state.pets?.petLists);
  const [formValue, setFormValue] = useState({
    microchip_number: petDetails?.microchipNumber || '',
    insured: petDetails?.isInsured || false,
    company: petDetails?.insuranceCompany || '',
    policy_number: petDetails?.policyNumber,
    passport_number: petDetails?.passportNumber || '',
    pet_comes_from: petDetails?.petFrom,
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
      microchipNumber: formValue?.microchip_number?.trim(),
      passportNumber: formValue?.passport_number?.trim(),
      origin: formValue?.pet_comes_from?.trim(),
      isInsured: formValue?.insured,
    };

    if (formValue?.insured) {
      petData.insuranceCompany = formValue?.company?.trim();
      petData.policyNumber = formValue?.policy_number?.trim();
    }

    if (choosePetDetail?.neutered?.trim() === 'Neutered') {
      petData.ageWhenNeutered = choosePetDetail?.neutered_age?.trim();
    }
    const fhirPayload = buildPetFHIRResource(petData);

    const editFhirPayload = {
      data: fhirPayload,
      files: [choosePetDetail?.apiCallImage],
    };
    console.log('editFhirPayload', JSON.stringify(editFhirPayload?.data));

    dispatch(
      edit_pet_api({petId: petDetails?.id, api_credentials: editFhirPayload}),
    ).then(res => {
      if (edit_pet_api.fulfilled.match(res)) {
        if (res.payload?.status === 1) {
          const convertData = transformPets([{resource: res.payload?.data}]);
          dispatch(
            updatePetList(
              petList?.map(item =>
                item?.id === convertData[0]?.id
                  ? {...item, ...convertData[0]}
                  : item,
              ),
            ),
          );
          navigationContainerRef.navigate('TabBar', {
            screen: 'MyPets',
          });
          // navigationContainerRef?.navigate('StackScreens', {
          //   screen: 'PetProfileList',
          // });
        }
      }
    });
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
    {id: 1, insure: t('insured_string'), value: 'Insured'},
    {id: 2, insure: t('not_insured_string'), value: 'Not Insured'},
  ];

  const place = [
    {id: 3, name: t('pet_shop_string'), value: 'Pet Shop'},
    {id: 2, name: t('foster_string'), value: 'Foster/ Shelter'},
    {id: 1, name: t('breeder_string'), value: 'Breeder'},
    {id: 6, name: t('unknown_string'), value: 'Unknown'},
    {id: 4, name: t('friends_string'), value: 'Friends or Family'},
    {id: 5, name: t('others_country_string'), value: 'Other Country'},
  ];

  return (
    <KeyboardAwareScrollView bottomOffset={20} style={styles.container}>
      <View style={styles.petProfileContainer}>
        <View style={styles.petImageContainer}>
          {formValue?.pet_image ? (
            <Image
              source={
                formValue?.pet_image
                  ? {uri: formValue?.pet_image}
                  : Images.importProfile
              }
              style={styles.petImg}
            />
          ) : (
            <GImage image={petDetails?.petImages} style={styles.petImg} />
          )}
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
                setFormValue({
                  ...formValue,
                  insured: item?.value === 'Insured' ? true : false,
                });
                handlePress(item.value);
              }}
              style={styles.tile(selectedId, item.value)}>
              <GText
                text={item.insure}
                style={styles.insuredText(selectedId, item.value)}
              />
            </TouchableOpacity>
          ))}
        </View>
        {formValue?.insured && (
          <>
            <TouchableOpacity
              onPress={() => refRBSheet?.current?.open()}
              style={styles.companyTile(formValue?.company)}>
              <GText
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
                setFormValue({...formValue, pet_comes_from: item.value});
                setSelectPlace(item.value);
              }}
              style={styles.placeView(selectPlace, item.value)}>
              <GText
                text={item.name}
                style={styles.placeText(selectPlace, item.value)}
              />
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.btnView}>
        <GButton
          onPress={() =>
            authState?.user ? addPet() : navigation.navigate('PetProfileList')
          }
          title={t('complete_string')}
        />
      </View>
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        title={'Select Company'}
        options={companyList}
        onChoose={val => {
          setSelectCompany(val);
          setFormValue({...formValue, company: val?.title});
          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </KeyboardAwareScrollView>
  );
};

export default EditMorePetDetails;

const companyList = [
  {
    id: 0,
    title: 'Petplan',
    textColor: '#3E3E3E',
  },
  {
    id: 1,
    title: 'Healthy Paws',
    textColor: '#3E3E3E',
  },
  {
    id: 2,
    title: 'Waggel',
    textColor: '#3E3E3E',
  },
  {
    id: 3,
    title: 'Animal Friends',
    textColor: '#3E3E3E',
  },
  {
    id: 4,
    title: 'Asda',
    textColor: '#3E3E3E',
  },
  {
    id: 5,
    title: 'Direct Line',
    textColor: '#3E3E3E',
  },
  {
    id: 6,
    title: 'Many Pets',
    textColor: '#3E3E3E',
  },
  {
    id: 7,
    title: 'Petsure',
    textColor: '#3E3E3E',
  },
  {
    id: 8,
    title: 'More Than',
    textColor: '#3E3E3E',
  },
];
