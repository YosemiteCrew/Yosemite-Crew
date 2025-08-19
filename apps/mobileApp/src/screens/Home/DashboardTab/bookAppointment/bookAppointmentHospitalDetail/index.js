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
          tintColor={colors.jetBlack}
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
          tintColor={colors.jetBlack}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
    });
  };

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView>
        <View style={{paddingHorizontal: scaledValue(20)}}>
          <GImage image={businessDetails?.logo} style={styles.clinicImg} />
          <GText
            GrMedium
            text={businessDetails?.name}
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
              <GText
                GrMedium
                text={businessDetails?.rating}
                style={styles.distanceText}
              />
            </View>
          </View>
          <View style={[styles.addressView]}>
            <Image source={Images.Address} style={styles.locationImg} />
            <GText
              SatoshiBold
              text={businessDetails?.address}
              // text={Object.values(businessDetails?.address[0]?.text).join(', ')}
              style={styles.addressText}
            />
          </View>
          <View style={[styles.addressView]}>
            <Image source={Images.Global} style={styles.locationImg} />
            <GText
              GrMedium
              text={getDomainName(businessDetails?.website)}
              style={styles.addressText}
            />
          </View>
          <View style={[styles.addressView]}>
            <Image source={Images.HomeAdd} style={styles.locationImg} />
            <GText
              GrMedium
              text={`${businessDetails?.healthcareServices?.length} Departments`}
              style={[styles.addressText, {color: colors.jetLightBlack}]}
            />
          </View>
          <GButton
            icon={Images.Direction}
            iconStyle={styles.iconStyle}
            title={t('get_directions_string')}
            style={styles.buttonStyle}
            textStyle={styles.buttonTextStyle}
          />
          <TouchableOpacity
            onPress={() => {
              navigation?.navigate('BusinessReview', {
                businessDetails,
              });
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: scaledValue(14),
              justifyContent: 'center',
              gap: scaledValue(6),
              paddingVertical: scaledValue(8),
            }}>
            <Image
              source={Images.chat_round}
              tintColor={colors.jetBlack}
              style={{width: scaledValue(16), height: scaledValue(16)}}
            />
            <GText
              GrMedium
              text={t('write_review_string')}
              style={{
                fontSize: scaledValue(16),
                letterSpacing: scaledValue(16 * -0.01),
                color: colors.jetBlack,
              }}
            />
          </TouchableOpacity>
          {businessDetails?.healthcareServices?.length > 0 && (
            <>
              <GText
                GrMedium
                text={t('departments_string')}
                style={styles.departmentText}
              />
              <View style={styles.questionsContainer}>
                {businessDetails?.healthcareServices?.map((item, index) => (
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
                        text={item?.name}
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

          {businessDetails?.selectedServices?.length > 0 && (
            <>
              <GText
                GrMedium
                text={t('service_string')}
                style={styles.departmentText}
              />
              <View style={styles.serviceContainer}>
                {businessDetails?.selectedServices?.map((item, index) => (
                  <View style={styles.serviceView}>
                    <Image
                      source={Images.CircleCheck}
                      style={styles.circleImg}
                    />
                    <GText
                      SatoshiBold
                      text={item?.display}
                      style={styles.serviceText}
                    />
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default BookAppointmentDetail;
