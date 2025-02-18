import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import {styles} from './styles';
import Input from '../../../../../components/Input';
import ToggleButton from '../../../../../components/ToogleButton';
import GButton from '../../../../../components/GButton';
import MenuBottomSheet from '../../../../../components/MenuBottomSheet';
import DatePicker from 'react-native-date-picker';

const AddNewDocument = ({navigation}) => {
  const refRBMenuSheet = useRef();
  const {t} = useTranslation();
  const [toggleState, setToggleState] = useState(true);
  const [expiryToggleState, setExpiryToggleState] = useState(false);
  const [date, setDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [formValue, setFormValue] = useState({
    document_type: '',
    title: '',
    date_of_isssue: '',
  });

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
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const handleOpenDatePicker = field => {
    console.log('here');
  };

  const uploadDocumentMenuList = [
    {
      id: 1,
      title: 'Take Photo',
      image: Images.Camera,
      textColor: colors.darkPurple,
      height: 48,
      fontSize: 16,
      action: () => {},
    },
    {
      id: 2,
      title: 'Choose from Gallery',
      image: Images.Gallery,
      textColor: colors.darkPurple,
      height: 48,
      fontSize: 16,
      action: () => {},
    },
    {
      id: 3,
      title: 'Upload from Drive',
      image: Images.Drive,
      textColor: colors.darkPurple,
      height: 48,
      fontSize: 16,
      action: () => {},
    },
  ];

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <GText
              GrMedium
              text={`${t('add_new_string')}`}
              style={styles.ongoingText}
            />
            <GText
              GrMedium
              text={` ${t('medical_record_small_string')}`}
              style={styles.plansText}
            />
          </View>
          <View style={styles.headerImageContainer}>
            <Image source={Images.CatImg} style={styles.catImage} />
            <Image source={Images.ArrowDown} style={styles.arrowDownImage} />
          </View>
        </View>
        <View style={styles.inputContainer}>
          <Input
            value={formValue.document_type}
            rightIcon={Images.ArrowDown}
            iconStyle={styles.iconStyle}
            label={t('document_category_string')}
            onChangeText={value =>
              setFormValue({...formValue, document_type: value})
            }
            style={styles.input}
            onFocus={() => handleOpenDatePicker()}
          />
          <Input
            value={formValue.title}
            iconStyle={styles.iconStyle}
            label={t('document_title_string')}
            onChangeText={value => setFormValue({...formValue, title: value})}
            style={styles.input}
          />
          <View style={styles.dateRow}>
            <GText
              SatoshiBold
              text={t('issued_date_string')}
              style={styles.dateText}
            />
            <ToggleButton
              toggleState={toggleState}
              setToggleState={setToggleState}
            />
          </View>
          <TouchableOpacity
            onPress={() => setOpen(true)}
            style={styles.professionalButton}>
            <GText
              SatoshiRegular
              text={date ? formatDate(date) : t('date_of_issue_string')}
              style={styles.professionalText}
            />
            <Image source={Images.Calender} style={styles.iconStyle} />
          </TouchableOpacity>

          <View style={styles.dateRow}>
            <GText
              SatoshiBold
              text={t('expiry_date_string')}
              style={styles.dateText}
            />
            <ToggleButton
              toggleState={expiryToggleState}
              setToggleState={setExpiryToggleState}
            />
          </View>
        </View>
        {/* <TouchableOpacity
        style={styles.uploadContainer}
        onPress={() => refRBMenuSheet.current.open()}
      >
        <Image source={Images.Upload} style={styles.uploadImage} />
        <GText
          GrMedium
          text={t('upload_document_string')}
          style={styles.uploadText}
        />
        <GText
          SatoshiRegular
          text={t('document_text_string')}
          style={styles.documentText}
        />
      </TouchableOpacity> */}
        <GText
          SatoshiBold
          text={t('uploaded_document_string')}
          style={styles.vaccineText}
        />
        <View style={styles.imgContainer}>
          <View>
            <FlatList
              data={[1, 2]}
              horizontal
              contentContainerStyle={styles.imgContentStyle}
              renderItem={({item, index}) => {
                return (
                  <View>
                    <Image source={Images.InjImg} style={styles.imageStyle} />
                    <TouchableOpacity style={styles.crossImgView}>
                      <Image
                        source={Images.CrossIcon}
                        style={styles.crossStyle}
                      />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
          <TouchableOpacity
            style={styles.addImgButton}
            onPress={() => refRBMenuSheet.current.open()}>
            <Image
              tintColor={colors.appRed}
              source={Images.PlusIcon}
              style={styles.PlusIconImage}
            />
          </TouchableOpacity>
        </View>
        <GButton
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'DocumentListScreen',
            });
          }}
          title={t('create_new_record_string')}
          textStyle={styles.buttonText}
          style={styles.buttonStyle}
        />

        <MenuBottomSheet
          refRBSheet={refRBMenuSheet}
          options={uploadDocumentMenuList}
          height={
            uploadDocumentMenuList.reduce((a, c) => a + c?.height + 1, 0) +
            18 +
            143
          }
          onChoose={val => {
            val.action();
            refRBMenuSheet.current.close();
          }}
          onPressCancel={() => refRBMenuSheet.current.close()}
        />
        <DatePicker
          modal
          open={open}
          date={date || new Date()}
          mode="date"
          onConfirm={newDate => {
            setOpen(false);
            setDate(newDate);
          }}
          onCancel={() => setOpen(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddNewDocument;
