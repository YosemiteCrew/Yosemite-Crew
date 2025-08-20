import {
  Dimensions,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import GTextButton from '../../../../../components/GTextButton/GTextButton';
import HeaderButton from '../../../../../components/HeaderButton';
import {styles} from './styles';
import {scaledValue} from '../../../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const NewExercisePlan = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton icon={Images.bellBold} onPress={() => {}} />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
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
                <GText text={item?.subTitle} style={styles.subTitleText} />
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

      <View
        style={{
          paddingHorizontal: scaledValue(20),
          position: 'absolute',
          bottom: insets.bottom,
          width: Dimensions.get('window').width,
        }}>
        <GButton
          onPress={() => {
            navigation?.navigate('ExercisePlans');
          }}
          title={t('continue_string')}
        />
      </View>
    </View>
  );
};

export default NewExercisePlan;
