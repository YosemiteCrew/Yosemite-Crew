import {Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import GText from '../../../components/GText/GText';
import {scaledValue} from '../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Images} from '../../../utils';
import GButton from '../../../components/GButton';
import ChoosePetBreed from '../../../components/PetBreed';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import {colors} from '../../../../assets/colors';
import HeaderButton from '../../../components/HeaderButton';

const ChooseYourPet = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  const refRBSheet = useRef();
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [selectPetBreed, setSelectPetBreed] = useState('');
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
          style={{paddingHorizontal: scaledValue(20)}}
        />
      ),
    });
  };

  const handlePetSelection = pet => {
    if (selectedPetId?.id === pet.id) {
      setSelectedPetId(null);
    } else {
      setSelectedPetId(pet);
    }
  };

  const petList = [
    {
      id: 1,
      icon: Images.Cat,
      title: t('cat_string'),
      value: 'Cat',
      style: {
        width: scaledValue(100),
        height: scaledValue(110.87),
        top: scaledValue(10),
        marginBottom: scaledValue(10),
      },
    },
    {
      id: 2,
      icon: Images.Dog,
      value: 'Dog',
      title: t('dog_string'),
      style: {
        width: scaledValue(109),
        height: scaledValue(107),
        top: scaledValue(13),
        marginBottom: scaledValue(13),
      },
    },
    {
      id: 3,
      icon: Images.Horse,
      value: 'Horse',
      title: t('horse_string'),
      style: {
        width: scaledValue(99.9),
        height: scaledValue(116.91),
        marginBottom: scaledValue(5),
      },
    },
  ];

  return (
    <View style={styles.container}>
      <GText GrMedium text={t('choose_your_pet_string')} style={styles.title} />
      <GText
        SatoshiRegular
        text={t('select_pet_profile_string')}
        style={styles.subtitle}
      />
      <View style={styles.petListContainer}>
        {petList.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.petItem,
              {opacity: selectedPetId?.id === item.id ? 0.5 : 1},
            ]}
            onPress={() => handlePetSelection(item)}>
            <Image source={item?.icon} style={item?.style} />
            <GText GrMedium text={item?.title} style={styles.petTitle} />
          </TouchableOpacity>
        ))}
      </View>
      <GButton
        disabled={!selectedPetId}
        onPress={() => {
          refRBSheet?.current?.open();
        }}
        title={t('continue_string')}
        style={styles.button}
        textStyle={styles.buttonText}
      />
      <ChoosePetBreed
        refRBSheet={refRBSheet}
        options={breadList}
        value={selectPetBreed}
        pet={selectedPetId}
        continuePress={() => {
          refRBSheet?.current?.close();
          setTimeout(() => {
            navigation?.navigate('AddPetDetails', {
              choosePetData: {
                petBreed: selectPetBreed,
                petType: selectedPetId?.title,
              },
            });
          }, 250);
        }}
        onChoose={val => {
          setSelectPetBreed(val);
        }}
      />
    </View>
  );
};

const breadList = [
  {id: 1, name: 'Affenpinscher'},
  {id: 2, name: 'Afghan Hound'},
  {id: 3, name: 'Alaskan Malamute'},
  {id: 4, name: 'American Bulldog'},
  {id: 5, name: 'American Cocker Spaniel'},
  {id: 6, name: 'Beagle'},
  {id: 7, name: 'Bearded Collie'},
  {id: 8, name: 'Bichon Frise'},
  {id: 11, name: 'Affwenpinscher'},
  {id: 21, name: 'Afghadn Hound'},
  {id: 31, name: 'Alaskadn Malamute'},
  {id: 41, name: 'Americand Bulldog'},
  {id: 51, name: 'Americdan Cocker Spaniel'},
  {id: 61, name: 'Beagdle'},
  {id: 71, name: 'Beardedd Collie'},
  {id: 81, name: 'Bichon Frdise'},
];

export default ChooseYourPet;
