import {Image, ScrollView, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../components/GText/GText';
import {scaledValue} from '../../../../utils/design.utils';
import GButton from '../../../../components/GButton';
import {logout} from '../../../../redux/slices/authSlice';
import {useDispatch} from 'react-redux';

const Account = ({navigation}) => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}>
          <Image source={Images.bellBold} style={styles.headerIcon} />
        </TouchableOpacity>
      ),
    });
  }, []);

  const options = [
    {
      id: 1,
      title: t('faq_string'),
      img: Images.FAQ,
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'FAQ',
        });
      },
    },
    {
      id: 2,
      title: t('about_us_string'),
      img: Images.About,
      onAction: () => {},
    },
    {
      id: 3,
      title: t('terms_and_conditions_string'),
      img: Images.Terms,
      onAction: () => {},
    },
    {
      id: 4,
      title: t('privacy_policy_string'),
      img: Images.Privacy,
      onAction: () => {},
    },
    {
      id: 5,
      title: t('contact_us_string'),
      img: Images.Contact,
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'ContactUs',
        });
      },
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity activeOpacity={0.5} style={styles.tileView}>
          <View style={styles.userView}>
            <Image source={Images.User} style={styles.userImg} />
            <View style={styles.nameView}>
              <GText GrMedium text={'Sky B'} style={styles.userName} />
              <GText SatoshiBold text={'2 Pets'} style={styles.pet} />
            </View>
          </View>
          <Image source={Images.Pen} style={styles.penImg} />
        </TouchableOpacity>
        <View style={styles.mapView}>
          {options?.map((item, index) => (
            <>
              <TouchableOpacity
                onPress={item?.onAction}
                style={styles.optionView}>
                <View style={styles.imgTitleView}>
                  <Image source={item?.img} style={styles.imgStyle} />
                  <GText
                    GrMedium
                    text={item?.title}
                    style={styles.titleStyle}
                  />
                </View>
                <Image source={Images.RightArrow} style={styles.arrowImg} />
              </TouchableOpacity>
              {item.id !== options[options.length - 1].id ? (
                <View style={styles.divider} />
              ) : (
                <View style={{marginVertical: scaledValue(17)}} />
              )}
            </>
          ))}
        </View>
        <View style={styles.imgTitleView}>
          <Image source={Images.Delete} style={styles.imgStyle} />
          <GText
            GrMedium
            text={t('delete_account_string')}
            style={styles.titleStyle}
          />
        </View>
        <View style={styles.versionView}>
          <GText
            SatoshiBold
            text={t('current_app_version_string')}
            style={styles.currentTitleStyle}
          />
          <GText
            SatoshiBold
            text={'1.0.0'}
            style={[styles.currentTitleStyle, {color: colors.appRed}]}
          />
        </View>
        <GButton
          onPress={() => {
            dispatch(logout());
          }}
          title={t('logout_string')}
          icon={Images.Logout}
          iconStyle={styles.iconStyle}
          style={styles.buttonStyle}
          textStyle={styles.buttonText}
        />
      </ScrollView>
    </View>
  );
};

export default Account;
