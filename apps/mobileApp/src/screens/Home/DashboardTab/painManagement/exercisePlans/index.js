import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import CustomProgressBar from '../../../../../components/CustomProgressBar';
import GButton from '../../../../../components/GButton';
import HeaderButton from '../../../../../components/HeaderButton';
import {styles} from './styles';
import ToggleButton from '../../../../../components/ToogleButton';

const ExercisePlans = ({navigation}) => {
  const {t} = useTranslation();
  const [selectReminder, setSelectReminder] = useState(null);
  const [toggleState, setToggleState] = useState(true);

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
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
    // {
    //   id: 2,
    //   exerciseName: t('prome_exercise_string'),
    //   img: Images.CatImg,
    //   petName: 'Oscar',
    //   week: '2 Weeks',
    //   exerciseList: [
    //     {
    //       id: 1,
    //       title: 'Hind Leg Stands',
    //       exercise: '15 X 3',
    //     },
    //     {
    //       id: 2,
    //       title: 'Adductor Muscle Stretch',
    //       exercise: '5 mins',
    //     },
    //     {
    //       id: 3,
    //       title: 'Joint Extension',
    //       exercise: '5 mins',
    //     },
    //   ],
    // },
  ];

  const reminderList = [
    {
      id: 1,
      reminder: '30 mins prior',
    },
    {
      id: 2,
      reminder: '1 hour prior',
    },
    {
      id: 3,
      reminder: '12 hours prior',
    },
    {
      id: 4,
      reminder: '1 day prior',
    },
    {
      id: 5,
      reminder: '3 days prior',
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <GText
            GrMedium
            text={`${t('on_going_plan_string')}`}
            style={styles.plansText}
          />
        </View>
        <View>
          <FlatList
            data={plansList}
            renderItem={({item, index}) => {
              return (
                <View style={styles.cardStyle}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
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
                    <TouchableOpacity>
                      <Image
                        source={Images.info}
                        style={{
                          width: scaledValue(24),
                          height: scaledValue(24),
                        }}
                      />
                    </TouchableOpacity>
                  </View>
                  <Image
                    source={Images.exercise_frame}
                    style={{
                      width: scaledValue(295),
                      height: scaledValue(124),
                      marginTop: scaledValue(20),
                    }}
                  />
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
          <View style={styles.dateRow}>
            <GText
              SatoshiBold
              text={t('reminder_string')}
              style={styles.dateText}
            />
            <ToggleButton
              toggleState={toggleState}
              setToggleState={setToggleState}
            />
          </View>
          <View style={styles.reminderView}>
            {reminderList?.map((item, index) => (
              <TouchableOpacity
                onPress={() => {
                  setSelectReminder(item.id);
                }}
                style={styles.placeView(selectReminder, item.id)}>
                <GText
                  SatoshiRegular
                  text={item.reminder}
                  style={styles.placeText(selectReminder, item.id)}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <GButton
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'TreadMill',
            });
          }}
          title={t('done_for_today_string')}
          icon={Images.tickImage}
          style={styles.buttonStyle}
        />
      </ScrollView>
    </View>
  );
};

export default ExercisePlans;
