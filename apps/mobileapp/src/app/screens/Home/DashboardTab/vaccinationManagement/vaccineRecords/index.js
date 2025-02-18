import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import {Images} from '../../../../../utils';
import {useTranslation} from 'react-i18next';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import ToggleButton from '../../../../../components/ToogleButton';
import GButton from '../../../../../components/GButton';
import HeaderButton from '../../../../../components/HeaderButton';

const VaccineRecords = ({navigation}) => {
  const {t} = useTranslation();
  const [toggleState, setToggleState] = useState(false);
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

  const recordList = [
    {
      id: 1,
      disease: 'Chlamydia',
      status: 'Risk',
      date: '15 Aug 2024',
      clinic: 'Upcoming',
      img: Images.Pending,
    },
    {
      id: 2,
      disease: 'Panleukopenia',
      status: 'not-Risk',
      date: '8 Aug 2024',
      clinic: 'Small Animal Vet Hospital',
      name: 'Nobivac Intra-Trac® Oral BB',
      img: Images.Sanofi,
    },
    {
      id: 3,
      disease: 'Calicivirus',
      status: 'not-Risk',
      date: '15 July 2024',
      clinic: 'Vets for Pets Clinic',
      name: 'Nobivac Intra-Trac® Oral BB',
      img: Images.Msd,
    },
    {
      id: 4,
      disease: 'Herpesvirus',
      status: 'not-Risk',
      date: '25 May 2024',
      clinic: 'Small Animal Vet Hospital',
      name: 'Nobivac Intra-Trac® Oral BB',
      img: Images.Zoe,
    },
    {
      id: 5,
      disease: 'Leukemia',
      status: 'not-Risk',
      date: '8 mar 2024',
      clinic: 'Small Animal Vet Hospital',
      name: 'Nobivac Intra-Trac® Oral BB',
      img: Images.Boe,
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.innerContainer}>
          <View>
            <View style={styles.row}>
              <GText GrMedium text={'Oscar’s'} style={styles.oscarText} />
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
          <TouchableOpacity activeOpacity={0.5} style={styles.button}>
            <Image source={Images.CatImg} style={styles.catImage} />
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
            data={recordList}
            renderItem={({item, index}) => (
              <View>
                <TouchableOpacity style={styles.itemContainer}>
                  <View>
                    <View style={styles.textRow}>
                      <GText
                        GrMedium
                        text={item?.disease}
                        style={styles.diseaseText}
                      />
                      <Image
                        tintColor={
                          item?.status === 'Risk' ? colors.appRed : '#8AC1B1'
                        }
                        source={
                          item?.status === 'Risk'
                            ? Images.Risk
                            : Images.CircleCheck
                        }
                        style={styles.statusImage}
                      />
                    </View>
                    {item?.name && (
                      <GText
                        SatoshiBold
                        text={item?.name}
                        style={styles.nameText}
                      />
                    )}
                    <View style={styles.infoRow}>
                      <GText
                        SatoshiBold
                        text={item?.date}
                        style={styles.dateText}
                      />
                      <View style={styles.dot} />
                      <GText
                        SatoshiBold
                        text={item?.clinic}
                        style={styles.clinicText}
                      />
                    </View>
                  </View>
                  <Image source={item?.img} style={styles.itemImage} />
                </TouchableOpacity>
                {item.id !== recordList[recordList.length - 1].id && (
                  <View style={styles.divider} />
                )}
              </View>
            )}
          />
        </View>
        <GButton
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'AddVaccineRecord',
            });
          }}
          title={t('add_new_record_string')}
          icon={Images?.PlusIcon}
          iconStyle={styles.iconStyle}
          style={styles.buttonStyle}
          textStyle={styles.buttonText}
        />
      </ScrollView>
    </View>
  );
};

export default VaccineRecords;
