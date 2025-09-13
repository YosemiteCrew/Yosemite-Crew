import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  View,
  Text,
} from 'react-native';
import {Images} from '../../../../../utils';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import {colors} from '../../../../../../assets/colors';
import {scaledValue} from '../../../../../utils/design.utils';
import GText from '../../../../../components/GText/GText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GButton from '../../../../../components/GButton';

import React, {useState, useRef} from 'react';
import {useAppSelector} from '../../../../../redux/store/storeUtils';
import GImage from '../../../../../components/GImage';
// import ContactOption from './ContactOption';

const ContactVet = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const petList = useAppSelector(state => state.pets?.petLists);

  const [selectPet, setSelectPet] = useState({});

  const handlePetSelection = pet => {
    if (selectPet?.id === pet?.resource?.id) {
      setSelectPet(null);
    } else {
      setSelectPet(pet?.resource);
    }
  };
  const renderPetItem = ({item}) => {
    const petDetails = item?.resource?.extension?.reduce((acc, item) => {
      acc[item.title] = item.valueString;
      return acc;
    }, {});

    const isSelected = selectPet?.id === item?.resource?.id;
    return (
      <TouchableOpacity
        onPress={() => handlePetSelection(item)}
        style={styles.petItemContainer}
        activeOpacity={0.7}>
        <View style={styles.petImageBorder(isSelected)}>
          <GImage
            image={petDetails?.petImage?.url}
            style={styles.petImage}
            noImageSource={Images.Kizi}
          />
        </View>
        <GText
          SatoshiBold
          text={item?.resource?.name[0]?.text}
          style={styles.petNameText}
        />
        <View style={styles.petUnderline(isSelected)} />
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={Images.contactVet}
          style={[
            styles.imageBackground,
            {
              marginTop:
                Platform.OS == 'android' ? scaledValue(-20) : scaledValue(14),
            },
          ]}>
          <View
            style={[
              styles.headerView,
              {
                marginTop:
                  Platform.OS == 'android'
                    ? statusBarHeight + scaledValue(50)
                    : statusBarHeight,
              },
            ]}>
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => {
                navigation?.goBack();
              }}>
              <Image
                source={Images.arrowLeftOutline}
                style={styles.headerIcon}
                tintColor={colors.jetBlack}
              />
            </TouchableOpacity>
            <GText
              GrMedium
              text={t('choose_vet_string')}
              style={styles.contactText}
            />
            <TouchableOpacity style={styles.headerRight} onPress={() => {}}>
              <Image source={Images.bellBold} style={styles.headerIcon} />
            </TouchableOpacity>
          </View>
        </ImageBackground>
        <GText GrMedium text={t('send_an_string')} style={styles.happyText} />

        <GText
          GrMedium
          text={t('choose_a_companion_string')}
          style={styles.petsText}
        />

        <FlatList
          data={petList}
          style={{marginTop: scaledValue(15)}}
          horizontal
          contentContainerStyle={styles.petList}
          renderItem={renderPetItem}
        />

        <TextInput
          multiline={true}
          placeholder={t('desc_issue_string')}
          placeholderTextColor={colors.jetBlack300}
          style={styles.textInputStyle}
        />
        <View style={styles.uploadImageView}>
          <Image style={styles.uploadImage} source={Images.Upload} />
          <GText
            GrMedium
            text={t('upload_image_string')}
            style={styles.uploadText}
          />
          <GText text={t('maximum_string')} style={styles.maxSize} />
        </View>
        <GButton
          title={'Send Message'}
          style={[styles.buttonStyle(insets.bottom)]}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ContactVet;
