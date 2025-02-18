import {
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

const AddVaccineRecord = ({navigation}) => {
  const {t} = useTranslation();
  const [toggleState, setToggleState] = useState(false);
  const [date1, setDate1] = useState(null);
  const [date2, setDate2] = useState(null);
  const [date3, setDate3] = useState(null);
  const [open, setOpen] = useState(false);
  const [currentField, setCurrentField] = useState(null);
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
          tintColor={colors.darkPurple}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
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
        setFormValue({...formValue, vaccinationDate: formatDate(selectedDate)});
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
        <View style={styles.innerContainer}>
          <View>
            <View style={styles.row}>
              <GText
                GrMedium
                text={t('add_new_string')}
                style={styles.oscarText}
              />
              <GText
                GrMedium
                text={` ${t('vaccinations_small_string')}`}
                style={styles.vaccinationText}
              />
            </View>
            <GText
              GrMedium
              text={` ${t('record_string')}`}
              style={styles.recordsText}
            />
          </View>
          <TouchableOpacity activeOpacity={0.5} style={styles.button}>
            <Image source={Images.CatImg} style={styles.catImage} />
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
                  : t('expiry_date_string')
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
                  : t('vaccination_date_string')
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
        <TouchableOpacity style={styles.uploadContainer}>
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
        <GButton
          title={t('create_new_record_string')}
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

export default AddVaccineRecord;
