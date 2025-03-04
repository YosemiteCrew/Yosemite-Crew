import {Image, ScrollView, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import GTextButton from '../../../../../components/GTextButton/GTextButton';
import HeaderButton from '../../../../../components/HeaderButton';

const NewExercisePlanStep2 = ({navigation}) => {
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
  const list = [
    {
      id: 1,
      title: t('condition_string'),
      subTitle: t('hind_leg_muscle_string'),
    },
    {
      id: 2,
      title: t('plan_duration_string'),
      subTitle: t('week_string'),
    },
    {
      id: 3,
      title: t('frequency_string'),
      subTitle: t('Daily_string'),
    },
    {
      id: 4,
      title: t('review_string'),
      subTitle: t('fortnightly_string'),
    },
  ];

  const exerciseVideoList = [
    {
      id: 1,
      title: 'Spikey Massage',
      status: '5 mins',
    },
    {
      id: 2,
      title: 'Cavaletti High',
      status: '15 X 3',
    },
    {
      id: 3,
      title: 'Car Ramp',
      status: '15 X 3',
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        <GText
          SatoshiBold
          text={`${t('step_string')} 2 ${t('of_string')} 2`}
          style={styles.questionsText}
        />
        <View style={styles.cardContainer}>
          <Image source={Images.Kizi} style={styles.petImg} />
          <GText
            GrMedium
            text={t('recommended_exercise_plan_string')}
            style={styles.recommendedText}
          />
          <GText
            SatoshiRegular
            text={t('based_on_your_answer_string')}
            style={styles.basedText}
          />
          <View style={styles.questionsContainer}>
            {list?.map((item, index) => (
              <>
                <TouchableOpacity key={item?.id} style={styles.questionButton}>
                  <GText
                    SatoshiBold
                    text={item?.title}
                    style={styles.questionText}
                  />
                  <GText
                    SatoshiRegular
                    text={item?.subTitle}
                    style={styles.subTitleText}
                  />
                </TouchableOpacity>
                {item.id !== list[list.length - 1].id ? (
                  <View style={styles.separator} />
                ) : (
                  <View style={styles.separatorEnd} />
                )}
              </>
            ))}
          </View>
        </View>
        <View style={styles.exerciseView}>
          <GText
            SatoshiBold
            text={t('exercise_plan_string')}
            style={styles.exerciseText}
          />
          {exerciseVideoList?.map((item, index) => (
            <View style={styles.exerciseContainer}>
              <TouchableOpacity>
                <Image source={Images.Video} style={styles.videoThumbnail} />
              </TouchableOpacity>
              <View style={styles.exerciseDetails}>
                <GText
                  GrMedium
                  text={item?.title}
                  style={styles.exerciseTitle}
                />
                <View style={styles.textView}>
                  <GText
                    SatoshiRegular
                    text={item?.status}
                    style={styles.statusText}
                  />
                  <GText
                    SatoshiBold
                    text={t('daily_string')}
                    style={styles.exerciseStatus}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
        <GButton
          onPress={() => {}}
          title={t('save_plans_string')}
          style={styles.createButton}
          textStyle={styles.buttonText}
        />
        <GTextButton
          title={t('cancel_string')}
          titleStyle={styles.skipButton}
        />
      </ScrollView>
    </View>
  );
};

export default NewExercisePlanStep2;
