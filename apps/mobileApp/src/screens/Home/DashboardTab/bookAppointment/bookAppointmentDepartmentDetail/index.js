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
          text={departmentDetail?.name}
          style={{
            fontSize: scaledValue(18),
            letterSpacing: scaledValue(18 * -0.01),

            textTransform: 'capitalize',
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
    false,
    {
      departmentId: departmentDetail?.id,
    },
    'GET',
  );

  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiBold
        text={businessDetails?.name}
        style={styles.headerTitle}
      />
      <View style={styles.headerView}>
        <GText GrMedium text={`${t('team_string')} `} style={styles.teamText} />
        <GText
          GrMedium
          text={`(${data?.data?.total || 0})`}
          style={styles.countText}
        />
      </View>
      <View style={{}}>
        <FlatList
          data={data?.data?.entry}
          style={{marginBottom: scaledValue(100)}}
          contentContainerStyle={{
            gap: scaledValue(24),
            marginVertical: scaledValue(11),
          }}
          renderItem={({item, index}) => {
            const docDetails = item?.resource?.extension?.reduce(
              (acc, item) => {
                const value =
                  item.valueString ?? item.valueDecimal ?? item.valueInteger;

                if (value !== undefined) {
                  acc[item.title] = value;
                }

                return acc;
              },
              {},
            );

            const qualification =
              item?.resource.qualification?.[0]?.code?.text || 'N/A';
            const department =
              item?.resource.department?.[0]?.code?.text || 'N/A';
            return (
              <View style={styles.cardView}>
                <View style={styles.card}>
                  <View style={styles.cardInnerView}>
                    <View style={styles.doctorImgView}>
                      <GImage
                        image={docDetails?.doctorImage}
                        style={styles.doctorImg}
                      />

                      <View style={styles.starImgView}>
                        <Image source={Images.Star} style={styles.starImg} />
                        <GText
                          SatoshiBold
                          text={docDetails?.averageRating}
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
                        text={`Dr. ${item?.resource?.name[0]?.text}`}
                        style={styles.doctorName}
                      />
                      <GText
                        SatoshiBold
                        text={department}
                        style={[
                          styles.departmentText,
                          {textTransform: 'capitalize'},
                        ]}
                      />
                      <GText
                        SatoshiBold
                        text={qualification}
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
                          text={`${docDetails?.experienceYears} Years`}
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
                          text={`$${docDetails?.consultationFee}`}
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
                          departmentDetail: departmentDetail,
                          businessDetails: businessDetails,
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
