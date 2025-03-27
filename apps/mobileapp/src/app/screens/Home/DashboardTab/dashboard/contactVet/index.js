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
import Input from '../../../../../components/Input';
import GButton from '../../../../../components/GButton';

import React, {useState, useRef} from 'react';
// import ContactOption from './ContactOption';

const ContactVet = ({navigation}) => {
  const {t} = useTranslation();
  const refRBSheet = useRef();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const [subject, setSubject] = useState('');
  const [contactOption, setContactOption] = useState('general');
  const [selectedSubmitRequest, setSelectedSubmitRequest] = useState('');
  const [selectedSubmitRequestTo, setSelectedSubmitRequestTo] = useState('');
  const [selectedConfirmTerm, setSelectedConfirmTerm] = useState('');

  const options = [
    {type: 'general', title: 'General Enquiry'},
    {type: 'feature', title: 'Feature Request'},
    {type: 'dsar', title: 'DSAR'},
  ];
  const petList = [
    {id: 1, name: 'Kizie', img: Images.Kizi},
    {id: 2, name: 'Oscar', img: Images.CatImg},
  ];

  const [selectPet, setSelectPet] = useState({});
  const handlePetSelection = pet => {
    if (selectPet?.id === pet.id) {
      setSelectPet(null);
    } else {
      setSelectPet(pet);
    }
  };
  const renderPetItem = ({item}) => (
    <TouchableOpacity
      onPress={() => handlePetSelection(item)}
      style={{opacity: selectPet?.id === item.id ? 0.5 : 1}}>
      <Image source={item.img} style={styles.petImage} />
      <GText SatoshiBold text={item.name} style={styles.petNameText} />
    </TouchableOpacity>
  );

  // const renderContactOption = (optionType, title) => (
  //   <ContactOption
  //     icon={
  //       contactOption === optionType
  //         ? Images.Circle_Radio
  //         : Images.Circle_Button
  //     }
  //     title={title}
  //     onPress={() => setContactOption(optionType)}
  //     titleStyle={{
  //       color: contactOption === optionType ? colors.appRed : colors.darkPurple,
  //     }}
  //   />
  // );

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      {/* <View style={styles.dashboardMainView}> */}
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
                tintColor={colors.darkPurple}
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
        <View style={styles.helpTextContainer}>
          <GText GrMedium text={t('send_an_string')} style={styles.happyText} />
          <GText
            GrMedium
            text={t('emergency_message_string')}
            style={styles.helpText}
          />
        </View>
        <View style={styles.companionView}>
          <GText
            GrMedium
            //
            text={t('choose_a_companion_string')}
            style={styles.petsText}
          />

          <View style={styles.petListContainer}>
            <FlatList
              data={petList}
              horizontal
              contentContainerStyle={styles.petList}
              renderItem={renderPetItem}
            />
          </View>
        </View>

        <TextInput
          multiline={true}
          placeholder={'Describe your issue'}
          placeholderTextColor={'#aaa'}
          style={styles.textInputStyle}
        />
        <View style={styles.uploadImageView}>
          <Image style={styles.uploadImage} source={Images.Upload} />
          <GText
            medium
            text={t('upload_image_string')}
            style={styles.uploadText}
          />
          <GText
            SatoshiRegular
            text={t('maximum_string')}
            style={styles.maxSize}
          />
        </View>
        <GButton
          title={'Send Message'}
          style={[
            styles.buttonStyle,
            {marginBottom: insets.bottom || scaledValue(20)},
          ]}
          textStyle={styles.buttonText}
        />
      </ScrollView>
      {/* <GMultipleOptions
        refRBSheet={refRBSheet}
        title="Are you a pet professional?"
        options={professionalList}
        search={false}
        value={selectProfessional}
        multiSelect={true}
        onChoose={val => {
          setSelectProfessional(val);
        }}
      /> */}
    </KeyboardAvoidingView>
  );
};

export default ContactVet;
