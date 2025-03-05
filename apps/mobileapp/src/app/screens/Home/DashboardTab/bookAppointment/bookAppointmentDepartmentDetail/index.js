import {FlatList, Image, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import GButton from '../../../../../components/GButton';
import useDataFactory from '../../../../../components/UseDataFactory/useDataFactory';
import GImage from '../../../../../components/GImage';

const BookAppointmentDepartmentDetail = ({navigation, route}) => {
  const {departmentDetail, businessDetails} = route?.params;
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
      headerTitle: () => (
        <GText
          GrMedium
          text={departmentDetail?.departmentName}
          style={{
            fontSize: scaledValue(18),
            letterSpacing: scaledValue(18 * -0.01),
            color: colors.darkPurple,
            textTransform: 'capitalize',
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
    'getDoctorsLists',
    true,
    {
      businessId: businessDetails?.cognitoId,
      departmentId: departmentDetail?.departmentId,
    },
    'POST',
  );

  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiBold
        text={businessDetails?.profileData?.businessName}
        style={styles.headerTitle}
      />
      <View style={styles.headerView}>
        <GText GrMedium text={`${t('team_string')} `} style={styles.teamText} />
        <GText GrMedium text={`(${data?.length})`} style={styles.countText} />
      </View>
      <View style={{}}>
        <FlatList
          data={data}
          style={{marginBottom: scaledValue(100)}}
          contentContainerStyle={{
            gap: scaledValue(24),
          }}
          renderItem={({item, index}) => {
            return (
              <View style={styles.cardView}>
                <View style={styles.card}>
                  <View style={styles.cardInnerView}>
                    <View style={styles.doctorImgView}>
                      <GImage
                        image={item?.personalInfo?.image}
                        style={styles.doctorImg}
                      />

                      <View style={styles.starImgView}>
                        <Image source={Images.Star} style={styles.starImg} />
                        <GText
                          SatoshiBold
                          text={`4.9`}
                          style={[
                            styles.experienceTextStyle,
                            {
                              marginLeft: scaledValue(4),
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={{marginLeft: scaledValue(8)}}>
                      <GText
                        GrMedium
                        text={`Dr. ${
                          item?.personalInfo?.firstName +
                          ' ' +
                          item?.personalInfo?.lastName
                        }`}
                        style={styles.doctorName}
                      />
                      {/* <GText
                        SatoshiBold
                        text={'Cardiology'}
                        style={styles.departmentText}
                      /> */}
                      <GText
                        SatoshiBold
                        text={item?.professionalBackground?.qualification}
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
                          text={`${item?.professionalBackground?.yearsOfExperience} Years`}
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
                          text={`$${item?.consultFee}`}
                          style={styles.experienceTextStyle}
                        />
                      </View>
                    </View>
                  </View>
                  <GButton
                    onPress={() => {
                      navigation?.navigate('StackScreens', {
                        screen: 'BookAppointment',
                        params: {
                          doctorDetail: item,
                        },
                      });
                    }}
                    icon={Images.Calender}
                    iconStyle={styles.iconStyle}
                    title={t('book_appointment_string')}
                    style={styles.buttonStyle}
                    textStyle={styles.buttonTextStyle}
                  />
                </View>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
};

export default BookAppointmentDepartmentDetail;
