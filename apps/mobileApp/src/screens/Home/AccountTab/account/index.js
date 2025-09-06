import {
  Alert,
  FlatList,
  Image,
  Linking,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  ViewBase,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../components/GText/GText';
import {scaledHeightValue, scaledValue} from '../../../../utils/design.utils';
import GButton from '../../../../components/GButton';
import {
  delete_user_account,
  logout,
  logout_user,
} from '../../../../redux/slices/authSlice';
import {useDispatch} from 'react-redux';
import {useAppSelector} from '../../../../redux/store/storeUtils';
import GImage from '../../../../components/GImage';
import Modal from 'react-native-modal';
import {updatePetList} from '../../../../redux/slices/petSlice';
import {showToast} from '../../../../components/Toast';

const Account = ({navigation}) => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const userData = useAppSelector(state => state.auth.user);
  const [visibleModal, setVisibleModal] = useState(false);
  const [check, setCheck] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    navigation.setOptions({
      // headerRight: () => (
      //   <TouchableOpacity
      //     style={styles.headerRight}
      //     onPress={() => {
      //       navigation?.navigate('StackScreens', {
      //         screen: 'Notifications',
      //       });
      //     }}>
      //     <Image source={Images.bellBold} style={styles.headerIcon} />
      //   </TouchableOpacity>
      // ),
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
      onAction: () => {
        Linking.openURL('https://dev.yosemitecrew.com/about_us');
      },
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
  const [error, setError] = useState('');

  const deleteAccount = () => {
    dispatch(delete_user_account()).then(res => {
      if (delete_user_account.fulfilled.match(res)) {
        if (res.payload?.status === 1) {
          dispatch(logout());
          dispatch(updatePetList([]));
        }
      }
    });
  };

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.accountsView}>
          <TouchableOpacity
            onPress={() => {
              navigation?.navigate('StackScreens', {
                screen: 'ParentInfo',
              });
            }}
            activeOpacity={0.5}
            style={styles.tileView}>
            <View style={styles.userView}>
              <GImage
                image={userData?.profileImage[0]?.url}
                style={styles.userImg}
              />
              <View style={styles.nameView}>
                <GText
                  GrMedium
                  text={userData?.firstName + ' ' + userData?.lastName}
                  style={styles.userName}
                />
                <GText SatoshiBold text={petList?.length} style={styles.pet} />
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                navigation?.navigate('StackScreens', {
                  screen: 'EditProfile',
                });
              }}>
              <Image source={Images.Pen} style={styles.penImg} />
            </TouchableOpacity>
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
                        image={item?.petImages}
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

                  {/* <View style={styles.qrView}>
                    <Image source={Images?.qrCode} style={styles.qrImg} />
                  </View> */}
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
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setVisible(true);
          }}
          style={styles.deleteView}>
          <Image source={Images.trashFull} style={styles.imgStyle} />

          <GText
            GrMedium
            text={t('delete_account_string')}
            style={styles.titleStyle}
          />
        </TouchableOpacity>
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
      <Modal
        isVisible={visible}
        statusBarTranslucent={true}
        onBackdropPress={() => setVisible(false)}>
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: scaledValue(24),
            paddingVertical: scaledValue(24),
            paddingHorizontal: scaledValue(24),
          }}>
          <View style={{alignItems: 'center'}}>
            <GText
              GrMedium
              style={{
                fontSize: scaledValue(23),
                lineHeight: scaledHeightValue(23 * 1.2),
                letterSpacing: scaledValue(23 * -0.02),
              }}
              text={'Delete Account'}
            />
            <GText
              SatoshiBold
              text={'Are you sure you want to Delete account with us?'}
              style={{
                fontSize: scaledValue(18),
                lineHeight: scaledHeightValue(18 * 1.2),
                letterSpacing: scaledValue(18 * -0.02),
                marginTop: scaledValue(16),
              }}
            />
            <GText
              SatoshiBold
              text={'To delete account re-write your email address.'}
              style={{
                fontSize: scaledValue(14),
                lineHeight: scaledHeightValue(14 * 1.2),
                marginTop: scaledValue(16),
              }}
            />
            <TextInput
              value={userEmail}
              placeholder="Email address here."
              placeholderTextColor="#BFBFBE"
              onChangeText={val => setUserEmail(val)}
              style={{
                borderWidth: scaledValue(1),
                borderColor: colors.jetBlack50,
                width: '100%',
                marginTop: scaledValue(8),
                height: scaledValue(39),
                borderRadius: scaledValue(12),
                paddingHorizontal: scaledValue(14),
              }}
            />
            <GText
              text={error}
              style={{fontSize: scaledValue(14), color: colors.appRed}}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: scaledValue(8),
                marginTop: scaledValue(16),
              }}>
              <GButton
                onPress={() => {
                  if (!userEmail) {
                    setError('Please enter your email address.');
                  } else if (userData !== userEmail) {
                    setError('Incorrect email address.');
                  } else {
                    deleteAccount();
                  }
                }}
                icon={Images.tickImage}
                title={'Yes'}
                style={{
                  gap: scaledValue(6),
                  paddingHorizontal: scaledValue(42),
                  height: scaledValue(48),
                }}
              />
              <GButton
                onPress={() => {
                  setVisible(false);
                }}
                icon={Images.CrossFill}
                iconStyle={{tintColor: colors.jetBlack}}
                title={'No'}
                textStyle={{color: colors.jetBlack}}
                style={{
                  gap: scaledValue(6),
                  backgroundColor: 'transparent',
                  borderWidth: scaledValue(1.5),
                  borderColor: colors.jetBlack,
                  paddingHorizontal: scaledValue(42),
                  height: scaledValue(48),
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Account;
