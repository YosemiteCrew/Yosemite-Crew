import {
  Dimensions,
  Image,
  ImageBackground,
  StatusBar,
  View,
} from 'react-native';
import React from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import {colors} from '../../../../assets/colors';

const ThirdSwipe = () => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  return (
    <View style={styles.onboardingMainContainer}>
      <StatusBar backgroundColor={'#FFF2E3'} barStyle="dark-content" />
      <View style={styles.onboardingTitleView(statusBarHeight)}>
        <GText
          Medium
          text={t('schedule_vet_appointments_string')}
          style={styles.onboardingTitleStyle}
        />
        <GText
          text={t('easily_string')}
          style={styles.onboardingSecondTitleStyle(colors.lightPurple)}
        />
      </View>
      <Image source={Images.third_indicator} style={styles.indicator} />
      <Image
        source={Images.ThirdOnBoarding}
        style={{
          width: Dimensions.get('window').width, // take full width of screen
          height: Dimensions.get('window').width * 1.265,
          marginTop: 'auto',
        }}
      />
    </View>
  );
};

export default ThirdSwipe;
