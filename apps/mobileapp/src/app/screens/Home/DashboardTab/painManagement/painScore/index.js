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

const PainScore = ({navigation}) => {
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
          tintColor={colors.appRed}
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
          tintColor={colors.darkPurple}
          onPress={() => navigation?.goBack()}
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
        <ImageBackground source={Images.EclipseScore} style={styles.eclipse}>
          <Image source={Images.CatImg} style={styles.petImg} />
          <GText
            GrMedium
            text={`Oscar’s ${t('pain_score_string')}`}
            style={styles.scoreText}
          />
          <GText GrMedium text={'06'} style={styles.numberText} />
          <GText
            GrMedium
            text={t('moderate_string')}
            style={styles.moderateText}
          />
        </ImageBackground>
      </View>
      <GText
        SatoshiRegular
        text={t('pain_score_text_string')}
        style={styles.description}
      />
      <View style={styles.buttonView(insets)}>
        <GButton
          onPress={() => {}}
          title={t('save_pain_journal_string')}
          style={styles.createButton}
          textStyle={styles.buttonText}
        />
        <GTextButton
          title={t('retake_assessment_string')}
          titleStyle={styles.skipButton}
        />
      </View>
    </View>
  );
};

export default PainScore;
