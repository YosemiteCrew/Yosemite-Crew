import React, {useEffect, useRef, useState} from 'react';
import {FlatList, Image, TouchableOpacity, View} from 'react-native';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
import {useAppSelector} from '../../../redux/store/storeUtils';
import {delete_pet_api, updatePetList} from '../../../redux/slices/petSlice';
import {styles} from './styles';
import {Images} from '../../../utils';
import {colors} from '../../../../assets/colors';
import GText from '../../../components/GText/GText';
import GButton from '../../../components/GButton';
import GImage from '../../../components/GImage';
import HeaderButton from '../../../components/HeaderButton';

const PetProfileList = ({navigation}) => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const [selectedPet, setSelectedPet] = useState({});
  const petList = useAppSelector(state => state.pets?.petLists);
  const authState = useAppSelector(state => state.auth);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          // icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          // onPress={() => navigation.goBack()}
          style={styles.headerLeftBtn}
        />
      ),
    });
  }, [navigation]);

  const deletePet = () => {
    dispatch(delete_pet_api({petId: selectedPet?.id})).then(res => {
      if (delete_pet_api.fulfilled.match(res)) {
        const filteredEntries = petList.entry.filter(
          item => item.resource.id !== selectedPet?.id,
        );
        dispatch(
          updatePetList({
            ...petList,
            entry: filteredEntries,
            total: filteredEntries.length,
          }),
        );
        setSelectedPet({});
      }
    });
  };

  const CustomProgressBar = ({percentage}) => {
    const filledWidth = (142 * percentage) / 100;
    const remainingWidth = 142 - filledWidth;
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.filledBar, {width: filledWidth}]} />
        <View style={[styles.remainingBar, {width: remainingWidth}]} />
      </View>
    );
  };

  const renderPetItem = ({item}) => {
    const petDetails = item?.resource?.extension?.reduce((acc, e) => {
      const value =
        e.valueString ?? e.valueDecimal ?? e.valueInteger ?? e.valueBoolean;
      acc[e.title] = value;
      return acc;
    }, {});

    return (
      <View style={styles.petProfileMainContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.petProfileContainer}
          onPress={() =>
            navigation.navigate('StackScreens', {
              screen: 'PetSummary',
              params: {
                petDetails: item,
                item: item,
              },
            })
          }>
          <GImage
            image={item?.petImages}
            style={styles.petImg}
            noImageSource={Images.Kizi}
          />
          <View style={styles.infoView}>
            <GText GrMedium text={item?.name} style={styles.petName} />
            <GText SatoshiMedium text={item?.breed} style={styles.breed} />
            <View style={styles.otherInfoView}>
              <GText SatoshiMedium text={item?.gender} style={styles.gender} />
              <View style={styles.pointer} />
              <GText
                SatoshiMedium
                text={`${item?.petAge} Y`}
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
                text={`${item?.petCurrentWeight} lbs`}
                style={[
                  styles.gender,
                  {
                    textTransform: 'none',
                  },
                ]}
              />
            </View>
            <CustomProgressBar percentage={item?.percentage} />
            <View style={{flexDirection: 'row'}}>
              <GText
                SatoshiBold
                text={`${item?.percentage}%`}
                style={styles.percentageText}
              />
              <GText
                SatoshiMedium
                text={' Profile Complete'}
                style={styles.gender}
              />
            </View>
          </View>
        </TouchableOpacity>

        <Menu style={styles.menuView}>
          <MenuTrigger style={styles.menuTriggerView}>
            <View style={styles.dotView}>
              <Image source={Images.ThreeDots} style={styles.threeDot} />
            </View>
          </MenuTrigger>
          <MenuOptions
            customStyles={{
              optionsWrapper: styles.optionsWrapper,
              optionsContainer: styles.optionsContainer,
            }}>
            <MenuOption
              style={styles.menuOption}
              onSelect={() => {
                setSelectedPet(item);
                navigation.navigate('StackScreens', {
                  screen: 'EditPetDetails',
                  params: {
                    petDetails: item,
                    choosePetData: {
                      petType: {
                        id: 2,
                        value:
                          item?.species === 'Dog'
                            ? 'Dog'
                            : item?.species === 'Cat'
                            ? 'Cat'
                            : 'Horse',
                        title: 'Dog',
                      },
                    },
                  },
                });
              }}>
              <Image source={Images.penBold} style={styles.editImg} />
              <GText
                GrMedium
                style={styles.editText}
                text={t('edit_profile_string')}
              />
            </MenuOption>
            <View style={styles.menuDivider} />
            <MenuOption
              style={styles.menuOption}
              onSelect={() => {
                setSelectedPet(item);
                deletePet();
              }}>
              <Image source={Images.deleteBold} style={styles.editImg} />
              <GText
                GrMedium
                style={styles.editText}
                text={t('delete_profile_string')}
              />
            </MenuOption>
          </MenuOptions>
        </Menu>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={petList}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderPetItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Image source={Images.noPet} style={styles.noPetImage} />
            <GText
              GrMedium
              text={t('sad_to_know_string')}
              style={styles.emptyTitle}
            />
            <GText
              text={t('empty_pet_des_string')}
              style={styles.emptyDescription}
            />
            <GButton
              onPress={() =>
                navigation.navigate('StackScreens', {screen: 'ChooseYourPet'})
              }
              title={t('add_new_pet_string')}
              icon={Images?.PlusIcon}
              iconStyle={styles.iconStyle}
              style={styles.buttonStyle}
            />
          </View>
        }
        contentContainerStyle={styles.contentStyle}
      />

      {petList?.length > 0 && (
        <View style={styles.btnView(insets.bottom)}>
          <GButton
            onPress={() =>
              navigation.navigate('StackScreens', {
                screen: authState?.user ? 'ChooseYourPet' : 'PetSummary',
              })
            }
            title={t('add_new_pet_string')}
            icon={Images?.PlusIcon}
            iconStyle={styles.iconStyle}
            style={styles.buttonStyle}
          />
        </View>
      )}
    </View>
  );
};

export default PetProfileList;
