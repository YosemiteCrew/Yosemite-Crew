import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
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
import {convertDateFormat, formatDateDMY} from '../../../../../utils/constants';
import GImage from '../../../../../components/GImage';
import {useAppDispatch} from '../../../../../redux/store/storeUtils';
import {
  delete_vaccine_record_api,
  edit_vaccine_records,
} from '../../../../../redux/slices/vaccineSlice';
import {buildImmunization} from '../../../../../helpers/buildImmunization';
import {pick, types} from '@react-native-documents/picker';

const EditVaccineRecord = ({navigation, route}) => {
  const {t} = useTranslation();
  const {itemRecordDetails, setData} = route?.params;
  const dispatch = useAppDispatch();
  const [toggleState, setToggleState] = useState(true);
  const [date1, setDate1] = useState(null);
  const [date2, setDate2] = useState(null);
  const [date3, setDate3] = useState(null);
  const [apiCallImage, setApiCallImage] = useState([]);
  const [open, setOpen] = useState(false);
  const [currentField, setCurrentField] = useState(null);
  const [images, setImages] = useState(itemRecordDetails?.attachments);
  const [formValue, setFormValue] = useState({
    manufacturer: itemRecordDetails?.manufacturer || '',
    name: itemRecordDetails?.vaccine || '',
    batchName: itemRecordDetails?.lotNumber || '',
    expiryDate: formatDateDMY(itemRecordDetails?.expiryDate),
    vaccinationDate: formatDateDMY(itemRecordDetails?.date),
    clinicName: itemRecordDetails?.location,
    dueOn: formatDateDMY(itemRecordDetails?.nextDue),
  });
  useEffect(() => {
    configureHeader();
  }, []);

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

  const delete_record = () => {
    const input = {
      vaccinationRecordId: itemRecordDetails?.id,
    };
    dispatch(delete_vaccine_record_api(input)).then(res => {
      if (delete_vaccine_record_api.fulfilled.match(res)) {
        setData(prev =>
          prev.filter(i => i?.resource.id !== itemRecordDetails?.id),
        );
        navigation?.goBack();
      }
    });
  };

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
          icon={Images.Trash}
          tintColor={'#D53225'}
          onPress={delete_record}
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

  const editVaccinationRecord = () => {
    const input = {
      manufacturer: formValue?.manufacturer,
      vaccineName: formValue?.name,
      batchNumber: formValue?.batchName,
      expiryDate: convertDateFormat(formValue?.expiryDate),
      vaccinationDate: convertDateFormat(formValue?.vaccinationDate),
      businessName: formValue?.clinicName,
      nextDueOn: convertDateFormat(formValue?.dueOn),
      patientId: itemRecordDetails?.id,
    };

    const fhirPayload = buildImmunization(input);

    const api_credentials = {
      data: fhirPayload,
      files: apiCallImage,
    };

    dispatch(
      edit_vaccine_records({
        vaccinationRecordId: itemRecordDetails?.id,
        api_credentials: api_credentials,
      }),
    ).then(res => {
      if (edit_vaccine_records.fulfilled.match(res)) {
        if (res.payload.status === 1) {
          setData(prevData =>
            prevData.map(item =>
              item.resource.id === res.payload.data.entry[0].resource.id
                ? {...item, resource: res.payload.data.entry[0].resource}
                : item,
            ),
          );
          navigation?.goBack();
        }
      }
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.button}>
          <GImage image={itemRecordDetails?.petImage} style={styles.catImage} />
          <GText
            GrMedium
            text={`${itemRecordDetails?.manufacturer} Vaccination`}
            style={styles.vaccinationText}
          />
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
            onChangeText={value =>
              setFormValue({...formValue, batchName: value})
            }
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
              style={styles.datePickerContainer(formValue?.expiryDate)}>
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
                    : t('next_due_on_string')
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
            toggleState={toggleState}
            setToggleState={setToggleState}
          />
        </View>
        <GText
          SatoshiBold
          text={t('vaccination_images_string')}
          style={styles.vaccineText}
        />
        <View style={styles.imgContainer}>
          <View>
            <FlatList
              data={images}
              horizontal
              contentContainerStyle={styles.imgContentStyle}
              renderItem={({item, index}) => {
                return (
                  <View>
                    <GImage image={item?.url} style={styles.imageStyle} />
                    <TouchableOpacity
                      onPress={() => {
                        setImages(prev =>
                          prev.filter((_, idx) => idx !== index),
                        );
                      }}
                      style={styles.crossImgView}>
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
            onPress={uploadDocument}
            style={styles.addImgButton}>
            <Image
              tintColor={colors.appRed}
              source={Images.PlusIcon}
              style={styles.PlusIconImage}
            />
          </TouchableOpacity>
        </View>
        <GButton
          onPress={editVaccinationRecord}
          title={t('update_record_string')}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default EditVaccineRecord;
