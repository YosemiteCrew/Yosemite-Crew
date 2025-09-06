import {
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {colors} from '../../../../assets/colors';
import {scaledValue} from '../../../utils/design.utils';
import {Images} from '../../../utils';
import GText from '../../../components/GText/GText';
import Input from '../../../components/Input';
import {useTranslation} from 'react-i18next';
import GButton from '../../../components/GButton';
import DatePicker from 'react-native-date-picker';
import ImagePicker from 'react-native-image-crop-picker';
import {styles} from './styles';
import {openSettings, PERMISSIONS, request} from 'react-native-permissions';
import HeaderButton from '../../../components/HeaderButton';
import horseBreedList from '../../../../assets/horseBreedList.json';
import catBreedList from '../../../../assets/catBreedList.json';
import dogBreedList from '../../../../assets/dogBreedList.json';
import ChoosePetBreed from '../../../components/PetBreed';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import GImage from '../../../components/GImage';
import {showToast} from '../../../components/Toast';

const AddPetDetails = ({navigation, route}) => {
  const {t} = useTranslation();
  const {choosePetData} = route?.params;
  console.log('choosePetDatachoosePetData', JSON.stringify(choosePetData));

  const refRBSheet = useRef();
  const [formValue, setFormValue] = useState({
    name: '',
    dob: '',
    gender: '',
    weight: '',
    color: '',
    pet_breed: '',
    neutered: 'No Neutered',
    neutered_age: '',
  });
  const [date, setDate] = useState('');
  const [image, setImage] = useState();
  const [apiCallImage, setApiCallImage] = useState();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [select, setSelect] = useState();
  const [selectPetBreed, setSelectPetBreed] = useState('');

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
  }, [navigation]);

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const genderOptions = [
    {id: 1, label: t('male_string'), value: 'male'},
    {id: 2, label: t('female_string'), value: 'female'},
  ];

  const neuteredOptions = [
    {id: 1, label: t('neutered_string'), value: 'Yes'},
    {id: 2, label: t('not_neutered_string'), value: 'No'},
  ];

  const handleImagePicker = async () => {
    if (Platform.OS === 'android') {
      const status = await PermissionsAndroid.request(
        'android.permission.READ_MEDIA_IMAGES',
      );
      if (status === 'granted') {
        pickImage();
      } else {
        showPermissionAlert();
      }
    } else {
      const status = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (status === 'granted' || status === 'limited') {
        pickImage();
      } else {
        showPermissionAlert();
      }
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
      setImage(path);
      setApiCallImage({name, uri: path, type: mime});
    });
  };

  const showPermissionAlert = () => {
    Alert.alert(
      'Permission Required',
      'Please grant access to your photos to select an image.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: openSettings},
      ],
    );
  };

  const handleConfirm = () => {
    navigation.navigate('MorePetDetails', {
      choosePetDetail: {
        ...formValue,
        ...choosePetData,
        petImage: image,
        apiCallImage,
        setApiCallImage,
        setImage,
      },
    });
  };

  return (
    <KeyboardAwareScrollView bottomOffset={20} style={styles.container}>
      <TouchableOpacity
        onPress={handleImagePicker}
        style={styles.profileImageContainer(image)}>
        <Image
          source={image ? {uri: image} : Images.importProfile}
          style={styles.profileImage}
        />
      </TouchableOpacity>

      <View style={styles.formContainer}>
        <Input
          value={formValue.name}
          label={t('name_string')}
          onChangeText={value => setFormValue({...formValue, name: value})}
          style={styles.input}
        />

        <TouchableOpacity
          onPress={() => refRBSheet?.current?.open()}
          style={[styles.bloodGroupContainer(formValue.pet_breed)]}>
          <GText
            text={formValue.pet_breed || t('pet_breed_string')}
            style={[styles.bloodGroupText(formValue.pet_breed)]}
          />
          <Image source={Images.ArrowDown} style={styles.bloodGroupIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setOpen(true)}
          style={[styles.datePickerContainer(date)]}>
          <GText
            text={date ? formatDate(date) : t('dob_string')}
            style={[styles.dateText(date)]}
          />
          <Image source={Images.Calender} style={styles.dateIcon} />
        </TouchableOpacity>

        <View style={styles.genderContainer}>
          {genderOptions.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                setFormValue({...formValue, gender: item.label});
                setSelectedId(item.value);
              }}
              style={[styles.genderButton(selectedId, item.value)]}>
              <GText
                text={item.label}
                style={[styles.genderText(selectedId, item.value)]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Input
          value={formValue.weight}
          label={t('current_weight_string')}
          onChangeText={value => setFormValue({...formValue, weight: value})}
          style={styles.input}
          keyboardType="number-pad"
          rightIcon={Images.weightUnit}
          iconStyle={{width: scaledValue(21), height: scaledValue(16)}}
        />

        <Input
          value={formValue.color}
          label={t('color_string')}
          onChangeText={value => setFormValue({...formValue, color: value})}
          style={styles.input}
        />

        <View style={styles.neuteredContainer}>
          {neuteredOptions.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                setFormValue({...formValue, neutered: item.label});
                setSelect(item.value);
              }}
              style={[styles.neuteredButton(select, item?.value)]}>
              <GText
                text={item.label}
                style={[styles.neuteredText(select, item.value)]}
              />
            </TouchableOpacity>
          ))}
        </View>
        {formValue?.neutered === 'Neutered' && (
          <Input
            value={formValue.neutered_age}
            label={t('age_when_neutered_string')}
            keyboardType="number-pad"
            onChangeText={value =>
              setFormValue({...formValue, neutered_age: value})
            }
            style={styles.input}
          />
        )}

        <GButton
          onPress={() => {
            if (
              !formValue?.name ||
              !formValue?.pet_breed ||
              !formValue?.dob ||
              !formValue?.gender ||
              !formValue?.weight ||
              !formValue?.color
            ) {
              showToast(0, 'Please fill all the details.');
            } else if (!apiCallImage) {
              showToast(0, 'Please select an image for your companion.');
            } else {
              handleConfirm();
            }
          }}
          title={t('confirm_button_string')}
          style={styles.createButton}
        />
      </View>

      <DatePicker
        modal
        open={open}
        date={date || new Date()}
        mode="date"
        onConfirm={date => {
          setOpen(false);
          setDate(date);
          setFormValue({...formValue, dob: formatDate(date)});
        }}
        onCancel={() => setOpen(false)}
      />

      <ChoosePetBreed
        refRBSheet={refRBSheet}
        options={
          choosePetData?.petType?.value === 'Cat'
            ? catBreedList
            : choosePetData?.petType?.value === 'Dog'
            ? dogBreedList
            : horseBreedList
        }
        value={selectPetBreed}
        pet={choosePetData?.petType}
        continuePress={() => {
          setFormValue({...formValue, pet_breed: selectPetBreed});
          refRBSheet?.current?.close();
        }}
        onChoose={val => setSelectPetBreed(val)}
      />
    </KeyboardAwareScrollView>
  );
};

export default AddPetDetails;
