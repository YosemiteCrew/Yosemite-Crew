import {Image, ImageBackground, StatusBar, View} from 'react-native';
import React from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import {colors} from '../../../../assets/colors';

const SecondSwipe = () => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  return (
    <View style={styles.onboardingMainContainer}>
      <StatusBar backgroundColor={'#FFF2E3'} barStyle="dark-content" />
      <View style={styles.onboardingTitleView(statusBarHeight)}>
        <GText
          Medium
          text={t('monitor_your_pet_health_string')}
          style={styles.onboardingTitleStyle}
        />
        <GText
          text={t('effortlessly_string')}
          style={styles.onboardingSecondTitleStyle(colors.lightGreen)}
        />
      </View>
      <Image source={Images.second_indicator} style={styles.indicator} />
      <Image source={Images.plus} style={styles.secondScreenFirstPlusImage} />

      <Image source={Images.plus} style={styles.secondScreenSecondPlusImage} />

      <View style={styles.secondScreenEclipseImageView}>
        <ImageBackground
          source={Images.third_screen_eclipse}
          style={styles.secondScreenBgEclipse}>
          <ImageBackground
            source={Images.forth_screen_eclipse}
            style={styles.secondScreenSecondBgEclipse}>
            <Image
              source={Images.second_screen_img}
              style={styles.secondScreenBgImage(insets)}
            />
          </ImageBackground>
        </ImageBackground>
      </View>
    </View>
  );
};

export default SecondSwipe;
