import {
  FlatList,
  Image,
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
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import {scaledValue} from '../../../../../utils/design.utils';
import PetRecordCard from '../../../../../components/PetRecordCard';
import {Divider} from 'react-native-paper';
import OptionalEntriesCard from '../addNewRecord1/OptionalEntriesCard';
import {styles} from './styles';

const ViewRecord = ({navigation, route}) => {
  const refRBSheet = useRef();
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [petHealthValue, setPetHealthValue] = useState({
    water_intake: '',
    food_intake: '',
    activity_level: '',
    signs_of_illness: '',
  });

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
          icon={Images.deleteBold}
          tintColor={colors.appRed}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
      headerTitle: () => (
        <GText
          GrMedium
          text={'29 Sep 2024 - 8:47 AM'}
          style={styles.headerTitleText}
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

  const viewEntriesDetails = [
    {
      id: 1,
      title: 'Blood Glucose',
      level: '108',
      measure: 'mg/dL',
    },
    {
      id: 2,
      title: 'Urine Glucose',
      level: '98',
      measure: 'mg/dL',
    },
    {
      id: 3,
      title: 'Urine Ketones',
      level: '0.24',
      measure: 'mmol/L',
    },
    {
      id: 4,
      title: 'Weight',
      level: '30.86',
      measure: 'lbs',
    },
  ];

  const petRecordList = [
    {
      id: 1,
      title: 'Water Intake',
      labelName: 'Normal',
      labelColor: colors.cyanBlue,
    },
    {
      id: 2,
      title: 'Food Intake',
      labelName: 'Not Eating',
      labelColor: colors.darkOrange,
    },
    {
      id: 3,
      title: 'Activity Level',
      labelName: 'Moderate',
      labelColor: colors.fawn,
    },
    {
      id: 4,
      title: 'Signs of Illness',
      labelName: 'Vomiting',
      labelColor: colors.appRed,
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: scaledValue(20),
          marginTop: insets.top + scaledValue(13),
        }}>
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
        <GText
          GrMedium
          text={'29 Sep 2024 - 8:47 AM'}
          style={styles.headerTitleText}
        />
        <HeaderButton
          icon={Images.deleteBold}
          tintColor={colors.appRed}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      </View>
      <GText SatoshiBold text={'108mg/dL'} style={styles.headerTitle} />
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
                    onPress={() => refRBSheet.current.open()}
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
          <FlatList
            data={viewEntriesDetails}
            renderItem={({item}) => {
              return (
                <>
                  <OptionalEntriesCard
                    entriesName={item.title}
                    level={item.level}
                    measure={item.measure}
                    showEntriesDetails
                  />
                  <Divider />
                </>
              );
            }}
          />

          <PetRecordCard
            title="Body Condition"
            titleTextStyle={styles.bodyConditionTitleText}
            containerStyle={styles.bodyConditionContainer}
            rightIcon={
              <TouchableOpacity style={styles.bodyConditionRightIcon}>
                <Image
                  source={Images.ProfileCamera}
                  tintColor="#ffffff"
                  style={{width: scaledValue(20), height: scaledValue(20)}}
                />
              </TouchableOpacity>
            }
          />
        </View>

        <View style={styles.buttonView(insets)}>
          <GButton
            title={t('send_my_vet_clinic_string')}
            textStyle={styles.buttonText}
            style={styles.buttonStyle}
            onPress={() => {
              navigation?.navigate('StackScreens', {
                screen: 'ChooseVet',
              });
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default ViewRecord;
