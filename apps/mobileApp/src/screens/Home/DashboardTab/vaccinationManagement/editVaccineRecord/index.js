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
import {formatDateDMY} from '../../../../../utils/constants';
import GImage from '../../../../../components/GImage';
import {useAppDispatch} from '../../../../../redux/store/storeUtils';
import {delete_vaccine_record_api} from '../../../../../redux/slices/vaccineSlice';

const EditVaccineRecord = ({navigation, route}) => {
  const {t} = useTranslation();
  const {itemRecordDetails, setData} = route?.params;
  const dispatch = useAppDispatch();
  const [toggleState, setToggleState] = useState(true);
  const [date1, setDate1] = useState(null);
  const [date2, setDate2] = useState(null);
  const [date3, setDate3] = useState(null);
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
          tintColor={colors.darkPurple}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.Trash}
          tintColor={colors.appRed}
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
    console.log('selectedDateselectedDate', selectedDate);

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

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.button}>
          <Image source={Images.CatImg} style={styles.catImage} />
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
          <TouchableOpacity
            onPress={() => handleOpenDatePicker('date1')}
            style={styles.datePickerContainer(formValue?.expiryDate)}>
            <GText
              text={
                formValue?.expiryDate
                  ? formValue?.expiryDate
                  : t('next_due_on_string')
              }
              style={styles.dateText(formValue?.expiryDate)}
            />
            <Image source={Images.Calender} style={styles.dateIcon} />
          </TouchableOpacity>

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
          <Input
            value={formValue.clinicName}
            label={t('hospital_clinic_name_string')}
            onChangeText={value =>
              setFormValue({...formValue, clinicName: value})
            }
            style={styles.input}
            keyboardType={'email-address'}
          />
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
          <TouchableOpacity style={styles.addImgButton}>
            <Image
              tintColor={colors.appRed}
              source={Images.PlusIcon}
              style={styles.PlusIconImage}
            />
          </TouchableOpacity>
        </View>
        <GButton
          title={t('update_record_string')}
          textStyle={styles.buttonText}
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
