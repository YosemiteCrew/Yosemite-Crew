import {Image, ScrollView, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import AppointmentCard from '../../../../../components/AppointmentCard';

const BookAppointmentGroomer = ({navigation}) => {
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
          onPress={() => {}}
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
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        <Image source={Images.Tender} style={styles.tenderImage} />
        <GText
          GrMedium
          text={'Tender Loving Care Pet Grooming'}
          style={styles.titleText}
        />
        <GText
          SatoshiBold
          text={'8:00AM - 7:00PM (Mon - Fri)'}
          style={styles.subtitleText}
        />
        <View style={styles.rowContainer}>
          <View style={styles.locationContainer}>
            <Image source={Images.Location} style={styles.iconImage} />
            <GText GrMedium text={'2.5mi'} style={styles.distanceText} />
          </View>
          <View style={styles.ratingContainer}>
            <Image source={Images.Star} style={styles.iconImage} />
            <GText GrMedium text={'4.1'} style={styles.ratingText} />
          </View>
        </View>
        <View style={styles.addressView}>
          <Image source={Images.Address} style={styles.iconImage} />
          <GText
            SatoshiBold
            text={'16244 E 14th St, San Leandro, CA 94578, United States'}
            style={styles.addressText}
          />
        </View>
        <View style={styles.addressView}>
          <Image source={Images.Phone} style={styles.iconImage} />
          <GText
            SatoshiBold
            text={'+1 510-589-6801'}
            style={styles.addressText}
          />
        </View>
        <View style={styles.addressView}>
          <Image source={Images.Foot} style={styles.iconImage} />
          <GText SatoshiBold text={'2 Groomers'} style={styles.addressText} />
        </View>
        <GButton
          icon={Images.Direction}
          iconStyle={styles.iconStyle}
          title={t('get_directions_string')}
          style={styles.buttonStyle}
          textStyle={styles.buttonTextStyle}
        />
        <View style={styles.headerView}>
          <GText
            GrMedium
            text={`${t('team_string')} `}
            style={styles.teamText}
          />
          <GText GrMedium text={'(5)'} style={styles.countText} />
        </View>
        <AppointmentCard
          imageSource={Images.DoctorImg}
          doctorName="Debbie Ross"
          department="Professional Bather"
          qualifications="Certified Professional"
          hospitalName=""
          appointmentTime="Tuesday, 20 August - 11:00 AM"
          navigation={navigation}
          confirmed
          buttonImg={Images.CrossFill}
          buttonText={t('cancel_string')}
          showButton
        />
        <View style={styles.cardView}>
          <View style={styles.card}>
            <View style={styles.cardInnerView}>
              <View style={styles.doctorImgView}>
                <Image source={Images.DoctorImg} style={styles.doctorImg} />
                <View style={styles.starImgView}>
                  <Image source={Images.Star} style={styles.starImg} />
                  <GText
                    SatoshiBold
                    text={`4.9`}
                    style={styles.experienceTextStyle}
                  />
                </View>
              </View>
              <View style={styles.doctorDetails}>
                <GText
                  GrMedium
                  text={'Dr. Emily Johnson'}
                  style={styles.doctorName}
                />
                <GText
                  SatoshiBold
                  text={'Cardiology'}
                  style={styles.departmentText}
                />
                <GText
                  SatoshiBold
                  text={'DVM, DACVIM'}
                  style={styles.departmentText}
                />
                <View style={styles.experienceView}>
                  <GText
                    SatoshiBold
                    text={`${t('experience_string')}: `}
                    style={styles.experienceText}
                  />
                  <GText
                    SatoshiBold
                    text={`13 Years`}
                    style={styles.experienceTextStyle}
                  />
                </View>
                <View style={styles.feesView}>
                  <GText
                    SatoshiBold
                    text={`${t('consultation_fee_string')} `}
                    style={styles.experienceText}
                  />
                  <GText
                    SatoshiBold
                    text={`$220`}
                    style={styles.experienceTextStyle}
                  />
                </View>
              </View>
            </View>
            <GButton
              icon={Images.Calender}
              iconStyle={styles.iconStyle}
              title={t('book_appointment_string')}
              style={styles.buttonStyle}
              textStyle={styles.buttonTextStyle}
            />
          </View>
        </View>
        <GText
          GrMedium
          text={t('service_string')}
          style={styles.serviceTextStyle}
        />
        <View style={styles.serviceContainer}>
          {serviceList?.map((item, index) => (
            <View key={index} style={styles.serviceView}>
              <Image
                source={Images.CircleCheck}
                tintColor={'#8AC1B1'}
                style={styles.circleImg}
              />
              <GText SatoshiBold text={item} style={styles.serviceText} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default BookAppointmentGroomer;
