import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {useTranslation} from 'react-i18next';
import Swiper from 'react-native-swiper';
import GButton from '../../../../../components/GButton';
import GTextButton from '../../../../../components/GTextButton/GTextButton';
import HeaderButton from '../../../../../components/HeaderButton';

const PainAssessment = ({navigation}) => {
  const {t} = useTranslation();
  const [scrollIndex, setScrollIndex] = useState(0);
  const swiperRef = useRef();

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
          onPress={() => {
            onPressBackButton();
          }}
        />
      ),
    });
  };

  const onPressNextButton = () => {
    if (scrollIndex < pages.length - 1) {
      swiperRef.current.scrollBy(1);
    } else {
      navigation?.navigate('StackScreens', {
        screen: 'PainAssessmentScore',
      });
    }
  };

  const onPressBackButton = () => {
    // Get the current index directly from the Swiper instance
    const currentSwiperIndex = swiperRef.current?.state.index;

    // Log the current swiper index for debugging
    console.log('currentSwiperIndex:', currentSwiperIndex);

    if (currentSwiperIndex > 0) {
      // Scroll back by one screen
      swiperRef.current?.scrollBy(-1);
    } else {
      // If on the first screen, navigate back
      navigation?.goBack();
    }
  };

  const [selectedOptionScreen1, setSelectedOptionScreen1] = useState(null);
  const [selectedOptionScreen2, setSelectedOptionScreen2] = useState(null);
  const [selectedOptionScreen3, setSelectedOptionScreen3] = useState(null);
  const [selectedOptionScreen4, setSelectedOptionScreen4] = useState(null);

  const pages = [
    {
      id: 1,
      screenTitle: t('pain_monitoring_string'),
      description: t('rate_your_pet_string'),
      selectedOption: selectedOptionScreen1,
      setSelectedOption: setSelectedOptionScreen1,
      nextButton: t('next_string'),
      secondButton: '',
      options: [
        {
          id: 1,
          title: t('happy_string'),
          subTitle: t('alert_and_interactive_string'),
        },
        {
          id: 2,
          title: t('not_themselves_string'),
          subTitle: t('alert_but_slightly_string'),
        },
        {
          id: 3,
          title: t('miserable_string'),
          subTitle: t('seems_reluctant_string'),
        },
        {
          id: 4,
          title: t('very_miserable_string'),
          subTitle: t('not_interested_in_what_string'),
        },
      ],
    },
    {
      id: 2,
      screenTitle: t('pain_monitoring_string'),
      description: t('how_painful_text_string'),
      selectedOption: selectedOptionScreen2,
      setSelectedOption: setSelectedOptionScreen2,
      nextButton: t('next_string'),
      secondButton: t('cancel_string'),
      options: [
        {
          id: 1,
          title: t('no_pain_string'),
        },
        {
          id: 2,
          title: t('mild_pain_string'),
        },
        {
          id: 3,
          title: t('moderate_pain_string'),
        },
        {
          id: 4,
          title: t('serve_pain_string'),
        },
      ],
    },
    {
      id: 3,
      screenTitle: t('mobility_monitoring_string'),
      description: t('how_easy_difficult_text_string'),
      selectedOption: selectedOptionScreen3,
      setSelectedOption: setSelectedOptionScreen3,
      nextButton: t('next_string'),
      secondButton: t('cancel_string'),
      options: [
        {
          id: 1,
          title: t('easy_string'),
          subTitle: t('no_stiffness_string'),
        },
        {
          id: 2,
          title: t('slightly_difficult_string'),
          subTitle: t('a_little_stiff_string'),
        },
        {
          id: 3,
          title: t('difficult_string'),
          subTitle: t('mild_stiffness_string'),
        },
        {
          id: 4,
          title: t('very_difficult_string'),
          subTitle: t('obvious_stiffness_string'),
        },
      ],
    },
    {
      id: 4,
      screenTitle: t('review_your_response_string'),
      description: t('review_text_string'),
      nextButton: t('send_to_my_vet_string'),
      secondButton: t('cancel_string'),
      lastPage: true,
    },
  ];

  const renderItem = ({item}) => (
    <ScrollView>
      <GText
        SatoshiBold
        text={`${t('step_string')} ${scrollIndex + 1} ${t('of_string')} 5`}
        style={styles.questionsText}
      />
      <View style={styles.cardContainer}>
        <Image source={Images.Kizi} style={styles.petImg} />
        <GText SatoshiBold text={item?.screenTitle} style={styles.titleText} />
        <GText
          SatoshiRegular
          text={item?.description}
          style={styles.subTitleText}
        />
        {item?.options &&
          item?.options?.map((i, index) => (
            <>
              <TouchableOpacity
                onPress={() => {
                  item?.setSelectedOption(i?.id);
                }}
                key={index}
                style={styles.tileView}>
                <View style={styles.titleView}>
                  <GText
                    GrMedium
                    text={i?.title}
                    style={styles.title(item?.selectedOption, i)}
                  />
                  {i?.subTitle && (
                    <GText
                      SatoshiRegular
                      text={i?.subTitle}
                      style={styles.subTitle}
                    />
                  )}
                </View>
                <Image
                  style={styles.optionImage}
                  source={
                    item?.selectedOption === i?.id
                      ? Images.Circle_Radio
                      : Images.Circle_Button
                  }
                />
              </TouchableOpacity>
              {i.id !== item?.options[item?.options.length - 1].id ? (
                <View style={styles.separator} />
              ) : (
                <View style={styles.separatorEnd} />
              )}
            </>
          ))}
      </View>
      {item?.lastPage == true && (
        <View style={styles.innerView}>
          <FlatList
            data={[1, 2, 3]}
            renderItem={({item, index}) => {
              return (
                <View>
                  <GText
                    SatoshiBold
                    text={t('rate_your_pet_string')}
                    style={styles.rateText}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}>
                    <View>
                      <GText
                        GrMedium
                        text={t('happy_string')}
                        style={styles.happyText}
                      />
                      {index != 1 && (
                        <GText
                          SatoshiRegular
                          text={t('alert_and_interactive_string')}
                          style={styles.subTitle}
                        />
                      )}
                    </View>
                    <GText
                      SatoshiBold
                      text={t('edit_string')}
                      style={styles.editText}
                    />
                  </View>
                  <View style={styles.secondSeparator} />
                </View>
              );
            }}
          />
        </View>
      )}
      <View style={styles.buttonView}>
        <GButton
          onPress={() => {
            onPressNextButton();
          }}
          title={item?.nextButton}
          style={styles.createButton}
          textStyle={styles.buttonText}
        />
        {item?.secondButton && (
          <GTextButton
            title={item?.secondButton}
            titleStyle={styles.skipButton}
          />
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.dashboardMainView}>
      <View style={{height: '100%'}}>
        <Swiper
          ref={swiperRef}
          scrollEnabled={false}
          loop={false}
          bounces={false}
          onIndexChanged={index => setScrollIndex(index)}
          activeDotColor="rgba(3, 165, 190, 1)"
          dotColor="#E9E9E9"
          showsButtons={false}
          activeDotStyle={styles.activeDotStyle}
          dotStyle={styles.dotStyle}
          showsPagination={false}
          paginationStyle={styles.paginationStyle}>
          {pages.map((page, index) => (
            <View key={index} style={{flex: 1}}>
              <FlatList
                bounces={false}
                data={[page]}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                keyExtractor={(item, index) => `${item.screenTitle}-${index}`}
              />
            </View>
          ))}
        </Swiper>
      </View>
    </View>
  );
};

export default PainAssessment;
