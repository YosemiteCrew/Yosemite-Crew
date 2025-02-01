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

const BookAppointmentDepartmentDetail = ({navigation}) => {
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
  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiBold
        text={'San Francisco Animal Medical Center'}
        style={styles.headerTitle}
      />
      <View style={styles.headerView}>
        <GText GrMedium text={`${t('team_string')} `} style={styles.teamText} />
        <GText GrMedium text={'(5)'} style={styles.countText} />
      </View>
      <View style={{}}>
        <FlatList
          data={[1, 2, 3, 4, 5]}
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
                      <Image
                        source={Images.DoctorImg}
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
                    onPress={() => {
                      navigation?.navigate('StackScreens', {
                        screen: 'BookAppointment',
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
