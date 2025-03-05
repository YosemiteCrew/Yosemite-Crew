import {
  Dimensions,
  FlatList,
  Image,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {styles} from './styles';
import GText from '../../../components/GText/GText';
import {Images} from '../../../utils';
import {scaledValue} from '../../../utils/design.utils';
import GButton from '../../../components/GButton';
import OptionMenuSheet from '../../../components/OptionMenuSheet';
import {useAppSelector} from '../../../redux/store/storeUtils';

import {addPet} from '../../../redux/slices/petSlice';
import {useDispatch, useSelector} from 'react-redux';

const PetProfileList = ({navigation}) => {
  const refRBSheet = useRef();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const petList = useAppSelector(state => state.pets?.petLists);
  console.log('petList0123', petList);

  const authState = useAppSelector(state => state.auth);
  // const petList = [
  //   {
  //     id: 1,
  //     img: Images.Kizi,
  //     name: 'Kizie',
  //     breed: 'Beagle',
  //     gender: 'Female',
  //     age: '3Y',
  //     weight: '28 lbs',
  //     profile_percentage: '21',
  //   },
  //   {
  //     id: 2,
  //     img: Images.CatImg,
  //     name: 'Oscar',
  //     breed: 'Egyptian Mau',
  //     gender: 'Male',
  //     age: '2Y',
  //     weight: '12 lbs',
  //     profile_percentage: '96',
  //   },
  // ];

  const petListOptionMenu = [
    {
      id: 1,
      title: 'Edit Profile',
      subTitle: '',
      textColor: '#007AFF',
      action: () => {},
    },

    {
      id: 2,
      title: 'Delete',
      subTitle: '',
      textColor: '#F42626',
      action: () => {},
    },
  ];

  const CustomProgressBar = ({percentage}) => {
    // Calculate the filled and remaining width based on the percentage
    const filledWidth = (167 * percentage) / 100;
    const remainingWidth = 167 - filledWidth;

    return (
      <View style={styles.progressBarContainer}>
        {/* Filled part */}
        <View style={[styles.filledBar, {width: filledWidth}]} />
        {/* Remaining part */}
        <View style={[styles.remainingBar, {width: remainingWidth}]} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerContainer,
          {marginTop: statusBarHeight + scaledValue(20)},
        ]}>
        <TouchableOpacity
          onPress={() => {
            navigation?.goBack();
          }}
          style={styles.backButton}>
          <Image
            source={Images.Left_Circle_Arrow}
            style={styles.backButtonImage}
          />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <GText
            GrMedium
            text={t('your_pets_string')}
            style={styles.headerText}
          />
        </View>
      </View>
      <View style={{marginTop: scaledValue(12)}}>
        <FlatList
          data={petList}
          contentContainerStyle={{
            paddingBottom: Dimensions.get('window').height / 3,
          }}
          renderItem={({item, index}) => {
            return (
              <View style={styles.petProfileMainContainer}>
                <View style={styles.petProfileContainer}>
                  <View style={{}}>
                    <Image source={Images.CatImg} style={styles.petImg} />
                  </View>
                  <View style={styles.infoView}>
                    <GText GrMedium text={item?.petName} style={styles.petName} />
                    <GText
                      SatoshiMedium
                      text={item?.petBreed}
                      style={styles.breed}
                    />
                    <View style={styles.otherInfoView}>
                      <GText
                        SatoshiMedium
                        text={item?.gender}
                        style={styles.gender}
                      />
                      <View style={styles.pointer} />
                      <GText
                        SatoshiMedium
                        text={item?.ageWhenNeutered}
                        style={styles.gender}
                      />
                      <View style={styles.pointer} />
                      <GText
                        SatoshiMedium
                        text={item?.petCurrentWeight}
                        style={styles.gender}
                      />
                    </View>
                    <CustomProgressBar percentage={10} />
                    <View style={{flexDirection: 'row'}}>
                      <GText
                        GrMedium
                        text={`${10}%`}
                        style={styles.percentageText}
                      />
                      <GText
                        SatoshiMedium
                        text={' Profile Complete'}
                        style={styles.gender}
                      />
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  hitSlop={styles.hitSlop}
                  onPress={() => refRBSheet.current.open()}>
                  <Image source={Images.ThreeDots} style={styles.threeDot} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>
      <GButton
        onPress={async () => {
          if (!authState?.user) {
            navigation?.navigate('PetSummary');
          } else {
            navigation?.navigate('StackScreens', {
              screen: 'ChooseYourPet',
            });
          }
        }}
        title={t('add_new_pet_string')}
        icon={Images?.PlusIcon}
        iconStyle={styles.iconStyle}
        style={styles.buttonStyle}
        textStyle={styles.buttonText}
      />

      <OptionMenuSheet
        refRBSheet={refRBSheet}
        options={petListOptionMenu}
        onChoose={val => {
          val.action();
          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </View>
  );
};

export default PetProfileList;
