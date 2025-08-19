import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
  ViewBase,
} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../components/GText/GText';
import {scaledValue} from '../../../../utils/design.utils';
import GButton from '../../../../components/GButton';
import {logout, logout_user} from '../../../../redux/slices/authSlice';
import {useDispatch} from 'react-redux';
import {useAppSelector} from '../../../../redux/store/storeUtils';
import GImage from '../../../../components/GImage';

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
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'Terms',
        });
      },
    },
    {
      id: 4,
      title: t('privacy_policy_string'),
      img: Images.Privacy,
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'Privacy',
        });
      },
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

  const petList = useAppSelector(state => state.pets?.petLists);

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.accountsView}>
          <TouchableOpacity
            onPress={() => {
              navigation?.navigate('StackScreens', {
                screen: 'EditProfile',
              });
            }}
            activeOpacity={0.5}
            style={styles.tileView}>
            <View style={styles.userView}>
              <Image source={Images.User} style={styles.userImg} />
              <View style={styles.nameView}>
                <GText GrMedium text={'Sky B'} style={styles.userName} />
                <GText SatoshiBold text={'2 Pets'} style={styles.pet} />
              </View>
            </View>

            <Image source={Images.Pen} style={styles.penImg} />
          </TouchableOpacity>
          {petList?.length > 1 && <View style={styles.lineView} />}

          <FlatList
            data={petList}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({item, index}) => (
              <View style={styles.flatListView}>
                <TouchableOpacity
                  onPress={() => {
                    navigation?.navigate('StackScreens', {
                      screen: 'PetProfile',
                      params: {
                        petData: item,
                      },
                    });
                  }}
                  style={styles.profileView}>
                  <View style={styles.imgView}>
                    <View style={styles.petImageBorder}>
                      <GImage
                        image={item?.petImage}
                        style={styles.petImage}
                        noImageSource={Images.Kizi}
                      />
                    </View>

                    <View style={styles.profileData}>
                      <GText
                        SatoshiBold
                        text={item?.name}
                        style={styles.userName}
                      />
                      {item?.breed && (
                        <GText
                          SatoshiBold
                          text={item?.breed}
                          style={styles.petBreed}
                        />
                      )}

                      <View style={styles.petDetailView}>
                        <GText
                          SatoshiMedium
                          text={item?.gender}
                          style={[
                            styles.petGender,
                            {textTransform: 'capitalize'},
                          ]}
                        />
                        <GText
                          SatoshiMedium
                          text={`• ${item?.petAge}Y`}
                          style={styles.petGender}
                        />
                        <GText
                          SatoshiMedium
                          text={`• ${item?.petCurrentWeight} lbs`}
                          style={styles.petGender}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.qrView}>
                    <Image source={Images?.qrCode} style={styles.qrImg} />
                  </View>
                </TouchableOpacity>

                {/* Show line only if not the last item */}
                {index !== petList?.length - 1 && (
                  <View style={styles.lineView} />
                )}
              </View>
            )}
          />
        </View>

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
              <View style={styles.divider} />
            </>
          ))}
        </View>
        <View style={styles.deleteView}>
          <Image source={Images.trashFull} style={styles.imgStyle} />

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
            style={[styles.currentTitleStyle, {color: colors.jetBlack}]}
          />
        </View>
        <GButton
          onPress={() => {
            dispatch(logout_user());
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
