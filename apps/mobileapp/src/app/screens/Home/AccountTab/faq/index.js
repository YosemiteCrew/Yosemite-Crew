import {Image, ScrollView, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import GText from '../../../../components/GText/GText';
import {scaledValue} from '../../../../utils/design.utils';
import HeaderButton from '../../../../components/HeaderButton';

const FAQ = ({navigation}) => {
  const {t} = useTranslation();
  const [select, setSelect] = useState(t('all_string'));

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

  const options = [
    {
      id: 1,
      title: t('all_string'),
    },
    {
      id: 2,
      title: t('appointments_string'),
    },
    {
      id: 3,
      title: t('health_records_string'),
    },
    {
      id: 4,
      title: t('using_the_app_string'),
    },
    {
      id: 5,
      title: t('vaccinations_string'),
    },
  ];

  const questions = [
    {
      id: 1,
      question: 'How do I schedule a vet appointment for my pet?',
      onAction: () =>
        navigation?.navigate('StackScreens', {
          screen: 'FAQDetail',
        }),
    },
    {
      id: 2,
      question: "Can I track my pet's vaccination history in the app?",
      onAction: () =>
        navigation?.navigate('StackScreens', {
          screen: 'FAQDetail',
        }),
    },
    {
      id: 3,
      question:
        'How do I connect with a veterinarian for a remote consultation?',
      onAction: () =>
        navigation?.navigate('StackScreens', {
          screen: 'FAQDetail',
        }),
    },
    {
      id: 4,
      question:
        "What should I do if I forget to update my pet's health records?",
      onAction: () =>
        navigation?.navigate('StackScreens', {
          screen: 'FAQDetail',
        }),
    },
    {
      id: 5,
      question: "How do I share my pet's profile with another caregiver?",
      onAction: () =>
        navigation?.navigate('StackScreens', {
          screen: 'FAQDetail',
        }),
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}>
          <View style={styles.optionContainer}>
            {options?.map((item, index) => (
              <TouchableOpacity
                key={item?.id}
                onPress={() => {
                  setSelect(item?.title);
                }}
                style={[
                  styles.optionButton,
                  {
                    borderWidth: select === item?.title ? 0 : scaledValue(1),
                    backgroundColor:
                      select === item?.title ? colors.appRed : 'transparent',
                  },
                ]}>
                <GText
                  GrMedium
                  text={item?.title}
                  style={[
                    styles.optionText,
                    {
                      color:
                        select === item?.title ? colors.white : colors.appRed,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.questionsContainer}>
        {questions?.map((item, index) => (
          <>
            <TouchableOpacity
              onPress={item?.onAction}
              key={item?.id}
              style={styles.questionButton}>
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
  );
};

export default FAQ;
