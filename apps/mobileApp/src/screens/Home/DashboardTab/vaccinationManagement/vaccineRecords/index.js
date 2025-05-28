import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {Images} from '../../../../../utils';
import {useTranslation} from 'react-i18next';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import ToggleButton from '../../../../../components/ToogleButton';
import GButton from '../../../../../components/GButton';
import HeaderButton from '../../../../../components/HeaderButton';
import useDataFactory from '../../../../../components/UseDataFactory/useDataFactory';
import {formatDate} from '../../../../../utils/constants';
import GImage from '../../../../../components/GImage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppSelector} from '../../../../../redux/store/storeUtils';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import {transformPets} from '../../../../../helpers/transformPets';
import {transformImmunizations} from '../../../../../helpers/transformImmunizations';

const VaccineRecords = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const refRBSheet = useRef();
  const [toggleState, setToggleState] = useState(false);
  const petList = useAppSelector(state => state.pets?.petLists);
  const PetData = transformPets(petList?.entry, {useFhirId: true});
  const [selectedPet, setSelectedPet] = useState(PetData[0]);

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
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
    });
  };

  const {
    loading,
    data,
    setData,
    extraData,
    refreshData,
    loadMore,
    Placeholder,
    Loader,
  } = useDataFactory(
    'getVaccinationRecord',
    true,
    {
      petId: petList?.entry[0]?.resource?.id,
      limit: 10,
    },
    'GET',
  );

  const vaccinationList = transformImmunizations(data, {
    useFhirId: true,
  });

  console.log('vaccinationList', vaccinationList);

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.innerContainer}>
          <View>
            <View style={styles.row}>
              <GText
                GrMedium
                text={`${selectedPet?.title}’s`}
                style={styles.oscarText}
              />
              <GText
                GrMedium
                text={` ${t('vaccinations_small_string')}`}
                style={styles.vaccinationText}
              />
            </View>
            <GText
              GrMedium
              text={` ${t('records_string')}`}
              style={styles.recordsText}
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              refRBSheet?.current?.open();
            }}
            activeOpacity={0.7}
            style={styles.button}>
            <GImage image={selectedPet?.petImage} style={styles.catImage} />
            <Image source={Images.ArrowDown} style={styles.arrowImage} />
          </TouchableOpacity>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: scaledValue(30),
            justifyContent: 'space-between',
          }}>
          <View style={styles.headerContainer}>
            <Image source={Images.Shield} style={styles.shieldImage} />
            <View style={styles.upcomingVaccinationContainer}>
              <GText
                GrMedium
                text={t('upcoming_vaccination_string')}
                style={styles.upcomingVaccinationText}
              />
              <GText
                SatoshiBold
                text={t('due_on_string')}
                style={styles.dueOnText}
              />
            </View>
          </View>
          <View style={{alignItems: 'center'}}>
            <ToggleButton
              toggleState={toggleState}
              setToggleState={setToggleState}
            />
            <GText
              SatoshiBold
              text={t('reminders_string')}
              style={styles.reminderText}
            />
          </View>
        </View>
        <GText
          SatoshiBold
          text={t('vaccination_record_small_string')}
          style={styles.titleText}
        />
        <View style={styles.container}>
          <FlatList
            contentContainerStyle={{marginBottom: scaledValue(151)}}
            data={vaccinationList}
            renderItem={({item, index}) => {
              return (
                <View>
                  <TouchableOpacity
                    onPress={() => {
                      navigation.navigate('StackScreens', {
                        screen: 'EditVaccineRecord',
                        params: {
                          itemRecordDetails: item,
                          setData,
                        },
                      });
                    }}
                    style={styles.itemContainer}>
                    <View>
                      <View style={styles.textRow}>
                        <GText
                          GrMedium
                          text={item?.manufacturer}
                          style={styles.diseaseText}
                        />
                        <Image
                          tintColor={
                            item?.status !== 'completed'
                              ? colors.appRed
                              : '#8AC1B1'
                          }
                          source={
                            item?.status !== 'completed'
                              ? Images.Risk
                              : Images.CircleCheck
                          }
                          style={styles.statusImage}
                        />
                      </View>
                      {item?.vaccine && (
                        <GText
                          SatoshiBold
                          text={item?.vaccine}
                          style={styles.nameText}
                        />
                      )}
                      <View style={styles.infoRow}>
                        <GText
                          SatoshiBold
                          text={formatDate(item?.date)}
                          style={styles.dateText}
                        />
                        <View style={styles.dot} />
                        <GText
                          SatoshiBold
                          text={item?.location}
                          style={styles.clinicText}
                        />
                      </View>
                    </View>
                    <GImage
                      image={item?.attachments[0]?.url}
                      style={styles.itemImage}
                    />
                  </TouchableOpacity>
                  {item.id !==
                    vaccinationList[vaccinationList.length - 1]?.id && (
                    <View style={styles.divider} />
                  )}
                </View>
              );
            }}
          />
        </View>
      </ScrollView>
      <GButton
        onPress={() => {
          navigation?.navigate('StackScreens', {
            screen: 'AddVaccineRecord',
          });
        }}
        title={t('add_new_record_string')}
        icon={Images?.PlusIcon}
        iconStyle={styles.iconStyle}
        style={[
          styles.buttonStyle,
          {
            bottom:
              insets.bottom === 0
                ? insets.bottom + scaledValue(15)
                : insets.bottom,
          },
        ]}
        textStyle={styles.buttonText}
      />
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        // title={formValue?.blood_group || 'Select Blood Group'}
        options={PetData}
        onChoose={val => {
          setSelectedPet(val);
          refreshData({
            petId: val?.id,
            limit: 10,
            offset: 0,
          });
          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </View>
  );
};

export default VaccineRecords;
