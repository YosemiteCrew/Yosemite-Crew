import { FlatList, Image, ScrollView, View } from 'react-native';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Images } from '../../../../../utils';
import { colors } from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import { scaledValue } from '../../../../../utils/design.utils';
import CustomProgressBar from '../../../../../components/CustomProgressBar';
import GButton from '../../../../../components/GButton';
import HeaderButton from '../../../../../components/HeaderButton';
import { styles } from './styles';
const ExercisePlans = ({ navigation }) => {
  const { t } = useTranslation();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
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
  const plansList = [
    {
      id: 1,
      exerciseName: t('weight_shifting_string'),
      img: Images.Kizi,
      petName: 'Kizie',
      week: '4 Weeks',
      exerciseList: [
        {
          id: 1,
          title: 'Hind Leg Stands',
          exercise: '15 X 3',
        },
        {
          id: 2,
          title: 'Downhill Walk',
          exercise: '5 mins',
        },
        {
          id: 3,
          title: 'Spikey Massage',
          exercise: '5 mins',
        },
      ],
    },
    {
      id: 2,
      exerciseName: t('prome_exercise_string'),
      img: Images.CatImg,
      petName: 'Oscar',
      week: '2 Weeks',
      exerciseList: [
        {
          id: 1,
          title: 'Hind Leg Stands',
          exercise: '15 X 3',
        },
        {
          id: 2,
          title: 'Adductor Muscle Stretch',
          exercise: '5 mins',
        },
        {
          id: 3,
          title: 'Joint Extension',
          exercise: '5 mins',
        },
      ],
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <GText
            GrMedium
            text={t('on_going_string')}
            style={styles.ongoingText}
          />
          <GText
            GrMedium
            text={` ${t('plans_string')}`}
            style={styles.plansText}
          />
        </View>
        <View>
          <FlatList
            data={plansList}
            renderItem={({ item, index }) => {
              return (
                <View style={styles.cardStyle}>
                  <View style={styles.imgView}>
                    <Image source={item?.img} style={styles.petImgStyle} />
                    <View style={styles.nameView}>
                      <GText
                        GrMedium
                        text={item?.exerciseName}
                        style={styles.weightText}
                      />
                      <View style={styles.petNameView}>
                        <GText
                          SatoshiBold
                          text={item?.petName}
                          style={styles.petName}
                        />
                        <View style={styles.pointer} />
                        <GText
                          SatoshiBold
                          text={item?.week}
                          style={styles.petName}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={styles.progressView}>
                    <CustomProgressBar
                      percentage={21}
                      customWidth={scaledValue(295)}
                    />
                    <View style={styles.percentageView}>
                      <GText
                        SatoshiBold
                        text={'21%'}
                        style={styles.percentageText}
                      />
                      <GText
                        GrMedium
                        text={` ${t('complete_string')}`}
                        style={styles.completeText}
                      />
                    </View>
                    <GText
                      SatoshiBold
                      text={`${t('exercise_plan_string')}`}
                      style={styles.exerciseText}
                    />
                    <View style={styles.mapView}>
                      {item?.exerciseList?.map((item, index) => (
                        <View style={styles.exerciseView}>
                          <GText
                            SatoshiBold
                            text={item?.title}
                            style={styles.exerciseTitle}
                          />
                          <View style={styles.titleView}>
                            <GText
                              SatoshiRegular
                              text={item?.exercise}
                              style={styles.exerciseTextStyle}
                            />
                            <GText
                              SatoshiBold
                              text={` ${t('daily_string')}`}
                              style={styles.dailyText}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>
        <GButton
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'CreateNewPlan',
            });
          }}
          title={t('create_new_plan_string')}
          icon={Images.PlusIcon}
          iconStyle={styles.iconStyle}
          style={styles.buttonStyle}
          textStyle={styles.buttonTextStyle}
        />
      </ScrollView>
    </View>
  );
};

export default ExercisePlans;
