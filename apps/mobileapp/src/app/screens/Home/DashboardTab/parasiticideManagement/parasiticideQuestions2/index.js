import {Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {colors} from '../../../../../../assets/colors';
import {Images} from '../../../../../utils';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import HeaderButton from '../../../../../components/HeaderButton';

const ParasiticideQuestions2 = ({navigation}) => {
  const {t} = useTranslation();
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={navigation?.goBack}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() =>
            navigation?.navigate('StackScreens', {screen: 'Notifications'})
          }
        />
      ),
    });
  }, []);

  const symptomsList = [
    {id: 1, symptom: 'Show interest in slugs or snails'},
    {id: 2, symptom: 'Lick, chew or eat grass'},
    {
      id: 3,
      symptom: 'Drink from puddles, outdoor water bowls, or standing water',
    },
    {id: 4, symptom: 'Play with toys left outside'},
    {id: 5, symptom: 'Scavenge on discarded food, fox/dog poo, etc.'},
  ];

  const toggleSymptomSelection = symptom => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom],
    );
  };

  const renderSymptomItem = item => (
    <React.Fragment key={item.id}>
      <TouchableOpacity
        onPress={() => toggleSymptomSelection(item.symptom)}
        style={styles.questionButton}>
        <GText
          text={item.symptom}
          style={styles.symptomText(selectedSymptoms, item)}
        />
        <Image
          source={
            selectedSymptoms.includes(item.symptom)
              ? Images.Check_fill
              : Images.UnCheck
          }
          style={styles.rightArrow}
        />
      </TouchableOpacity>
      {item.id !== symptomsList[symptomsList.length - 1].id && (
        <View style={styles.separator} />
      )}
    </React.Fragment>
  );

  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiBold
        text={`${t('questions_string')} 2 ${t('of_string')} 15`}
        style={styles.questionsText}
      />
      <View style={styles.cardContainer}>
        <Image source={Images.Kizi} style={styles.image} />
        <GText
          SatoshiBlack
          text={`${t('risk_of_string')} Lungworm`}
          style={styles.riskText}
        />
        <GText
          SatoshiBold
          text={`${t('does_string')} Kizie ${t('ever_do_string')}`}
          style={styles.descriptionText}
        />
        <View style={styles.symptomsContainer}>
          {symptomsList.map(item => renderSymptomItem(item))}
        </View>
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {screen: 'ParasiticideReport'})
          }
          title={t('next_string')}
          textStyle={styles.buttonTextStyle}
          style={styles.buttonStyle}
        />
      </View>
    </View>
  );
};

export default ParasiticideQuestions2;
