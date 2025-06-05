import {
  Dimensions,
  FlatList,
  Image,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from './styles';
import GText from '../../../components/GText/GText';
import { Images } from '../../../utils';
import { scaledValue } from '../../../utils/design.utils';
import GButton from '../../../components/GButton';
import OptionMenuSheet from '../../../components/OptionMenuSheet';
import { useAppSelector } from '../../../redux/store/storeUtils';

import { delete_pet_api, updatePetList } from '../../../redux/slices/petSlice';
import { useDispatch, useSelector } from 'react-redux';
import GImage from '../../../components/GImage';
import LinearGradient from 'react-native-linear-gradient';

const PetProfileList = ({ navigation }) => {
  const refRBSheet = useRef();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [selectPet, setSelectPet] = useState({});
  const petList = useAppSelector((state) => state.pets?.petLists);
  const authState = useAppSelector((state) => state.auth);

  const petListOptionMenu = [
    {
      id: 1,
      title: 'Edit Profile',
      subTitle: '',
      textColor: '#007AFF',
      action: () => {
        navigation?.navigate('StackScreens', {
          screen: 'AddPetDetails',
          params: {
            petDetails: selectPet,
          },
        });
      },
    },

    {
      id: 2,
      title: 'Delete',
      subTitle: '',
      textColor: '#F42626',
      action: () => {
        delete_pet();
      },
    },
  ];

  const CustomProgressBar = ({ percentage }) => {
    // Calculate the filled and remaining width based on the percentage
    const filledWidth = (142 * percentage) / 100;
    const remainingWidth = 142 - filledWidth;

    return (
      <View style={styles.progressBarContainer}>
        {/* Filled part */}
        <View style={[styles.filledBar, { width: filledWidth }]} />
        {/* Remaining part */}
        <View style={[styles.remainingBar, { width: remainingWidth }]} />
      </View>
    );
  };

  const delete_pet = () => {
    const input = {
      petId: selectPet?.id,
    };

    dispatch(delete_pet_api(input)).then((res) => {
      if (delete_pet_api.fulfilled.match(res)) {
        const filteredEntries = petList.entry.filter(
          (item) => item.resource.id !== selectPet?.id
        );
        const updatedBundle = {
          ...petList,
          total: filteredEntries.length,
          entry: filteredEntries,
        };

        dispatch(updatePetList(updatedBundle));
        setSelectPet({});
      }
    });
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerContainer,
          { marginTop: statusBarHeight + scaledValue(20) },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            navigation?.goBack();
          }}
          style={styles.backButton}
        >
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
      <View style={{ marginTop: scaledValue(12) }}>
        <FlatList
          data={petList?.entry}
          contentContainerStyle={{
            paddingBottom: Dimensions.get('window').height / 3,
          }}
          renderItem={({ item, index }) => {
            const petDetails = item?.resource?.extension?.reduce(
              (acc, item) => {
                const value =
                  item?.valueString ??
                  item?.valueDecimal ??
                  item?.valueInteger ??
                  item?.valueBoolean;
                acc[item.title] = value;
                return acc;
              },
              {}
            );

            return (
              <View style={styles.petProfileMainContainer}>
                <View style={styles.petProfileContainer}>
                  <LinearGradient
                    colors={['#D04122', '#FDBD74']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 1 }}
                    style={{ borderRadius: scaledValue(50) }}
                  >
                    <GImage
                      image={petDetails?.petImage?.url}
                      style={styles.petImg}
                      noImageSource={Images.Kizi}
                    />
                  </LinearGradient>

                  <View style={styles.infoView}>
                    <GText
                      GrMedium
                      text={item?.resource?.name[0]?.text}
                      style={styles.petName}
                    />
                    <GText
                      SatoshiMedium
                      text={item?.resource?.animal?.breed?.coding[0]?.display}
                      style={styles.breed}
                    />
                    <View style={styles.otherInfoView}>
                      <GText
                        SatoshiMedium
                        text={item?.resource?.gender}
                        style={styles.gender}
                      />
                      <View style={styles.pointer} />
                      <GText
                        SatoshiMedium
                        text={`${petDetails?.petAge} Y`}
                        style={[
                          styles.gender,
                          {
                            textTransform: 'none',
                          },
                        ]}
                      />
                      <View style={styles.pointer} />
                      <GText
                        SatoshiMedium
                        text={`${petDetails?.petCurrentWeight} lbs`}
                        style={[
                          styles.gender,
                          {
                            textTransform: 'none',
                          },
                        ]}
                      />
                    </View>
                    <CustomProgressBar percentage={10} />
                    <View style={{ flexDirection: 'row' }}>
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
                  onPress={() => {
                    setSelectPet(item?.resource);
                    refRBSheet.current.open();
                  }}
                >
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
        onChoose={(val) => {
          val.action();
          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </View>
  );
};

export default PetProfileList;
