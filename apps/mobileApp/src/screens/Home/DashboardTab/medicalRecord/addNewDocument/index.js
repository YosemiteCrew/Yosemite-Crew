import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  Text,
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
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../../redux/store/storeUtils';
import {transformPets} from '../../../../../helpers/transformPets';
import GImage from '../../../../../components/GImage';
import {add_medical_record} from '../../../../../redux/slices/medicalRecordSlice';
import {createDocumentReference} from '../../../../../helpers/createDocumentReference';
import {convertDateFormat} from '../../../../../utils/constants';
import {pick, types} from '@react-native-documents/picker';
import {scaledValue} from '../../../../../utils/design.utils';
import {Dropdown} from 'react-native-element-dropdown';

const AddNewDocument = ({navigation}) => {
  const refRBMenuSheet = useRef();
  const {t} = useTranslation();
  const [toggleState, setToggleState] = useState(true);
  const [expiryToggleState, setExpiryToggleState] = useState(false);
  const [date, setDate] = useState(null);
  const [value, setValue] = useState(null);

  const [expiryDate, setExpiryDate] = useState(null);
  const [open, setOpen] = useState(false);
  const refRBSheet = useRef();
  const petList = useAppSelector(state => state.pets?.petLists);
  const folderList = useAppSelector(state => state.medicalRecord.folderList);

  const [selectedPet, setSelectedPet] = useState(petList[0]);
  const [currentField, setCurrentField] = useState(null);
  const [apiCallImage, setApiCallImage] = useState([]);

  const dispatch = useAppDispatch();
  const [formValue, setFormValue] = useState({
    document_type: '',
    title: '',
    date_of_isssue: '',
    expiryDate: '',
  });

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.jetBlack}
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
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const handleOpenDatePicker = field => {
    setCurrentField(field);
    setOpen(true);
  };

  const uploadDocumentMenuList = [
    {
      id: 1,
      title: 'Take Photo',
      image: Images.Camera,
      height: 48,
      fontSize: 16,
      action: () => {},
    },
    {
      id: 2,
      title: 'Choose from Gallery',
      image: Images.Gallery,
      height: 48,
      fontSize: 16,
      action: () => {},
    },
    {
      id: 3,
      title: 'Upload from Drive',
      image: Images.Drive,
      height: 48,
      fontSize: 16,
      action: () => {},
    },
  ];

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  const handleConfirm = selectedDate => {
    setOpen(false);
    switch (currentField) {
      case 'issue':
        setDate(selectedDate);
        setFormValue({
          ...formValue,
          date_of_isssue: formatDate(selectedDate),
        });
        break;
      case 'expire':
        setExpiryDate(selectedDate);
        setFormValue({
          ...formValue,
          expiryDate: formatDate(selectedDate),
        });
        break;
      default:
        break;
    }
  };

  const save_record = () => {
    const input = {
      typeText: value?.folderName,
      description: formValue?.title,
      date: convertDateFormat(formValue?.date_of_isssue),
      contextPeriodEnd: convertDateFormat(formValue?.expiryDate),
      patientId: selectedPet?.id,
      folderId: value?._id,
    };
    const fhirPayload = createDocumentReference(input);
    const api_credentials = {
      data: fhirPayload,
      files: apiCallImage,
    };
    dispatch(add_medical_record(api_credentials));
  };

  const uploadDocument = async () => {
    try {
      const result = await pick({
        // type: [types.doc, types.images, types.pdf],
        type: Platform.select({
          ios: [
            'public.image', // Includes most common image types
            'public.data', // generic catch-all
            'com.adobe.pdf',
            'com.microsoft.word.doc',
            'org.openxmlformats.wordprocessingml.document',
          ],
          android: [types.doc, types.images, types.pdf],
        }),
        allowMultiSelection: true,
      });
      result?.map(d => onSuccessDoc(d));
      const fileUri = Platform.select({
        android: result[0].uri,
        ios: result[0].uri.replace('file:///private/', ''),
      });

      if (!fileUri) {
        return;
      }
    } catch (err) {
      console.log('documentError', err);
    }
  };

  const onSuccessDoc = files => {
    let name = files?.name;
    let type = files?.type;
    let localUri = files?.uri;
    setApiCallImage(prevState => [...prevState, {name, uri: localUri, type}]);
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
          <TouchableOpacity
            onPress={() => {
              refRBSheet?.current?.open();
            }}
            activeOpacity={0.7}
            style={styles.headerImageContainer}>
            <GImage image={selectedPet?.petImages} style={styles.catImage} />
            <Image source={Images.ArrowDown} style={styles.arrowDownImage} />
          </TouchableOpacity>
        </View>
        <View style={styles.inputContainer}>
          {value && (
            <View style={styles.inlineLabelWrapper}>
              <GText
                SatoshiBold
                text={'Choose Folder'}
                style={styles.inlineLabel}
              />
            </View>
          )}
          <Dropdown
            style={styles.dropdown(value)}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            data={folderList?.data}
            labelField="folderName"
            valueField="_id"
            placeholder="Select folder"
            value={value}
            selectedTextProps={{
              style: {
                textTransform: 'capitalize',
              },
            }}
            renderRightIcon={() => (
              <Image source={Images.ArrowDown} style={styles.iconStyle} />
            )}
            onChange={item => {
              setValue(item);
            }}
            // Custom list item with icon + text
            renderItem={item => (
              <View style={styles.itemContainer}>
                <Image
                  source={{
                    uri: 'https://img.icons8.com/ios-filled/50/folder-invoices.png',
                  }}
                  style={styles.icon}
                />
                <GText
                  SatoshiMedium
                  text={item?.folderName}
                  style={styles.professionalText}
                />
              </View>
            )}
            // Show selected item with icon
            renderSelectedItem={item => (
              <View style={styles.itemContainer}>
                <Image
                  source={{
                    uri: 'https://img.icons8.com/ios-filled/50/folder-invoices.png',
                  }}
                  style={styles.icon}
                />
                <GText
                  SatoshiMedium
                  text={item?.folderName}
                  style={styles.professionalText}
                />
              </View>
            )}
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
          {toggleState && (
            <>
              <View style={styles.inputWrapper}>
                {date && (
                  <View style={styles.inlineLabelWrapper}>
                    <GText
                      SatoshiBold
                      text={t('date_of_issue_string')}
                      style={styles.inlineLabel}
                    />
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => handleOpenDatePicker('issue')}
                  style={styles.professionalButton}>
                  <GText
                    SatoshiRegular
                    text={date ? formatDate(date) : t('date_of_issue_string')}
                    style={[
                      styles.professionalText,
                      {
                        paddingLeft: scaledValue(0),
                      },
                    ]}
                  />
                  <Image source={Images.Calender} style={styles.iconStyle} />
                </TouchableOpacity>
              </View>
            </>
          )}

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
          {expiryToggleState && (
            <View style={styles.inputWrapper}>
              {expiryDate && (
                <View style={styles.inlineLabelWrapper}>
                  <GText
                    SatoshiBold
                    text={t('expiry_date_string')}
                    style={styles.inlineLabel}
                  />
                </View>
              )}
              <TouchableOpacity
                onPress={() => handleOpenDatePicker('expire')}
                style={styles.professionalButton}>
                <GText
                  SatoshiRegular
                  text={
                    expiryDate
                      ? formatDate(expiryDate)
                      : t('expiry_date_string')
                  }
                  style={[
                    styles.professionalText,
                    {
                      paddingLeft: scaledValue(0),
                    },
                  ]}
                />
                <Image source={Images.Calender} style={styles.iconStyle} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <GText
          SatoshiBold
          text={t('uploaded_document_string')}
          style={styles.vaccineText}
        />

        {apiCallImage?.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: scaledValue(20),
              gap: scaledValue(16),
            }}>
            {apiCallImage?.map((i, d) => (
              <View>
                <Image source={{uri: i?.uri}} style={styles.imageStyle} />
                <TouchableOpacity
                  onPress={() => {
                    setApiCallImage(prev => prev.filter((_, idx) => idx !== d));
                  }}
                  style={styles.crossImgView}>
                  <Image source={Images.CrossIcon} style={styles.crossStyle} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={uploadDocument}
              style={styles.addImgButton}>
              <Image
                source={Images.PlusIcon}
                tintColor={colors.appRed}
                style={styles.PlusIconImage}
              />
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <TouchableOpacity
            onPress={uploadDocument}
            style={styles.uploadContainer}>
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
          </TouchableOpacity>
        )}
        {/* <View style={styles.imgContainer}>
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
              tintColor={colors.jetBlack}
              source={Images.PlusIcon}
              style={styles.PlusIconImage}
            />
          </TouchableOpacity>
        </View> */}
        <GButton
          onPress={() => {
            save_record();
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
        <OptionMenuSheet
          refRBSheet={refRBSheet}
          // title={formValue?.blood_group || 'Select Blood Group'}
          options={petList}
          onChoose={val => {
            setSelectedPet(val);

            refRBSheet.current.close();
          }}
          onPressCancel={() => refRBSheet.current.close()}
        />
        <DatePicker
          modal
          open={open}
          date={
            currentField === 'issue'
              ? date || new Date()
              : currentField === 'expire'
              ? expiryDate || new Date()
              : new Date()
          }
          mode="date"
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddNewDocument;
