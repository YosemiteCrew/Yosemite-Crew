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

const AddPetDetails = ({navigation, route}) => {
  const {choosePetData} = route?.params;

  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  const [selectedId, setSelectedId] = useState(null);
  const refRBSheet = useRef();
  const [date, setDate] = useState('');
  const [apiCallImage, setApiCallImage] = useState();
  const [image, setImage] = useState();
  const [open, setOpen] = useState(false);
  const handlePress = id => {
    setSelectedId(id);
  };

  const [select, setSelected] = useState(null);
  const handlePresshit = id => {
    setSelected(id);
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  const [formValue, setFormValue] = useState({
    name: '',
    dob: date && formatDate(date),
    gender: '',
    weight: '',
    color: '',
    blood_group: '',
    zip: '',
    neutered: '',
    weight: '',
  });
  console.log(formValue?.dob);

  const gender = [
    {
      id: 1,
      gender: t('male_string'),
    },
    {
      id: 2,
      gender: t('female_string'),
    },
  ];
  const neutered = [
    {
      id: 1,
      neutered: t('neutered_string'),
    },
    {
      id: 2,
      neutered: t('not_neutered_string'),
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
                  selectedId === item.id
                    ? ['rgba(253, 189, 116, 0.21)', 'rgba(253, 189, 116, 0.07)']
                    : [colors.themeColor, colors.themeColor]
                }>
                <TouchableOpacity
                  onPress={() => {
                    setFormValue({...formValue, gender: item.gender});
                    handlePress(item.id);
                  }}
                  style={[
                    styles.genderButton,
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
                  select === item.id
                    ? ['rgba(253, 189, 116, 0.21)', 'rgba(253, 189, 116, 0.07)']
                    : [colors.themeColor, colors.themeColor]
                }>
                <TouchableOpacity
                  onPress={() => {
                    setFormValue({...formValue, neutered: item.neutered});
                    handlePresshit(item.id);
                  }}
                  style={[
                    styles.neuteredButton,
                    {
                      borderWidth:
                        select === item.id ? scaledValue(1) : scaledValue(0.5),
                      borderColor:
                        select === item.id ? colors.appRed : '#312943',
                    },
                  ]}>
                  <GText
                    text={item.neutered}
                    style={[
                      styles.neuteredText,
                      {
                        color: select === item.id ? colors.appRed : '#312943',
                        fontFamily:
                          select === item.id
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
              navigation?.navigate('MorePetDetails', {
                choosePetDetail: {
                  ...formValue,
                  ...choosePetData,
                },
              });
            }}
            title={t('confirm_button_string')}
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
            setDate(date);
            setFormValue({...formValue, dob: formatDate(date)});
          }}
          onCancel={() => setOpen(false)}
        />
      </ScrollView>
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        title={'Select Blood Group'}
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
