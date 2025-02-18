import React, {useEffect} from 'react';
import {Image, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import {styles} from './styles';
import HeaderButton from '../../../../../components/HeaderButton';

const IndividualExercises = ({navigation}) => {
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
            navigation?.goBack();
          }}
        />
      ),
    });
  };

  const exerciseList = [
    'Musculoskeletal',
    'Respiratory',
    'Sports',
    'Orthopaedics',
    'Neurological',
    'Post-op',
    'Elderly care',
    'Developmental problems',
  ];

  return (
    <View style={styles.dashboardMainView}>
      <TextRow
        text1={t('which_exercise_string')}
        color1={colors.appRed}
        text2={` ${t('are_you_looking_string')}`}
        color2={colors.darkPurple}
      />
      <SearchBar />
      <TextRow
        text1={t('or_string')}
        color1={colors.appRed}
        text2={` ${t('search_by_type_string')}`}
        color2={colors.darkPurple}
      />
      <ExerciseList exercises={exerciseList} navigation={navigation} />
      <Image source={Images.exerciseImage} style={styles.exerciseImage} />
    </View>
  );
};

const TextRow = ({text1, color1, text2, color2}) => (
  <View style={styles.textRow}>
    <GText GrMedium text={text1} style={[styles.text, {color: color1}]} />
    <GText GrMedium text={text2} style={[styles.text, {color: color2}]} />
  </View>
);

const SearchBar = () => {
  const {t} = useTranslation();

  return (
    <TouchableOpacity style={styles.searchBar}>
      <View style={styles.searchTextContainer}>
        <GText
          SatoshiRegular
          text={t('search_for_string')}
          style={styles.searchText}
        />
        <GText
          SatoshiBold
          text={` ${t('exercise_string')}`}
          style={styles.searchText}
        />
      </View>
      <Image source={Images.Search} style={styles.searchIcon} />
    </TouchableOpacity>
  );
};

const ExerciseList = ({exercises, navigation}) => (
  <View style={styles.exercisesContainer}>
    <View style={styles.exercisesList}>
      {exercises.map((exercise, index) => (
        <TouchableOpacity
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'PostOpExercises',
            });
          }}
          key={index}
          style={styles.exerciseButton}>
          <GText GrMedium text={exercise} style={styles.exerciseText} />
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

export default IndividualExercises;
