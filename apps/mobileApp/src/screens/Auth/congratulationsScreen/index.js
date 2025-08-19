import {Image, TouchableOpacity, View} from 'react-native';
import React from 'react';
import {Images} from '../../../utils';
import GText from '../../../components/GText/GText';
import {scaledValue} from '../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import {setShowWelcome, setUserData} from '../../../redux/slices/authSlice';
import {useAppDispatch} from '../../../redux/store/storeUtils';

const CongratulationsScreen = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <View style={styles.container}>
      <View style={[styles.header, {marginTop: insets.top + scaledValue(10)}]}>
        <GText
          GrMedium
          text={t('create_profile_string')}
          style={styles.title}
        />
      </View>
      <Image source={Images.CongratulationsImg} style={styles.image} />
      <GText
        GrMedium
        text={t('welcome_family_string')}
        style={styles.subtitle}
      />
      <GText
        text={t('enjoy_these_special_rewards_string')}
        style={styles.desc}
      />

      <View style={styles.rowUpperView}>
        {[
          {
            icon: '🎉',
            title: t('loyal_points_string'),
            desc: t('loyal_points_ready_string'),
          },
          {
            icon: '💸',
            title: t('first_appointment_discount_string'),
            desc: t('save_your_first_vet_visit_string'),
          },
        ].map((item, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.iconWrap}>
              <GText text={item.icon} style={styles.iconText} />
            </View>
            <View style={styles.textWrap}>
              <GText GrMedium text={item.title} style={styles.rewardTitle} />
              <GText text={item.desc} style={styles.rewardDesc} />
            </View>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.btnRow,
          {
            position: 'absolute',
            bottom: insets.bottom + scaledValue(20),
            alignSelf: 'center',
          },
        ]}>
        <TouchableOpacity
          onPress={() => {
            dispatch(setShowWelcome(false));
          }}
          activeOpacity={0.6}
          style={styles.btnOutline}>
          <GText
            GrMedium
            text={t('dashboard_string')}
            style={styles.btnOutlineText}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            dispatch(setShowWelcome(false));
            navigation?.navigate('StackScreens', {
              screen: 'ChooseYourPet',
            });
          }}
          activeOpacity={0.6}
          style={styles.btnSolid}>
          <GText text={t('add_pets_string')} style={styles.btnSolidText} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CongratulationsScreen;
