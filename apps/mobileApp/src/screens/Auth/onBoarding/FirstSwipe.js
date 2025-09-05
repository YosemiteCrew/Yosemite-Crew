import {
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  StatusBar,
  Text,
  View,
} from 'react-native';
import React from 'react';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';

const FirstSwipe = () => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  return (
    <SafeAreaView style={styles.onboardingMainContainer}>
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

      <Image
        source={Images.FirstOnBoarding}
        style={{
          width: Dimensions.get('window').width, // take full width of screen
          height: Dimensions.get('window').width * 1.265,
          marginTop: 'auto',
        }}
      />
    </SafeAreaView>
  );
};

export default FirstSwipe;
