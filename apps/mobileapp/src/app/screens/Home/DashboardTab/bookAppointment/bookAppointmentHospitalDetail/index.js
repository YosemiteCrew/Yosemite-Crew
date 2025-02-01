import {Image, ScrollView, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import GButton from '../../../../../components/GButton';

const BookAppointmentDetail = ({navigation}) => {
  const {t} = useTranslation();
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
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
    });
  };

  const departmentList = [
    {
      id: 1,
      department: t('emergency_string'),
      doctorCount: 7,
    },
    {
      id: 2,
      department: t('surgery_string'),
      doctorCount: 2,
    },
    {
      id: 3,
      department: t('tplo_string'),
      doctorCount: 2,
    },
    {
      id: 4,
      department: t('oncology_string'),
      doctorCount: 1,
    },
    {
      id: 5,
      department: t('internal_medicine_string'),
      doctorCount: 5,
    },
    {
      id: 6,
      department: t('cardiology_string'),
      doctorCount: 1,
    },
  ];

  const serviceList = [
    t('emergency_case_string'),
    t('surgery_and_operating_string'),
    t('veterinary_icu_string'),
    t('diagnostic_imaging_string'),
    t('in_house_laboratory_string'),
    t('dental_care_string'),
    t('vaccination_and_preventive_string'),
    t('physical_rehabilitation_string'),
    t('isolation_ward_string'),
    t('oncology_treatment_string'),
    t('cardiology_treatment_string'),
    t('pharmacy_pets_string'),
    t('behavioral_therapy_string'),
    t('nutritional_counseling_string'),
  ];
  return (
    <View style={styles.dashboardMainView}>
      <ScrollView>
        <View style={{paddingHorizontal: scaledValue(20)}}>
          <Image source={Images.Hospital1} style={styles.clinicImg} />
          <GText
            GrMedium
            text={'San Francisco Animal Medical Center'}
            style={styles.clinicName}
          />
          <GText SatoshiBold text={'Open 24 Hours'} style={styles.timeText} />
          <View style={styles.textView}>
            <View style={styles.innerView}>
              <Image source={Images.Location} style={styles.locationImg} />
              <GText GrMedium text={'2.5mi'} style={styles.distanceText} />
            </View>
            <View
              style={[
                styles.innerView,
                {marginLeft: scaledValue(12), marginBottom: scaledValue(4)},
              ]}>
              <Image source={Images.Star} style={styles.locationImg} />
              <GText GrMedium text={'4.1'} style={styles.distanceText} />
            </View>
          </View>
          <View style={[styles.addressView]}>
            <Image source={Images.Address} style={styles.locationImg} />
            <GText
              SatoshiBold
              text={'2343 Fillmore St, San Francisco, CA 94115, United States'}
              style={styles.addressText}
            />
          </View>
          <View style={[styles.addressView]}>
            <Image source={Images.Global} style={styles.locationImg} />
            <GText GrMedium text={'sfamc.com'} style={styles.addressText} />
          </View>
          <View style={[styles.addressView]}>
            <Image source={Images.HomeAdd} style={styles.locationImg} />
            <GText GrMedium text={'6 Departments'} style={styles.addressText} />
          </View>
          <GButton
            icon={Images.Direction}
            iconStyle={styles.iconStyle}
            title={t('get_directions_string')}
            style={styles.buttonStyle}
            textStyle={styles.buttonTextStyle}
          />
          <GText
            GrMedium
            text={t('departments_string')}
            style={styles.departmentText}
          />
          <View style={styles.questionsContainer}>
            {departmentList?.map((item, index) => (
              <>
                <TouchableOpacity
                  onPress={() => {
                    navigation?.navigate('StackScreens', {
                      screen: 'BookAppointmentDepartmentDetail',
                    });
                  }}
                  key={item?.id}
                  style={styles.questionButton}>
                  <GText
                    SatoshiBold
                    text={item?.department}
                    style={styles.departmentTextStyle}
                  />
                  <View style={{flexDirection: 'row'}}>
                    <GText
                      SatoshiBold
                      text={`${item?.doctorCount} Doctors`}
                      style={styles.questionText}
                    />
                    <Image
                      source={Images.RightArrow}
                      style={styles.rightArrow}
                    />
                  </View>
                </TouchableOpacity>
                <View style={styles.separator} />
              </>
            ))}
          </View>
          <GText
            GrMedium
            text={t('service_string')}
            style={styles.departmentText}
          />
          <View style={styles.serviceContainer}>
            {serviceList?.map((item, index) => (
              <View style={styles.serviceView}>
                <Image
                  source={Images.CircleCheck}
                  tintColor={'#8AC1B1'}
                  style={styles.circleImg}
                />
                <GText SatoshiBold text={item} style={styles.serviceText} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default BookAppointmentDetail;
