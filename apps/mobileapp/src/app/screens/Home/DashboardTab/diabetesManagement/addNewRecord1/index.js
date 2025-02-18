import {
  FlatList,
  Image,
  KeyboardAvoidingView,
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

const AddNewRecord1 = ({navigation, route}) => {
  const {dateTime} = route?.params?.data;
  const refRBSheet = useRef();
  const refRBSheetFoodIntake = useRef();
  const refRBSheetActivityLevel = useRef();
  const refRBSheetSignsIllness = useRef();
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedWaterIntake, setSelectedWaterIntake] = useState('');
  const [selectedFoodIntake, setSelectedFoodIntake] = useState('');
  const [selectedActivityLevel, setSelectedActivityLevel] = useState('');
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
      'Signs of Illness': refRBSheetSignsIllness,
    };

    const sheetRef = sheetRefs[item.title];
    sheetRef?.current.open();
  };

  const petRecordList = [
    {
      id: 1,
      title: 'Water Intake',
      labelName: selectedWaterIntake || 'Select',
      labelColor: selectedWaterIntake ? colors.cyanBlue : '',
      labelTextColor: selectedWaterIntake ? '' : colors.appRed,
    },
    {
      id: 2,
      title: 'Food Intake',
      labelName: selectedFoodIntake || 'Select',
      labelColor: selectedFoodIntake ? colors.darkOrange : '',
      labelTextColor: !selectedFoodIntake ? colors.appRed : '',
    },
    {
      id: 3,
      title: 'Activity Level',
      labelName: selectedActivityLevel || 'Select',
      labelColor: selectedActivityLevel ? colors.fawn : '',
      labelTextColor: !selectedActivityLevel ? colors.appRed : '',
    },
    {
      id: 4,
      title: 'Signs of Illness',
      labelName: selectedSignOfIllness || 'Select',
      labelColor: selectedSignOfIllness ? colors.appRed : '',
      labelTextColor: !selectedSignOfIllness ? colors.appRed : '',
    },
  ];

  const waterIntakeMenuList = [
    {
      id: 1,
      title: 'Not Drinking',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 2,
      title: 'Barely Drinking',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 3,
      title: 'Normal',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },

    {
      id: 4,
      title: 'Thirsty',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 5,
      title: 'Very Thirsty',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
  ];

  const foodIntakeMenuList = [
    {
      id: 1,
      title: 'Not Eating',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 2,
      title: 'Barely Eating',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },

    {
      id: 3,
      title: 'Normal',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 4,
      title: 'Hungry',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 5,
      title: 'Very Hungry',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
  ];

  const activityLevelMenuList = [
    {
      id: 1,
      title: 'Inactive',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 2,
      title: 'Low Activity',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },

    {
      id: 3,
      title: 'Moderate',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 4,
      title: 'Active',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 5,
      title: 'Highly Active',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
  ];

  const signsOfIllnessMenuList = [
    {
      id: 1,
      title: 'Altered Attitude',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 2,
      title: 'Altered Behavior',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },

    {
      id: 3,
      title: 'Seizures or Collapse',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 4,
      title: 'Vomiting',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 5,
      title: 'All is well (no signs)',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
    {
      id: 6,
      title: 'Weakness or Unsteady on their feet',
      subTitle: '',
      textColor: colors.blue,
      action: () => {},
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <GText SatoshiBold text={dateTime} style={styles.headerTitle} />
      <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Image source={Images.Kizi} style={styles.petImg} />
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
                onPress={() => {}}>
                <Image
                  source={Images.ProfileCamera}
                  tintColor="#ffffff"
                  style={styles.cameraIcon}
                />
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
          setSelectedWaterIntake(val.title);
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
          setSelectedFoodIntake(val.title);
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
          setSelectedActivityLevel(val.title);
          refRBSheetActivityLevel.current.close();
        }}
        onPressCancel={() => refRBSheetActivityLevel.current.close()}
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
          setSelectedSignOfIllness(val.title);
          refRBSheetSignsIllness.current.close();
        }}
        onPressCancel={() => refRBSheetSignsIllness.current.close()}
      />
    </KeyboardAvoidingView>
  );
};

export default AddNewRecord1;
