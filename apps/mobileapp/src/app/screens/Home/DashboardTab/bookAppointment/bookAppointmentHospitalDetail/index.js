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
import {formatUrl, getDomainName} from '../../../../../utils/constants';
import GImage from '../../../../../components/GImage';

const BookAppointmentDetail = ({navigation, route}) => {
  const {businessDetails} = route?.params;

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
          {/* <Image source={Images.Hospital1} style={styles.clinicImg} /> */}
          <GImage
            image={businessDetails?.profileData?.logo}
            style={styles.clinicImg}
          />
          <GText
            GrMedium
            text={businessDetails?.profileData?.businessName}
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
              text={Object.values(businessDetails?.profileData?.address).join(
                ', ',
              )}
              style={styles.addressText}
            />
          </View>
          <View style={[styles.addressView]}>
            <Image source={Images.Global} style={styles.locationImg} />
            <GText
              GrMedium
              text={getDomainName(businessDetails?.profileData?.website)}
              style={styles.addressText}
            />
          </View>
          <View style={[styles.addressView]}>
            <Image source={Images.HomeAdd} style={styles.locationImg} />
            <GText
              GrMedium
              text={`${businessDetails?.departments?.length} Departments`}
              style={styles.addressText}
            />
          </View>
          <GButton
            icon={Images.Direction}
            iconStyle={styles.iconStyle}
            title={t('get_directions_string')}
            style={styles.buttonStyle}
            textStyle={styles.buttonTextStyle}
          />
          {businessDetails?.departments?.length > 0 && (
            <>
              <GText
                GrMedium
                text={t('departments_string')}
                style={styles.departmentText}
              />
              <View style={styles.questionsContainer}>
                {businessDetails?.departments?.map((item, index) => (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        navigation?.navigate('StackScreens', {
                          screen: 'BookAppointmentDepartmentDetail',
                          params: {
                            departmentDetail: item,
                            businessDetails: businessDetails,
                          },
                        });
                      }}
                      key={item?.id}
                      style={styles.questionButton}>
                      <GText
                        SatoshiBold
                        text={item?.departmentName}
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
            </>
          )}

          {businessDetails?.profileData?.selectedServices?.length > 0 && (
            <>
              <GText
                GrMedium
                text={t('service_string')}
                style={styles.departmentText}
              />
              <View style={styles.serviceContainer}>
                {businessDetails?.profileData?.selectedServices?.map(
                  (item, index) => (
                    <View style={styles.serviceView}>
                      <Image
                        source={Images.CircleCheck}
                        tintColor={'#8AC1B1'}
                        style={styles.circleImg}
                      />
                      <GText
                        SatoshiBold
                        text={item}
                        style={styles.serviceText}
                      />
                    </View>
                  ),
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default BookAppointmentDetail;
