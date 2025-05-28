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
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import {scaledValue} from '../../../../../utils/design.utils';
import PetRecordCard from '../../../../../components/PetRecordCard';
import {Divider} from 'react-native-paper';
import OptionalEntriesCard from './OptionalEntriesCard';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import GImage from '../../../../../components/GImage';
import LinearGradient from 'react-native-linear-gradient';
import ImagePicker from 'react-native-image-crop-picker';
import {openSettings, PERMISSIONS, request} from 'react-native-permissions';
import {add_diabetes_record_api} from '../../../../../redux/slices/diabetesSlice';
import {useAppDispatch} from '../../../../../redux/store/storeUtils';
import {buildDiabetesObservation} from '../../../../../helpers/buildPetDiabetesFHIR';

const AddNewRecord1 = ({navigation, route}) => {
  const {dateTime, petDetail} = route?.params?.data;
  const refRBSheet = useRef();
  const dispatch = useAppDispatch();
  const refRBSheetFoodIntake = useRef();
  const refRBSheetActivityLevel = useRef();
  const refRBSheetUrinationLevel = useRef();
  const refRBSheetSignsIllness = useRef();
  const {t} = useTranslation();
  const [apiCallImage, setApiCallImage] = useState();
  const [image, setImage] = useState();
  const insets = useSafeAreaInsets();
  const [selectedWaterIntake, setSelectedWaterIntake] = useState('');
  const [selectedFoodIntake, setSelectedFoodIntake] = useState('');
  const [selectedActivityLevel, setSelectedActivityLevel] = useState('');
  const [selectedUrinationLevel, setSelectedUrinationLevel] = useState('');
  const [selectedSignOfIllness, setSelectedSignOfIllness] = useState('');

  const [optionalEntriesValue, setOptionalEntriesValue] = useState({
    blood_gulcose: '',
    urine_gulcose: '',
    urine_ketones: '',
    weight: '',
  });

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const handleOpenSheet = item => {
    const sheetRefs = {
      'Water Intake': refRBSheet,
      'Food Intake': refRBSheetFoodIntake,
      'Activity Level': refRBSheetActivityLevel,
      Urination: refRBSheetUrinationLevel,
      'Signs of Illness': refRBSheetSignsIllness,
    };

    const sheetRef = sheetRefs[item.title];
    sheetRef?.current.open();
  };

  const petRecordList = [
    {
      id: 1,
      title: 'Water Intake',
      labelName: selectedWaterIntake?.title || 'Select',
      labelColor: selectedWaterIntake?.labelColor,
      labelTextColor: selectedWaterIntake?.title ? '' : colors.appRed,
    },
    {
      id: 2,
      title: 'Food Intake',
      labelName: selectedFoodIntake?.title || 'Select',
      labelColor: selectedFoodIntake?.labelColor,
      labelTextColor: !selectedFoodIntake?.title ? colors.appRed : '',
    },
    {
      id: 3,
      title: 'Activity Level',
      labelName: selectedActivityLevel?.title || 'Select',
      labelColor: selectedActivityLevel?.labelColor,
      labelTextColor: !selectedActivityLevel?.title ? colors.appRed : '',
    },
    {
      id: 4,
      title: 'Urination',
      labelName: selectedUrinationLevel?.title || 'Select',
      labelColor: selectedUrinationLevel?.labelColor,
      labelTextColor: !selectedUrinationLevel?.title ? colors.appRed : '',
    },
    {
      id: 5,
      title: 'Signs of Illness',
      labelName: selectedSignOfIllness?.title || 'Select',
      labelColor: selectedSignOfIllness?.labelColor,
      labelTextColor: !selectedSignOfIllness?.title ? colors.appRed : '',
    },
  ];

  const waterIntakeMenuList = [
    {
      id: 1,
      title: 'Not Drinking',
      subTitle: '',
      labelColor: colors.darkOrange,
      action: () => {},
      textColor: colors.blue,
    },
    {
      id: 2,
      title: 'Barely Drinking',
      subTitle: '',
      labelColor: colors.fawn,
      action: () => {},
      textColor: colors.blue,
    },
    {
      id: 3,
      title: 'Normal',
      subTitle: '',
      labelColor: colors.cyanBlue,
      action: () => {},
      textColor: colors.blue,
    },

    {
      id: 4,
      title: 'Thirsty',
      subTitle: '',
      labelColor: colors.darkOrange,
      action: () => {},
      textColor: colors.blue,
    },
    {
      id: 5,
      title: 'Very Thirsty',
      subTitle: '',
      labelColor: colors.appRed,
      action: () => {},
      textColor: colors.blue,
    },
  ];

  const foodIntakeMenuList = [
    {
      id: 1,
      title: 'Not Eating',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.darkOrange,
    },
    {
      id: 2,
      title: 'Barely Eating',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.fawn,
    },

    {
      id: 3,
      title: 'Normal',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.cyanBlue,
    },
    {
      id: 4,
      title: 'Hungry',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.darkOrange,
    },
    {
      id: 5,
      title: 'Very Hungry',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.appRed,
    },
  ];

  const activityLevelMenuList = [
    {
      id: 1,
      title: 'Inactive',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.darkOrange,
    },
    {
      id: 2,
      title: 'Low Activity',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.fawn,
    },

    {
      id: 3,
      title: 'Moderate',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.cyanBlue,
    },
    {
      id: 4,
      title: 'Active',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.darkOrange,
    },
    {
      id: 5,
      title: 'Highly Active',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.appRed,
    },
  ];

  const urinationLevelMenuList = [
    {
      id: 1,
      title: 'Less than usual ',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.darkOrange,
    },
    {
      id: 2,
      title: 'Straining',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.fawn,
    },

    {
      id: 3,
      title: 'Normal',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.cyanBlue,
    },
    {
      id: 4,
      title: 'Increased frequency',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.darkOrange,
    },
    {
      id: 5,
      title: 'Excessive volumes',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.appRed,
    },
  ];
  const signsOfIllnessMenuList = [
    {
      id: 1,
      title: 'Altered Attitude',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.darkOrange,
    },
    {
      id: 2,
      title: 'Altered Behavior',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.darkOrange,
    },

    {
      id: 3,
      title: 'Seizures or Collapse',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.appRed,
    },
    {
      id: 4,
      title: 'Vomiting',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.appRed,
    },
    {
      id: 5,
      title: 'All is well (no signs)',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.cyanBlue,
    },
    {
      id: 6,
      title: 'Weakness or Unsteady on their feet',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
      labelColor: colors.fawn,
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

  const add_record = () => {
    const api_credentials = {
      patientId: petDetail?.id,
      encounterId: '03a4e832-90b1-70c6-ac3e-690881b7580e',
      componentsData: [
        {key: 'activityLevel', value: 'normal'},
        {key: 'glucose', value: 5.6},
        {key: 'weight', value: 70},
        {key: 'insulinIntake', value: 10},
        {key: 'hba1c', value: 6.2},
        {key: 'mealInfo', value: 'light breakfast'},
        {key: 'sleepHours', value: 8},
        {key: 'notes', value: 'Feeling well today.'},
      ],
    };

    const fhirPayload = buildDiabetesObservation(api_credentials);
    const input = {
      data: fhirPayload,
      files: apiCallImage,
    };
    dispatch(add_diabetes_record_api());
  };

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <GText SatoshiBold text={dateTime} style={styles.headerTitle} />
      <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <LinearGradient
            colors={['#D04122', '#FDBD74']}
            start={{x: 0, y: 1}}
            end={{x: 1, y: 1}}
            style={{
              borderRadius: scaledValue(40),
              width: scaledValue(80),
              height: scaledValue(80),
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <GImage image={petDetail?.petImageUrl} style={styles.petImg} />
          </LinearGradient>
        </View>
        <View style={styles.petHealthMainView}>
          <FlatList
            data={petRecordList}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{}}
            renderItem={({item, index}) => {
              return (
                <>
                  <PetRecordCard
                    title={item?.title}
                    labelName={item?.labelName}
                    labelColor={item?.labelColor}
                    labelTextColor={item?.labelTextColor}
                    titleTextStyle={styles.petRecordTitleStyle}
                    rightArrow={
                      <Image
                        source={Images.RightArrow}
                        style={styles.rightArrowStyle}
                      />
                    }
                    onPress={() => handleOpenSheet(item)}
                  />
                  {index !== petRecordList?.length - 1 && <Divider />}
                </>
              );
            }}
          />
        </View>
        <View
          style={{
            paddingHorizontal: scaledValue(20),
          }}>
          <GText
            GrMedium
            text={t('optional_entries_string')}
            style={styles.optionalEntriesText}
          />
          <Divider style={{marginBottom: scaledValue(12)}} />
          <OptionalEntriesCard
            entriesName="Blood Glucose"
            rightText="mg/dL"
            onChangeText={value =>
              setOptionalEntriesValue({
                ...optionalEntriesValue,
                blood_gulcose: value,
              })
            }
          />
          <Divider />
          <OptionalEntriesCard
            entriesName="Urine Glucose"
            rightText="mg/dL"
            onChangeText={value =>
              setOptionalEntriesValue({
                ...optionalEntriesValue,
                urine_gulcose: value,
              })
            }
          />
          <Divider />
          <OptionalEntriesCard
            entriesName="Urine Ketones"
            rightText="mmol/L"
            onChangeText={value =>
              setOptionalEntriesValue({
                ...optionalEntriesValue,
                urine_ketones: value,
              })
            }
          />
          <Divider />
          <OptionalEntriesCard
            entriesName="Weight"
            rightText="lbs"
            onChangeText={value =>
              setOptionalEntriesValue({
                ...optionalEntriesValue,
                weight: value,
              })
            }
          />
          <Divider />
          <PetRecordCard
            title={t('body_condition_string')}
            titleTextStyle={styles.bodyConditionText}
            containerStyle={styles.containerStyle}
            rightIcon={
              <TouchableOpacity
                style={styles.rightIconTouchable}
                onPress={() => {
                  handlePicker();
                }}>
                {image && (
                  <Image
                    source={{uri: image}}
                    style={{
                      width: scaledValue(50),
                      height: scaledValue(50),
                      borderRadius: scaledValue(4),
                    }}
                  />
                )}
                {!image && (
                  <Image
                    source={image ? {uri: image} : Images.solar_camera}
                    tintColor="#ffffff"
                    style={styles.cameraIcon}
                  />
                )}
              </TouchableOpacity>
            }
          />
        </View>

        <View style={styles.buttonView(insets)}>
          <GButton
            title={t('add_record_string')}
            textStyle={styles.buttonText}
            style={styles.buttonStyle}
            onPress={() => {
              navigation?.navigate('StackScreens', {
                screen: 'ViewRecord',
                // params: {data: {dateTime: 'Oct 12, 2024 2:15 PM'}},
              });
            }}
          />
        </View>
      </ScrollView>
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        headerTitle={'Kizie’s Water Intake'}
        headerSubTitle={
          'Choose the option that reflects your pet’s drinking behavior'
        }
        options={waterIntakeMenuList}
        headerHeight={86}
        onChoose={val => {
          val.action();
          setSelectedWaterIntake(val);
          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
      <OptionMenuSheet
        refRBSheet={refRBSheetFoodIntake}
        headerTitle={'Kizie’s Food Intake'}
        headerSubTitle={
          'Choose the option that reflects your pet’s Food Intake'
        }
        options={foodIntakeMenuList}
        headerHeight={86}
        onChoose={val => {
          val.action();
          setSelectedFoodIntake(val);
          refRBSheetFoodIntake.current.close();
        }}
        onPressCancel={() => refRBSheetFoodIntake.current.close()}
      />
      <OptionMenuSheet
        refRBSheet={refRBSheetActivityLevel}
        headerTitle={'Kizie’s Activity Level'}
        headerSubTitle={
          'Choose the option that reflects your pet’s Activity Level'
        }
        options={activityLevelMenuList}
        headerHeight={86}
        onChoose={val => {
          val.action();
          setSelectedActivityLevel(val);
          refRBSheetActivityLevel.current.close();
        }}
        onPressCancel={() => refRBSheetActivityLevel.current.close()}
      />
      <OptionMenuSheet
        refRBSheet={refRBSheetUrinationLevel}
        headerTitle={'Kizie’s Urination Level'}
        headerSubTitle={
          'Choose the option that reflects your pet’s Urination Level'
        }
        options={urinationLevelMenuList}
        headerHeight={86}
        onChoose={val => {
          val.action();
          setSelectedUrinationLevel(val);
          refRBSheetUrinationLevel.current.close();
        }}
        onPressCancel={() => refRBSheetUrinationLevel.current.close()}
      />
      <OptionMenuSheet
        refRBSheet={refRBSheetSignsIllness}
        headerTitle={'Kizie’s Signs of Illness'}
        headerSubTitle={
          'Choose the option that reflects your pet’s Signs of Illness'
        }
        options={signsOfIllnessMenuList}
        headerHeight={86}
        onChoose={val => {
          val.action();
          setSelectedSignOfIllness(val);
          refRBSheetSignsIllness.current.close();
        }}
        onPressCancel={() => refRBSheetSignsIllness.current.close()}
      />
    </KeyboardAvoidingView>
  );
};

export default AddNewRecord1;
