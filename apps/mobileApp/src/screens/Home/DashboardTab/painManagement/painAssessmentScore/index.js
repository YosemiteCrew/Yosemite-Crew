import {Image, ImageBackground, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GButton from '../../../../../components/GButton';
import GTextButton from '../../../../../components/GTextButton/GTextButton';
import HeaderButton from '../../../../../components/HeaderButton';

const PainAssessmentScore = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
    });
  };

  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiBold
        text={'15 August, 2024'}
        style={styles.questionsText}
      />
      <View style={styles.containerView}>
        <ImageBackground source={Images.GreenEclipse} style={styles.eclipse}>
          <Image source={Images.Kizi} style={styles.petImg} />
          <GText
            GrMedium
            text={`Kizi’s ${t('pain_score_string')}`}
            style={styles.scoreText}
          />
          <GText GrMedium text={'03'} style={styles.numberText} />
          <GText GrMedium text={t('low_string')} style={styles.moderateText} />
        </ImageBackground>
      </View>
      <GText
        SatoshiRegular
        text={t('green_eclipse_string')}
        style={styles.description}
      />
      <View style={styles.buttonView(insets)}>
        <GButton
          onPress={() => {}}
          icon={Images.tickImage}
          title={t('create_appointment_string')}
          style={styles.createButton}
        />
        <GButton
          onPress={() => {}}
          title={t('save_pain_journal_string')}
          style={styles.skipButton}
          textStyle={styles.buttonText}
        />
      </View>
    </View>
  );
};

export default PainAssessmentScore;
