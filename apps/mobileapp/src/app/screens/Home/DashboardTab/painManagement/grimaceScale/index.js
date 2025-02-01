import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import Swiper from 'react-native-swiper';
import HeaderButton from '../../../../../components/HeaderButton';

const GrimaceScale = ({navigation}) => {
  const {t} = useTranslation();
  const [scrollIndex, setScrollIndex] = useState(0);

  const swiperRef = useRef();
  const [selectedOptionScreen1, setSelectedOptionScreen1] = useState(null);
  const [selectedOptionScreen2, setSelectedOptionScreen2] = useState(null);
  const [selectedOptionScreen3, setSelectedOptionScreen3] = useState(null);
  const [selectedOptionScreen4, setSelectedOptionScreen4] = useState(null);
  const [selectedOptionScreen5, setSelectedOptionScreen5] = useState(null);

  const onPressNextButton = () => {
    if (scrollIndex < pages.length - 1) {
      swiperRef.current.scrollBy(1);
    } else {
      navigation?.navigate('StackScreens', {
        screen: 'PainScore',
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
          onPress={onPressBackButton}
        />
      ),
    });
  };

  const pages = [
    {
      id: 1,
      screenTitle: t('ear_position_string'),
      selectedOption: selectedOptionScreen1,
      setSelectedOption: setSelectedOptionScreen1,
      options: [
        {
          id: 1,
          img: Images.Ear_Facing,
          title: t('ear_facing_string'),
        },
        {
          id: 2,
          img: Images.Ear_Slightly,
          title: t('ear_slightly_string'),
        },
        {
          id: 3,
          img: Images.Ear_Rotate,
          title: t('ear_rotate_string'),
        },
      ],
    },
    {
      id: 2,
      screenTitle: t('orbit_tightening_string'),
      selectedOption: selectedOptionScreen2,
      setSelectedOption: setSelectedOptionScreen2,
      options: [
        {
          id: 1,
          img: Images.Eye_Opened,
          title: t('eyes_opened_string'),
        },
        {
          id: 2,
          img: Images.Ear_partially,
          title: t('eyes_partially_string'),
        },
        {
          id: 3,
          img: Images.Ear_Rotate,
          title: t('squinted_eyes_string'),
        },
      ],
    },
    {
      id: 3,
      screenTitle: t('muzzle_tension_string'),
      selectedOption: selectedOptionScreen3,
      setSelectedOption: setSelectedOptionScreen3,
      options: [
        {
          id: 1,
          img: Images.Eye_Opened,
          title: t('relaxed_string'),
        },
        {
          id: 2,
          img: Images.Mild_Tense,
          title: t('mild_tense_muzzle'),
        },
        {
          id: 3,
          img: Images.Tense,
          title: t('tense_string'),
        },
      ],
    },
    {
      id: 4,
      screenTitle: t('whisker_change_string'),
      selectedOption: selectedOptionScreen4,
      setSelectedOption: setSelectedOptionScreen4,
      options: [
        {
          id: 1,
          img: Images.Loose,
          title: t('loose_string'),
        },
        {
          id: 2,
          img: Images.Ear_Slightly,
          title: t('slightly_curved_string'),
        },
        {
          id: 3,
          img: Images.Ear_Rotate,
          title: t('straight_and_moving_forward_string'),
        },
      ],
    },
    {
      id: 5,
      screenTitle: t('head_position_string'),
      selectedOption: selectedOptionScreen5,
      setSelectedOption: setSelectedOptionScreen5,
      options: [
        {
          id: 1,
          img: Images.Head_Above,
          title: t('head_above_string'),
        },
        {
          id: 2,
          img: Images.Ear_Slightly,
          title: t('head_aligned_string'),
        },
        {
          id: 3,
          img: Images.Head_Below,
          title: t('head_below_string'),
        },
      ],
    },
  ];

  const renderItem = ({item}) => (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
      <GText
        SatoshiBold
        text={`${t('step_string')} ${scrollIndex + 1} ${t('of_string')} 5`}
        style={styles.questionsText}
      />
      <View style={styles.cardContainer}>
        <Image source={Images.CatImg} style={styles.petImg} />
        <GText SatoshiBold text={item?.screenTitle} style={styles.titleText} />
        <GText
          SatoshiRegular
          text={t('ear_position_text_string')}
          style={styles.subTitleText}
        />
      </View>
      <View style={styles.listView}>
        {item?.options?.map((i, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              item?.setSelectedOption(i?.id);
            }}
            activeOpacity={0.5}
            style={styles.tileStyle(item?.selectedOption, i)}>
            <Image source={i?.img} style={styles.imgStyle} />
            <GText
              GrMedium
              text={i?.title}
              style={styles.titleStyle(item?.selectedOption, i)}
            />
          </TouchableOpacity>
        ))}
      </View>
      <GButton
        onPress={onPressNextButton}
        title={t('next_string')}
        textStyle={styles.filledButtonText}
        style={styles.filledButtonStyle}
      />
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

export default GrimaceScale;
