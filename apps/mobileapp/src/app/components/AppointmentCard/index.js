import {Image, TouchableOpacity, View} from 'react-native';
import React from 'react';
import {styles} from '../../screens/Home/DashboardTab/bookAppointment/appointmentHistory/styles';
import {colors} from '../../../assets/colors';
import GText from '../GText/GText';
import GButton from '../GButton';
import {scaledValue} from '../../utils/design.utils';
import {Images} from '../../utils';
import {useTranslation} from 'react-i18next';

const AppointmentCard = ({
  imageSource,
  doctorName,
  department,
  qualifications,
  hospitalName,
  appointmentTime,
  showCancel = false,
  navigation,
  confirmed,
  buttonImg,
  buttonText,
  showButton,
  monthly,
  appointmentTitle,
  onPress,
  swiperCardStyle,
  doctorNameTextStyle,
  departmentTextStyle,
  buttonStyle,
  buttonTextStyle,
  buttonIconStyle,
}) => {
  const {t} = useTranslation();
  return (
    <View
      style={[
        styles.swiperCard,
        {
          backgroundColor: confirmed || monthly ? colors.white : colors.appRed,
        },
        swiperCardStyle,
      ]}>
      <View style={styles.cardInnerView}>
        <Image source={imageSource} style={styles.doctorImgStyle} />
        <View style={styles.infoView}>
          <GText
            GrMedium
            componentProps={{numberOfLines: 1}}
            text={doctorName}
            style={[
              styles.doctorNameText,
              {
                color: confirmed || monthly ? '#090A0A' : colors.white,
              },
              doctorNameTextStyle,
            ]}
          />
          <GText
            SatoshiBold
            componentProps={{numberOfLines: 1}}
            text={department}
            style={[
              styles.departmentText,
              {
                color: confirmed || monthly ? colors.darkPurple : '#FFFEFE',
                marginTop: confirmed || monthly ? scaledValue(4) : 0,
              },
              departmentTextStyle,
            ]}
          />
          <GText
            SatoshiBold
            componentProps={{numberOfLines: 1}}
            text={qualifications}
            style={[
              styles.departmentText,
              {
                color: confirmed || monthly ? colors.darkPurple : '#FFFEFE',
              },
              departmentTextStyle,
            ]}
          />
          <GText
            SatoshiBold
            componentProps={{numberOfLines: 1}}
            text={hospitalName}
            style={[
              styles.departmentText,
              {
                color: confirmed || monthly ? colors.darkPurple : '#FFFEFE',
              },
            ]}
          />
        </View>
      </View>
      {monthly && (
        <TouchableOpacity onPress={onPress} style={styles.customButton}>
          <GText GrMedium text={t('see_prescription_string')} />
          <Image source={Images.RightArrow} style={styles.arrowStyle} />
        </TouchableOpacity>
      )}
      {!monthly && (
        <GButton
          icon={Images.Calender}
          iconStyle={[
            styles.iconStyle,
            {
              tintColor: confirmed ? colors.darkPurple : colors.white,
              opacity: 0.7,
            },
            buttonIconStyle,
          ]}
          title={appointmentTime}
          textStyle={[
            styles.buttonText,
            confirmed && {color: colors.darkPurple, opacity: 0.7},
            buttonTextStyle,
          ]}
          style={[
            styles.buttonStyle,
            {backgroundColor: '#F5E1C94D'},
            buttonStyle,
          ]}
        />
      )}
      {showButton && (
        <View
          style={[
            styles.buttonView,
            confirmed && {paddingBottom: scaledValue(8)},
          ]}>
          <GButton
            icon={buttonImg || Images.Direction}
            iconStyle={[
              styles.iconStyle,
              {tintColor: confirmed ? colors.appRed : colors.white},
            ]}
            title={buttonText}
            textStyle={[styles.buttonText, confirmed && {color: colors.appRed}]}
            style={[
              styles.buttonDirectionStyle,
              confirmed && {
                borderWidth: scaledValue(1),
                borderColor: colors.appRed,
              },
            ]}
          />
          <GButton
            onPress={() => {
              navigation?.navigate('StackScreens', {
                screen: 'ChatScreen',
              });
            }}
            icon={Images.Chat}
            iconStyle={[
              styles.iconStyle,
              {tintColor: confirmed ? colors.white : colors.appRed},
            ]}
            title={'Chat'}
            textStyle={[
              styles.buttonText,
              {color: confirmed ? colors.white : colors.appRed},
            ]}
            style={[
              styles.buttonChatStyle,
              confirmed && {backgroundColor: colors.appRed},
            ]}
          />
        </View>
      )}

      {showCancel && (
        <GButton
          onPress={() => {
            if (monthly) {
              navigation?.navigate('StackScreens', {
                screen: 'BookAppointment',
              });
            }
          }}
          icon={monthly ? Images.Calender : Images.CircleClose}
          iconStyle={styles.iconStyle}
          title={appointmentTitle}
          textStyle={[styles.buttonText, monthly && {color: colors.appRed}]}
          style={[styles.buttonStyle, {backgroundColor: 'transparent'}]}
        />
      )}
    </View>
  );
};

export default AppointmentCard;
