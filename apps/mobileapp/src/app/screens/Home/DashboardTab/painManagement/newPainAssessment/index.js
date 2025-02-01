import {Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import {scaledValue} from '../../../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import HeaderButton from '../../../../../components/HeaderButton';

const NewPainAssessment = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectButton, setSelectButton] = useState(null);
  const [selectedPetId, setSelectedPetId] = useState(null);
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

  const petList = [
    {
      id: 1,
      name: 'kizie',
      img: Images.Kizi,
    },
    {
      id: 2,
      name: 'Oscar',
      img: Images.CatImg,
    },
  ];

  const handlePetSelection = pet => {
    if (selectedPetId?.id === pet.id) {
      setSelectedPetId(null);
    } else {
      setSelectedPetId(pet);
    }
  };

  const buttons = [
    {
      id: 1,
      title: t('grimace_scale_string'),
      screenName: 'GrimaceScale',
    },
    {
      id: 2,
      title: t('questionnaire_assessment_string'),
      screenName: 'PainAssessment',
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <View style={styles.headerContainer}>
        <GText GrMedium text={t('choose_string')} style={styles.ongoingText} />
        <GText
          GrMedium
          text={` ${t('your_pet_small_string')}`}
          style={styles.plansText}
        />
      </View>
      <View style={styles.petListContainer}>
        {petList.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.petItem,
              {opacity: selectedPetId?.id === item.id ? 0.5 : 1},
            ]}
            onPress={() => handlePetSelection(item)}>
            <Image source={item?.img} style={styles.imgStyle} />
            <GText GrMedium text={item?.name} style={styles.petTitle} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.headerContainer, {marginTop: scaledValue(40)}]}>
        <GText GrMedium text={t('type_string')} style={styles.ongoingText} />
        <GText
          GrMedium
          text={` ${t('of_plan_string')}`}
          style={styles.plansText}
        />
      </View>
      <View style={styles.buttonView}>
        {buttons?.map((i, d) => (
          <GButton
            onPress={() => {
              setSelectButton(i);
            }}
            title={i?.title}
            textStyle={styles.buttonText}
            style={styles.buttonStyle(selectButton, i)}
          />
        ))}
      </View>
      <GButton
        disabled={!selectButton}
        onPress={() => {
          navigation?.navigate('StackScreens', {
            screen: selectButton?.screenName,
          });
        }}
        title={t('continue_string')}
        textStyle={styles.filledButtonText}
        style={styles.filledButtonStyle(insets)}
      />
    </View>
  );
};

export default NewPainAssessment;
