import {Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import {styles} from './styles';
import HeaderButton from '../../../../../components/HeaderButton';

const FAQDetail = ({navigation}) => {
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.email}
          tintColor={colors.appRed}
          onPress={() => {}}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const questions = [
    {
      id: 3,
      question:
        'How do I connect with a veterinarian for a remote consultation?',
    },
    {
      id: 4,
      question: "How do I share my pet's profile with another caregiver?",
    },
    {
      id: 5,
      question:
        "What should I do if I forget to update my pet's health records?",
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <View style={styles.container}>
        <GText
          GrMedium
          text="How do I schedule a vet appointment for my pet?"
          style={styles.questionTitle}
        />
        <GText
          SatoshiRegular
          text='"Navigate to the ‘Appointments’ section, select your preferred vet, and choose an available time slot."?'
          style={styles.descriptionText}
        />
        <GText
          SatoshiBold
          text="Was this answer helpful?"
          style={styles.helperText}
        />
        <View style={styles.buttonContainer}>
          <GButton
            title="Yes"
            textStyle={styles.buttonText}
            style={styles.button}
          />
          <GButton
            title="No"
            textStyle={styles.buttonText}
            style={styles.button}
          />
        </View>
      </View>
      <View style={styles.relatedQuestionsContainer}>
        <GText
          SatoshiBold
          text="Related Questions"
          style={styles.relatedQuestionText}
        />
        <View style={styles.questionsContainer}>
          {questions?.map((item, index) => (
            <>
              <TouchableOpacity key={item?.id} style={styles.questionButton}>
                <GText
                  SatoshiBold
                  text={item?.question}
                  style={styles.questionText}
                />
                <Image source={Images.RightArrow} style={styles.rightArrow} />
              </TouchableOpacity>
              {item.id !== questions[questions.length - 1].id ? (
                <View style={styles.separator} />
              ) : (
                <View style={styles.separatorEnd} />
              )}
            </>
          ))}
        </View>
      </View>
    </View>
  );
};

export default FAQDetail;
