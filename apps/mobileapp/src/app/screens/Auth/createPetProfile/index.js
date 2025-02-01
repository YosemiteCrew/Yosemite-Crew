import {Image, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {Images} from '../../../utils';
import {scaledValue} from '../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import GButton from '../../../components/GButton';
import GTextButton from '../../../components/GTextButton/GTextButton';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import Modal from 'react-native-modal';
import RewardPointCard from './RewardPointCard';
import {useAppDispatch, useAppSelector} from '../../../redux/store/storeUtils';
import {setUserData} from '../../../redux/slices/authSlice';

const CreatePetProfile = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const userData = useAppSelector(state => state.auth.user);

  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => {
      setVisible(true);
    }, 300);
  }, []);

  const list = [
    {
      id: 1,
      title: t('track_your_pet_string'),
      icon: Images.Green_Circle,
    },
    {
      id: 2,
      title: t('get_reminders_string'),
      icon: Images.Red_Circle,
    },
    {
      id: 3,
      title: t('monitor_your_pet_string'),
      icon: Images.Yellow_Circle,
    },
  ];

  return (
    <>
      <View style={styles.container}>
        <Image
          source={Images.Create_pet_profile}
          style={[
            styles.profileImage,
            {marginTop: statusBarHeight + scaledValue(64)},
          ]}
        />
        <GText
          GrMedium
          text={t('add_your_furry_friend_string')}
          style={styles.headerText}
        />
        <GText
          SatoshiRegular
          text={t('create_a_new_pet_profile_string')}
          style={styles.subHeaderText}
        />
        <View style={styles.listContainer}>
          {list.map((item, index) => {
            return (
              <View style={styles.listItem} key={item.id}>
                <Image source={item?.icon} style={styles.icon} />
                <GText SatoshiBold text={item?.title} style={styles.itemText} />
              </View>
            );
          })}
        </View>
        <GButton
          onPress={() => {
            navigation?.navigate('ChooseYourPet');
            // setVisible(true);
          }}
          title={t('create_pet_profile_string')}
          style={styles.createButton}
          textStyle={styles.buttonText}
        />
        <GTextButton
          onPress={() => {
            dispatch(
              setUserData(prevState => ({
                ...prevState,
                isSkip: 1,
              })),
            );
          }}
          title={t('skip_for_now_string')}
          titleStyle={styles.skipButton}
        />
      </View>
      <Modal isVisible={visible}>
        <View style={styles.modalContainer}>
          <Image source={Images.rewardImage} style={styles.rewardImage} />
          <View style={styles.titleContainer}>
            <GText
              GrMedium
              text={t('reward_welcome_string')}
              style={styles.titleRedText}
            />
            <GText
              GrMedium
              text={` ${t('to_the_family_string')}`}
              style={styles.titleBlackText}
            />
          </View>
          <GText
            SatoshiRegular
            text={t('enjoy_these_special_rewards_string')}
            style={styles.descText}
          />
          <RewardPointCard
            title={t('loyal_points_string')}
            subTitle={t('loyal_points_ready_string')}
            icon={Images.rewardSpark}
            containerStyle={{marginBottom: scaledValue(20)}}
          />

          <RewardPointCard
            title={t('first_appointment_discount_string')}
            subTitle={t('save_your_first_vet_visit_string')}
            icon={Images.rewardMoney}
          />

          <GButton
            onPress={() => {
              setVisible(false);
              // navigation?.navigate('ChooseYourPet');
            }}
            title={t('add_your_first_pet_string')}
            icon={Images.petFoot}
            iconStyle={styles.buttonIcon}
            style={styles.addPetButton}
            textStyle={styles.addPetButtonText}
          />
        </View>
      </Modal>
    </>
  );
};

export default CreatePetProfile;
