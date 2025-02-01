import {
  Image,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import HeaderButton from '../../../../../components/HeaderButton';

const TreadMill = ({navigation}) => {
  const {t} = useTranslation();

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() => {}}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
    });
  };
  return (
    <View style={styles.dashboardMainView}>
      <ScrollView>
        <View style={styles.mainView}>
          <ImageBackground source={Images.Video} style={styles.imageBackground}>
            <TouchableOpacity>
              <Image source={Images.Pause} style={styles.pauseImage} />
            </TouchableOpacity>
          </ImageBackground>
          <View style={styles.innerContainer}>
            <GText
              GrMedium
              text={t('treadmill_string')}
              style={styles.treadmillText}
            />
            <View style={styles.rowContainer}>
              <GText
                SatoshiBold
                text={t('basic_string')}
                style={styles.basicText}
              />
              <View style={styles.redDot} />
              <GText
                SatoshiBold
                text={t('post_op_string')}
                style={styles.basicText}
              />
              <View style={styles.redDot} />
              <GText
                SatoshiBold
                text={t('sports_string')}
                style={styles.basicText}
              />
            </View>
            <GText
              SatoshiRegular
              text={t('treadmill_text_string')}
              style={styles.descriptionText}
            />
            <GText
              GrMedium
              text={t('getting_on_the_treadmill_string')}
              style={styles.headingText}
            />
            <GText
              SatoshiRegular
              text={t('treadmill_text2_string')}
              style={styles.additionalText}
            />
          </View>
        </View>
      </ScrollView>
      <GButton
        title={t('if_you_find_helpful_string')}
        icon={Images.HeartBold}
        iconStyle={styles.buttonIcon}
        textStyle={styles.buttonText}
        style={styles.button}
      />
    </View>
  );
};

export default TreadMill;
