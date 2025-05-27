import {
  Alert,
  Image,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useRef, useState} from 'react';
import {colors} from '../../../../assets/colors';
import {scaledValue} from '../../../utils/design.utils';
import {Images} from '../../../utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import Input from '../../../components/Input';
import {useTranslation} from 'react-i18next';
import {fonts} from '../../../utils/fonts';
import LinearGradient from 'react-native-linear-gradient';
import GButton from '../../../components/GButton';
import DatePicker from 'react-native-date-picker';
import ImagePicker from 'react-native-image-crop-picker';
import {styles} from './styles';
import {openSettings, PERMISSIONS, request} from 'react-native-permissions';
import OptionMenuSheet from '../../../components/OptionMenuSheet';
import {add_pet} from '../../../redux/slices/petSlice';
import {useAppDispatch, useAppSelector} from '../../../redux/store/storeUtils';
import {buildPetFHIRResource} from '../../../helpers/buildPetFHIRResource';

const AddPetDetails = ({navigation, route}) => {
  const {choosePetData, petDetails} = route?.params;
  // console.log('petDetails', petDetails);
  const authState = useAppSelector(state => state.auth);
  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  const dateFormat = dateStr => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  const [selectedId, setSelectedId] = useState(petDetails?.gender);
  const refRBSheet = useRef();
  const [date, setDate] = useState('');
  const [apiCallImage, setApiCallImage] = useState();
  const [image, setImage] = useState();
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const handlePress = id => {
    setSelectedId(id);
  };

  const capitalizeFirstLetter = str => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const userPetDetails = petDetails?.extension?.reduce((acc, item) => {
    acc[item.title] = item.valueString;
    return acc;
  }, {});

  console.log(
    'userPetDetails?.petCurrentWeight',
    userPetDetails?.petCurrentWeight,
  );

  const [select, setSelected] = useState(userPetDetails?.isNeutered);
  const handlePresshit = id => {
    setSelected(id);
  };

  const [formValue, setFormValue] = useState({
    name: petDetails?.name[0]?.text || '',
    dob: dateFormat(petDetails?.birthDate) || (date && formatDate(date)),
    gender: capitalizeFirstLetter(petDetails?.gender),
    weight: userPetDetails?.petCurrentWeight,
    color: userPetDetails?.petColor,
    blood_group: userPetDetails?.petBloodGroup,
    zip: '',
    neutered: '',
  });
  // console.log(formValue?.dob);
  console.log(select);

  const gender = [
    {
      id: 1,
      gender: t('male_string'),
      value: 'male',
    },
    {
      id: 2,
      gender: t('female_string'),
      value: 'female',
    },
  ];
  const neutered = [
    {
      id: 1,
      neutered: t('neutered_string'),
      value: 'Yes',
    },
    {
      id: 2,
      neutered: t('not_neutered_string'),
      value: 'No',
    },
  ];

  const handlePicker = async () => {
    if (Platform.OS == 'android') {
      const status = await PermissionsAndroid.request(
        'android.permission.READ_MEDIA_IMAGES',
      );

      if (
        status === 'granted' ||
        status === 'unavailable' ||
        status === 'never_ask_again'
      ) {
        console.log('underGranted');

        ImagePicker.openPicker({
          width: 800,
          height: 800,
          cropping: false,
          compressImageMaxHeight: 800,
          compressImageMaxWidth: 800,
          // mediaType: 'photo',
        })
          .then(image => {
            let name =
              Platform.OS == 'android'
                ? image?.path.substring(image?.path.lastIndexOf('/') + 1)
                : image?.filename;
            let type = image?.mime;
            let localUri = image?.path;
            console.log('herherhehher000', image);
            setImage(image?.path);
            setApiCallImage({name, uri: localUri, type});
          })
          .catch(error => {
            console.error('Error opening picker:', error);
          });
        console.log('Permission granted');
      } else if (status === 'denied' || status === 'blocked') {
        Alert.alert(
          'Permission Blocked',
          'Please grant permission to access photos in order to select an image.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => console.log('cancel'),
            },
            {
              text: 'Open Settings',
              onPress: () => openSettings(),
            },
          ],
        );
      }
    } else {
      const status = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (status === 'granted' || status === 'limited') {
        ImagePicker.openPicker({
          width: 800,
          height: 800,
          cropping: false,
          compressImageMaxHeight: 800,
          compressImageMaxWidth: 800,
          mediaType: 'photo',
        }).then(image => {
          console.log('imagePickertss', image);
          let name =
            Platform.OS == 'android'
              ? image?.path.substring(image?.path.lastIndexOf('/') + 1)
              : image?.filename;
          let type = image?.mime;
          let localUri = image?.path;
          setImage(image?.path);
          setApiCallImage({name, uri: localUri, type});
        });
      } else if (status === 'denied') {
        Alert.alert(
          'Permission Denied',
          'Please grant permission to access photos in order to select an image.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => console.log('cancel'),
            },
            {
              text: 'Open Settings',
              onPress: () => openSettings(),
            },
          ],
        );
      } else if (status === 'blocked') {
        Alert.alert(
          'Permission Blocked',
          'Please grant permission to access photos in order to select an image.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => console.log('cancel'),
            },
            {
              text: 'Open Settings',
              onPress: () => openSettings(),
            },
          ],
        );
      }
    }
  };

  const add_pet_hit = () => {
    // console.log('choosePetDetail?.dob', choosePetDetail?.dob);
    const inputDate = formValue?.dob;
    const [day, month, year] = inputDate.split('/');
    const formattedDate = `${year}/${month}/${day}`;

    let petData = {
      id: authState?.user?._id,
      name: formValue?.name,
      gender: formValue?.gender,
      birthDate: formattedDate,
      speciesDisplay: choosePetData?.petType,
      breed: choosePetData?.petBreed,
      genderStatusDisplay: formValue?.neutered,
      weight: formValue?.weight,
      color: formValue?.color,
      bloodGroup: formValue?.blood_group,
      ageWhenNeutered: '',
      microchipNumber: '',
      insuranceCompany: '',
      policyNumber: '',
      passportNumber: '',
      origin: '',
      isInsured: '',
    };

    const fhirPayload = buildPetFHIRResource(petData);

    const api_credentials = {
      data: fhirPayload,
      files: [apiCallImage],
    };

    dispatch(add_pet(api_credentials)).then(res => {
      if (add_pet.fulfilled.match(res)) {
        const updatedBundle = {
          ...petList,
          total: petList.total + 1,
          entry: [res?.payload, ...petList.entry],
        };
        // dispatch(updatePetList(updatedBundle));
      }
    });
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
            <GText
              GrMedium
              text={t('more_about_string')}
              style={styles.headerText}
            />
            <GText
              GrMedium
              componentProps={{
                numberOfLines: 1,
              }}
              text={choosePetData?.petBreed}
              style={styles.headerTextHighlighted}
            />
          </View>
        </View>
        <TouchableOpacity
          onPress={handlePicker}
          style={styles.profileImageContainer}>
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
            keyboardType={'email-address'}
          />
          <TouchableOpacity
            onPress={() => setOpen(true)}
            style={[
              styles.datePickerContainer,
              {
                borderWidth: date ? scaledValue(1) : scaledValue(0.5),
                borderColor: date ? colors.primary : '#312943',
              },
            ]}>
            <GText
              text={date ? formatDate(date) : t('dob_string')}
              style={[
                styles.dateText,
                {
                  fontFamily: date
                    ? fonts?.SATOSHI_MEDIUM
                    : fonts?.SATOSHI_REGULAR,
                },
              ]}
            />
            <Image source={Images.Calender} style={styles.dateIcon} />
          </TouchableOpacity>
          <View style={styles.genderContainer}>
            {gender.map((item, index) => (
              <LinearGradient
                key={index}
                style={styles.genderItem}
                colors={
                  selectedId === item.value
                    ? ['rgba(253, 189, 116, 0.21)', 'rgba(253, 189, 116, 0.07)']
                    : [colors.themeColor, colors.themeColor]
                }>
                <TouchableOpacity
                  onPress={() => {
                    setFormValue({...formValue, gender: item.gender});
                    handlePress(item.value);
                  }}
                  style={[
                    styles.genderButton,
                    {
                      borderWidth:
                        selectedId === item.value
                          ? scaledValue(1)
                          : scaledValue(0.5),
                      borderColor:
                        selectedId === item.value ? colors.appRed : '#312943',
                    },
                  ]}>
                  <GText
                    text={item.gender}
                    style={[
                      styles.genderText,
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
          <Input
            value={formValue.weight}
            label={t('current_weight_string')}
            onChangeText={value => setFormValue({...formValue, weight: value})}
            style={styles.input}
            maxLength={6}
            keyboardType="number-pad"
          />

          <Input
            value={formValue.color}
            label={t('color_string')}
            onChangeText={value => setFormValue({...formValue, color: value})}
            style={styles.input}
            keyboardType={'default'}
          />
          <TouchableOpacity
            onPress={() => {
              refRBSheet?.current?.open();
            }}
            style={[
              styles.bloodGroupContainer,
              {
                borderWidth: formValue?.blood_group
                  ? scaledValue(1)
                  : scaledValue(0.5),
                borderColor: formValue?.blood_group
                  ? colors.primary
                  : '#312943',
              },
            ]}>
            <GText
              SatoshiRegular
              text={formValue?.blood_group || t('blood_group_string')}
              style={[
                styles.bloodGroupText,
                {
                  fontFamily: formValue?.blood_group
                    ? fonts.SATOSHI_MEDIUM
                    : fonts.SATOSHI_REGULAR,
                },
              ]}
            />
            <Image source={Images.ArrowDown} style={styles.bloodGroupIcon} />
          </TouchableOpacity>
          <View style={styles.neuteredContainer}>
            {neutered.map((item, index) => (
              <LinearGradient
                key={index}
                style={styles.neuteredItem}
                colors={
                  select === item.value
                    ? ['rgba(253, 189, 116, 0.21)', 'rgba(253, 189, 116, 0.07)']
                    : [colors.themeColor, colors.themeColor]
                }>
                <TouchableOpacity
                  onPress={() => {
                    setFormValue({...formValue, neutered: item.neutered});
                    handlePresshit(item.value);
                  }}
                  style={[
                    styles.neuteredButton,
                    {
                      borderWidth:
                        select === item.value
                          ? scaledValue(1)
                          : scaledValue(0.5),
                      borderColor:
                        select === item.value ? colors.appRed : '#312943',
                    },
                  ]}>
                  <GText
                    text={item.neutered}
                    style={[
                      styles.neuteredText,
                      {
                        color:
                          select === item.value ? colors.appRed : '#312943',
                        fontFamily:
                          select === item.value
                            ? fonts.SATOSHI_BOLD
                            : fonts.SATOSHI_REGULAR,
                      },
                    ]}
                  />
                </TouchableOpacity>
              </LinearGradient>
            ))}
          </View>
          <GButton
            onPress={() => {
              if (select === 'Yes') {
                navigation?.navigate('MorePetDetails', {
                  choosePetDetail: {
                    ...formValue,
                    ...choosePetData,
                    petImage: image,
                    apiCallImage: apiCallImage,
                  },
                  petDetails: petDetails,
                });
              } else {
                add_pet_hit();
              }
            }}
            title={
              select === 'Yes'
                ? t('confirm_button_string')
                : t('add_pet_string')
            }
            style={styles.createButton}
            textStyle={styles.createButtonText}
          />
        </View>
        <DatePicker
          modal
          open={open}
          date={date || new Date()}
          mode="date"
          onConfirm={date => {
            setOpen(false);
            console.log('1234567890', date);

            setDate(date);
            setFormValue({...formValue, dob: formatDate(date)});
          }}
          onCancel={() => setOpen(false)}
        />
      </ScrollView>
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        title={formValue?.blood_group || 'Select Blood Group'}
        options={groupList}
        onChoose={val => {
          setFormValue({...formValue, blood_group: val?.title});
          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </KeyboardAvoidingView>
  );
};

export default AddPetDetails;

const groupList = [
  {
    id: 0,
    title: 'DEA 1',
    textColor: '#3E3E3E',
  },
  {
    id: 1,
    title: 'DEA 3',
    textColor: '#3E3E3E',
  },
  {
    id: 2,
    title: 'DEA 4',
    textColor: '#3E3E3E',
  },
  {
    id: 3,
    title: 'DEA 5',
    textColor: '#3E3E3E',
  },
  {
    id: 4,
    title: 'DEA 7',
    textColor: '#3E3E3E',
  },
];
