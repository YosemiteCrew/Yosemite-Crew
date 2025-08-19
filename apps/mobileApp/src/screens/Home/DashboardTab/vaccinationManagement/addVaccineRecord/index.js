import {
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import Input from '../../../../../components/Input';
import DatePicker from 'react-native-date-picker';
import ToggleButton from '../../../../../components/ToogleButton';
import GButton from '../../../../../components/GButton';
import HeaderButton from '../../../../../components/HeaderButton';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../../redux/store/storeUtils';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import GImage from '../../../../../components/GImage';
import {buildImmunization} from '../../../../../helpers/buildImmunization';
import {add_vaccine_records} from '../../../../../redux/slices/vaccineSlice';
import {pick, types} from '@react-native-documents/picker';
import {scaledValue} from '../../../../../utils/design.utils';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {convertDateFormat} from '../../../../../utils/constants';

const AddVaccineRecord = ({navigation}) => {
  const {t} = useTranslation();
  const refRBSheet = useRef();
  const petList = useAppSelector(state => state.pets?.petLists);
  const [selectedPet, setSelectedPet] = useState(petList[0]);
  const dispatch = useAppDispatch();
  const [toggleState, setToggleState] = useState(false);
  const [date1, setDate1] = useState(null);
  const [date2, setDate2] = useState(null);
  const [date3, setDate3] = useState(null);
  const [open, setOpen] = useState(false);
  const [currentField, setCurrentField] = useState(null);
  const [apiCallImage, setApiCallImage] = useState([]);
  const [image, setImage] = useState();
  const [formValue, setFormValue] = useState({
    manufacturer: '',
    name: '',
    batchName: '',
    expiryDate: '',
    vaccinationDate: '',
    clinicName: '',
    dueOn: '',
  });

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
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
    });
  };
  const handleOpenDatePicker = field => {
    setCurrentField(field);
    setOpen(true);
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  const handleConfirm = selectedDate => {
    setOpen(false);
    switch (currentField) {
      case 'date1':
        setDate1(selectedDate);
        setFormValue({...formValue, expiryDate: formatDate(selectedDate)});
        break;
      case 'date2':
        setDate2(selectedDate);
        setFormValue({
          ...formValue,
          vaccinationDate: formatDate(selectedDate),
        });
        break;
      case 'date3':
        setDate3(selectedDate);
        setFormValue({...formValue, dueOn: formatDate(selectedDate)});
        break;
      default:
        break;
    }
  };

  const uploadDocument = async () => {
    try {
      const result = await pick({
        type: [types.doc, types.images, types.pdf],
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
    // setApiCallImage({ name, uri: localUri, type });
  };

  const addVaccinationRecord = () => {
    const input = {
      manufacturer: formValue?.manufacturer,
      vaccineName: formValue?.name,
      batchNumber: formValue?.batchName,
      expiryDate: convertDateFormat(formValue?.expiryDate),
      vaccinationDate: convertDateFormat(formValue?.vaccinationDate),
      businessName: formValue?.clinicName,
      nextDueOn: convertDateFormat(formValue?.dueOn),
      patientId: selectedPet?.id,
    };

    const fhirPayload = buildImmunization(input);

    const api_credentials = {
      data: fhirPayload,
      files: apiCallImage,
    };

    dispatch(add_vaccine_records(api_credentials));
  };

  return (
    <KeyboardAwareScrollView bottomOffset={20} style={styles.dashboardMainView}>
      <View style={styles.innerContainer}>
        <View>
          <View style={styles.row}>
            <GText
              GrMedium
              text={`${t('add_new_string')} ${t('vaccinations_small_string')}`}
              style={styles.vaccinationText}
            />
          </View>
          <GText
            GrMedium
            text={` ${t('record_string')}`}
            style={styles.recordsText}
          />
        </View>
        <TouchableOpacity
          onPress={() => {
            refRBSheet?.current?.open();
          }}
          activeOpacity={0.7}
          style={styles.button}>
          <View
            style={{
              borderWidth: 1,
              borderRadius: scaledValue(20),
              borderColor: colors.primaryBlue,
            }}>
            <GImage image={selectedPet?.petImages} style={styles.catImage} />
          </View>
          <Image source={Images.ArrowDown} style={styles.arrowImage} />
        </TouchableOpacity>
      </View>
      <View style={styles.formContainer}>
        <Input
          value={formValue.manufacturer}
          label={t('vaccination_manufacturer_string')}
          onChangeText={value =>
            setFormValue({...formValue, manufacturer: value})
          }
          style={styles.input}
          keyboardType={'email-address'}
        />
        <Input
          value={formValue.name}
          label={t('vaccine_name__string')}
          onChangeText={value => setFormValue({...formValue, name: value})}
          style={styles.input}
          keyboardType={'email-address'}
        />
        <Input
          value={formValue.batchName}
          label={t('batch_number_string')}
          onChangeText={value => setFormValue({...formValue, batchName: value})}
          style={styles.input}
          keyboardType={'email-address'}
        />
        <View style={styles.inputWrapper}>
          {formValue?.expiryDate && (
            <View style={styles.inlineLabelWrapper}>
              <GText
                SatoshiBold
                text={t('expiry_date_string')}
                style={styles.inlineLabel}
              />
            </View>
          )}

          <TouchableOpacity
            onPress={() => handleOpenDatePicker('date1')}
            style={styles.datePickerContainer(formValue?.expiryDate)}
            activeOpacity={0.8}>
            <GText
              text={
                formValue?.expiryDate
                  ? formValue?.expiryDate
                  : t('expiry_date_string')
              }
              style={styles.dateText(formValue?.expiryDate)}
            />
            <Image source={Images.Calender} style={styles.dateIcon} />
          </TouchableOpacity>
        </View>
        <View style={styles.inputWrapper}>
          {formValue?.vaccinationDate && (
            <View style={styles.inlineLabelWrapper}>
              <GText
                SatoshiBold
                text={t('vaccination_date_string')}
                style={styles.inlineLabel}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={() => handleOpenDatePicker('date2')}
            style={styles.datePickerContainer(formValue?.vaccinationDate)}>
            <GText
              text={
                formValue?.vaccinationDate
                  ? formValue?.vaccinationDate
                  : t('vaccination_date_string')
              }
              style={styles.dateText(formValue?.vaccinationDate)}
            />
            <Image source={Images.Calender} style={styles.dateIcon} />
          </TouchableOpacity>
        </View>
        <Input
          value={formValue.clinicName}
          label={t('hospital_clinic_name_string')}
          onChangeText={value =>
            setFormValue({...formValue, clinicName: value})
          }
          style={styles.input}
          keyboardType={'email-address'}
        />
        <View style={styles.inputWrapper}>
          {formValue?.dueOn && (
            <View style={styles.inlineLabelWrapper}>
              <GText
                SatoshiBold
                text={t('next_due_on_string')}
                style={styles.inlineLabel}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={() => handleOpenDatePicker('date3')}
            style={styles.datePickerContainer(formValue?.dueOn)}>
            <GText
              text={
                formValue?.dueOn ? formValue?.dueOn : t('next_due_on_string')
              }
              style={styles.dateText(formValue?.dueOn)}
            />
            <Image source={Images.Calender} style={styles.dateIcon} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.headerContainer}>
        <GText
          SatoshiBold
          text={t('reminders_string')}
          style={styles.reminderText}
        />
        <ToggleButton
          width={scaledValue(48)}
          height={scaledValue(28)}
          circleWidth={scaledValue(24)}
          toggleState={toggleState}
          setToggleState={setToggleState}
        />
      </View>
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
            text={t('upload_images_text_string')}
            style={styles.uploadText}
          />
          <GText
            SatoshiRegular
            text={t('document_text_string')}
            style={styles.documentText}
          />
        </TouchableOpacity>
      )}

      <GButton
        onPress={addVaccinationRecord}
        title={t('create_new_record_string')}
        style={styles.buttonStyle}
      />
      <DatePicker
        modal
        open={open}
        date={
          currentField === 'date1'
            ? date1 || new Date()
            : currentField === 'date2'
            ? date2 || new Date()
            : date3 || new Date()
        }
        mode="date"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
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
    </KeyboardAwareScrollView>
  );
};

export default AddVaccineRecord;
