import {Image, ImageBackground, StatusBar, Text, View} from 'react-native';
import React from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';

const FirstSwipe = () => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  return (
    <View style={styles.onboardingMainContainer}>
      <StatusBar backgroundColor={'#FFF2E3'} barStyle="dark-content" />
      <View style={styles.firstScreenTitleView(statusBarHeight)}>
        <GText
          Medium
          text={t('pet_health_string')}
          style={styles.petHealthText}
        />
        <GText text={t('simplified_string')} style={styles.simplifiedText} />
      </View>
      <Image source={Images.first_indicator} style={styles.indicator} />
      <Image source={Images.plus} style={styles.firstScreenFirstPlusImage} />
      <Image source={Images.plus} style={styles.firstScreenSecondPlusImage} />
      <ImageBackground
        source={Images.first_screen_eclipse}
        style={styles.firstScreenBgEclipse}>
        <ImageBackground
          source={Images.second_screen_eclipse}
          style={styles.firstScreenSecondBgEclipse}>
          <ImageBackground
            source={Images.first_screen_img}
            style={styles.firstScreenBgImage(insets)}></ImageBackground>
        </ImageBackground>
      </ImageBackground>
    </View>
  );
};

export default FirstSwipe;
