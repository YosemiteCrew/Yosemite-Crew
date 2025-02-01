import {Image, View} from 'react-native';
import React, {useEffect} from 'react';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {useTranslation} from 'react-i18next';
import GButton from '../../../../../components/GButton';
import HeaderButton from '../../../../../components/HeaderButton';

const ParasiticideRiskQuestion = ({navigation}) => {
  const {t} = useTranslation();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={navigation.goBack}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() =>
            navigation.navigate('StackScreens', {screen: 'Notifications'})
          }
        />
      ),
    });
  }, [navigation]);

  const handleNavigation = () => {
    navigation.navigate('StackScreens', {screen: 'ParasiticideQuestions2'});
  };

  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiRegular
        text={t('complete_the_questions_string')}
        style={styles.completeQuestionsText}
      />
      <View style={styles.cardContainer}>
        <Image source={Images.Kizi} style={styles.image} />
        <GText
          SatoshiBold
          text={`${t('when_outside_string')} Kizie ${t(
            'pet_allowed_off_string',
          )}`}
          style={styles.descriptionText}
        />
        <View style={styles.buttonContainer}>
          <GButton
            onPress={handleNavigation}
            title={t('yes_string')}
            textStyle={styles.buttonText}
            style={styles.button}
          />
          <GButton
            onPress={handleNavigation}
            title={t('no_string')}
            textStyle={styles.buttonText}
            style={styles.button}
          />
          <GButton
            onPress={handleNavigation}
            title={t('sometimes_string')}
            textStyle={styles.buttonText}
            style={styles.button}
          />
        </View>
      </View>
    </View>
  );
};

export default ParasiticideRiskQuestion;
