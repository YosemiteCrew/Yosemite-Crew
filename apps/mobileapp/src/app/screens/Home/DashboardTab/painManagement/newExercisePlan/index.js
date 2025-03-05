import {Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {useTranslation} from 'react-i18next';
import GText from '../../../../../components/GText/GText';
import Input from '../../../../../components/Input';
import GButton from '../../../../../components/GButton';
import GTextButton from '../../../../../components/GTextButton/GTextButton';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import HeaderButton from '../../../../../components/HeaderButton';
import {styles} from './styles';

const NewExercisePlan = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [formValue, setFormValue] = useState({
    concern: '',
    weeks: '',
    current_mobility: '+1',
    pain_level: '',
  });

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
      <GText
        SatoshiBold
        text={`${t('step_string')} 1 ${t('of_string')} 2`}
        style={styles.questionsText}
      />
      <View style={styles.cardContainer}>
        <Image source={Images.Kizi} style={styles.petImg} />
        <View style={styles.formContainer}>
          <Input
            value={formValue.concern}
            label={t('conditions_or_concern_string')}
            onChangeText={value => setFormValue({...formValue, concern: value})}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <Input
            value={formValue.weeks}
            label={t('weeks_since_surgery_string')}
            onChangeText={value => setFormValue({...formValue, weeks: value})}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <TouchableOpacity
            onPress={() => {}}
            style={styles.professionalButton}>
            <GText
              SatoshiRegular
              text={t('current_mobility_string')}
              style={styles.professionalText}
            />
            <Image source={Images.ArrowDown} style={styles.arrowIcon} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {}}
            style={styles.professionalButton}>
            <GText
              SatoshiRegular
              text={t('pain_level')}
              style={styles.professionalText}
            />
            <Image source={Images.ArrowDown} style={styles.arrowIcon} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.buttonView(insets)}>
        <GButton
          onPress={() => {
            navigation?.navigate('NewExercisePlanStep2');
          }}
          title={t('continue_string')}
          style={styles.createButton}
          textStyle={styles.buttonText}
        />
        <GTextButton
          title={t('cancel_string')}
          titleStyle={styles.skipButton}
        />
      </View>
    </View>
  );
};

export default NewExercisePlan;
