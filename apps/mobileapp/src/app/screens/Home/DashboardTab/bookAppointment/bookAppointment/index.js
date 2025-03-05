import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Image,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import DatePicker from 'react-native-date-picker';
import Input from '../../../../../components/Input';
import GButton from '../../../../../components/GButton';
import {
  loggedUserData,
  useAppDispatch,
  useAppSelector,
} from '../../../../../redux/store/storeUtils';
import {
  currentDate,
  formatMonthYear,
  getCurrentMonthAndYear,
  getMonthAndDay,
  getMonthYear,
  getShortDayAndDate,
} from '../../../../../utils/constants';
import {
  book_appointment_api,
  get_time_slots_by_date,
  get_time_slots_by_Month,
} from '../../../../../redux/slices/appointmentSlice';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import {pick, types} from '@react-native-documents/picker';
import MonthPicker from 'react-native-month-year-picker';
import {showToast} from '../../../../../components/Toast';

const BookAppointment = ({navigation, route}) => {
  const {doctorDetail} = route?.params;
  const {t} = useTranslation();
  const refRBSheet = useRef();

  const [selectedPetId, setSelectedPetId] = useState(null);
  const [pickSlotTime, setPickSlotTime] = useState(null);
  const [pickSlot, setPickSlot] = useState(null);
  console.log('pickSlotpickSlotaaa', pickSlotTime);

  const [message, setMessage] = useState('');
  const [date, setDate] = useState(new Date());
  const [currentMonthYear, setCurrentMonthYear] = useState(getMonthYear());
  const [reason, setReason] = useState('');
  const dispatch = useAppDispatch();
  const petList = useAppSelector(state => state.pets?.petLists);
  console.log('petListpetList', petList);

  const [timeSlotsList, setTimeSlotsList] = useState([]);
  const [monthlySlotsLists, setMonthlySlotsLists] = useState([]);

  const [show, setShow] = useState(false);
  console.log('pickSlotpickSlot', pickSlot);

  const showPicker = useCallback(value => setShow(value), []);

  const onValueChange = useCallback(
    (event, newDate) => {
      console.log(event, newDate);

      const selectedDate = newDate || date;
      showPicker(false);
      if (event === 'dateSetAction') {
        setDate(selectedDate);
        setCurrentMonthYear(formatMonthYear(newDate));
        getTimeSlotsByMonth(newDate);
      }
    },
    [date, showPicker],
  );

  useEffect(() => {
    getTimeSlotsByMonth();
  }, []);

  useEffect(() => {
    configureHeader();
  }, []);

  useEffect(() => {
    getTimeSlots(pickSlot);
  }, [pickSlot]);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() => {}}
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

  const handlePetSelection = pet => {
    setSelectedPetId(
      selectedPetId?.cognitoUserId === pet.cognitoUserId ? null : pet,
    );
  };

  const getTimeSlots = date => {
    const api_credentials = {
      appointmentDate: date,
      doctorId: doctorDetail?.userId,
    };
    dispatch(get_time_slots_by_date(api_credentials)).then(res => {
      if (get_time_slots_by_date.fulfilled.match(res)) {
        setTimeSlotsList(res.payload?.data);
      }
    });
  };

  const getTimeSlotsByMonth = date => {
    const {month, year} = getCurrentMonthAndYear(date || new Date());
    const api_credentials = {
      doctorId: doctorDetail?.userId,
      slotMonth: month,
      slotYear: year,
    };
    dispatch(get_time_slots_by_Month(api_credentials)).then(res => {
      if (get_time_slots_by_Month.fulfilled.match(res)) {
        const filterMonthlySlotsLists = res?.payload?.filter(
          item => item.date >= currentDate,
        );

        setMonthlySlotsLists(filterMonthlySlotsLists);
        const firstAvailableSlot = filterMonthlySlotsLists?.find(
          slot => slot.availableSlotsCount > 0,
        );

        if (firstAvailableSlot) {
          setPickSlot(firstAvailableSlot?.date);
        }
      }
    });
  };

  const uploadDocument = async () => {
    try {
      // const result = await pick({
      //   type: [pick.types.pdf],
      //   copyTo: 'documentDirectory',
      //   mode: 'import',
      //   allowMultiSelection: false,
      // });
      const result = await pick({
        // copyTo: ,
        type: [types.doc, types.images, types.pdf],
      });
      console.log(result);

      const fileUri = Platform.select({
        android: result[0].uri.replace('%20', '').replace(' ', ''),
        ios: result[0].uri.replace('file:///private/', ''),
      });
      if (!fileUri) {
        console.log('File URI is undefined or null');
        return;
      }
      if (fileUri.indexOf('.png') !== -1 || fileUri.indexOf('.jpg') !== -1) {
        // setImagePath(fileUri);
        // refBTSheet?.current?.close();
      } else {
        // convertToBase64(fileUri).then(base64Data => {
        //   setFilePath(base64Data);
        // });
        // refBTSheet?.current?.close();
      }
    } catch (err) {
      console.log('documentError', err);
    }
  };

  const book_appointment_hit = () => {
    const api_credentials = {
      hospitalId: doctorDetail?.bussinessId,
      department: doctorDetail?.professionalBackground?.specialization,
      doctorId: doctorDetail?.userId,
      petId: selectedPetId?._id,
      appointmentDate: pickSlot,
      slotsId: pickSlotTime?._id,
      purposeOfVisit: reason,
      concernOfVisit: message,
      timeslot: pickSlotTime?.time,
      // files: '',
    };

    console.log('api_credentials123', api_credentials);

    if (!selectedPetId?.cognitoUserId) {
      showToast(0, 'Please select your companion.');
    } else if (!pickSlotTime?.time) {
      showToast(0, 'Please select one slot.');
    } else if (!reason) {
      showToast(0, 'Please select reason for appointment.');
    } else if (!message) {
      showToast(0, 'Please describe your concern.');
    } else {
      dispatch(book_appointment_api(api_credentials));
    }

    // dispatch(book_appointment_api(api_credentials));
  };

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Image source={Images.DoctorImg} style={styles.doctorImgStyle} />
          <View style={styles.textView}>
            <GText
              GrMedium
              text={`Dr. ${
                doctorDetail?.personalInfo?.firstName +
                ' ' +
                doctorDetail?.personalInfo?.lastName
              }`}
              style={styles.doctorNameText}
            />
            {/* <GText
              SatoshiBold
              text={'Gastroenterology'}
              style={[styles.departmentText, {marginTop: scaledValue(4)}]}
            /> */}
            <GText
              SatoshiBold
              text={doctorDetail?.professionalBackground?.qualification}
              style={styles.departmentText}
            />
          </View>
        </View>

        <View style={styles.headerContainer}>
          <GText
            GrMedium
            text={t('choose_string')}
            style={styles.ongoingText}
          />
          <GText
            GrMedium
            text={` ${t('your_companion_string')}`}
            style={styles.plansText}
          />
        </View>

        <View style={styles.petListContainer}>
          {petList.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.petItem,
                {opacity: selectedPetId?._id === item._id ? 0.5 : 1},
              ]}
              onPress={() => handlePetSelection(item)}>
              <Image source={Images.Kizi} style={styles.imgStyle} />
              <GText SatoshiBold text={item.petName} style={styles.petTitle} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.headerContainer}>
          <GText
            GrMedium
            text={t('choose_string')}
            style={styles.ongoingText}
          />
          <GText
            GrMedium
            text={` ${t('a_slot_string')}`}
            style={styles.plansText}
          />
        </View>

        <TouchableOpacity
          onPress={() =>
            // setOpen(true)
            showPicker(true)
          }
          style={styles.professionalButton}>
          <GText
            SatoshiMedium
            text={currentMonthYear}
            style={styles.professionalText}
          />
          <Image source={Images.ArrowDown} style={styles.arrowIcon} />
        </TouchableOpacity>

        <View style={styles.slotListUpperView}>
          <FlatList
            data={monthlySlotsLists}
            horizontal
            contentContainerStyle={{gap: scaledValue(8)}}
            showsHorizontalScrollIndicator={false}
            renderItem={({item}) => {
              const {shortDayName, dateNumber} = getShortDayAndDate(item?.date);
              return (
                <TouchableOpacity
                  disabled={item?.availableSlotsCount === 0}
                  onPress={() => {
                    setPickSlot(item?.date);
                    setPickSlotTime();
                  }}
                  style={styles.slotCard(pickSlot, item)}>
                  <GText
                    SatoshiBold
                    text={shortDayName}
                    style={styles.dayText(pickSlot, item?.date)}
                  />
                  <GText
                    GrMedium
                    text={dateNumber}
                    style={styles.dateText(pickSlot, item?.date)}
                  />
                  <GText
                    SatoshiBold
                    text={item?.availableSlotsCount || 'N/A'}
                    style={styles.slotText(pickSlot, item?.date)}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
        {timeSlotsList?.length > 0 && (
          <View style={styles.slotTimeUpperView}>
            {timeSlotsList?.map((item, index) => (
              <TouchableOpacity
                key={index}
                disabled={item?.booked}
                onPress={() => setPickSlotTime(item?.slot)}
                style={styles.slotTimeCard(pickSlotTime?.time, item)}>
                <GText
                  SatoshiBold
                  text={item?.slot?.time}
                  style={styles.slotTime(pickSlotTime?.time, item)}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.headerContainer, {marginTop: scaledValue(40)}]}>
          <GText
            GrMedium
            text={t('reason_string')}
            style={styles.ongoingText}
          />
          <GText
            GrMedium
            text={` ${t('for_appointment_string')}`}
            style={styles.plansText}
          />
        </View>

        <TouchableOpacity
          onPress={() => {
            refRBSheet?.current?.open();
          }}
          style={styles.professionalButton}>
          <GText
            SatoshiMedium
            text={reason || t('select_one_string')}
            style={[
              styles.professionalText,
              {
                color: reason ? colors?.darkPurple2 : colors.jetBlack300,
              },
            ]}
          />
          <Image source={Images.ArrowDown} style={styles.arrowIcon} />
        </TouchableOpacity>
        <View style={[styles.headerContainer, {marginTop: scaledValue(40)}]}>
          <GText
            GrMedium
            text={t('describe_string')}
            style={styles.ongoingText}
          />
          <GText
            GrMedium
            text={` ${t('your_concern_string')}`}
            style={styles.plansText}
          />
        </View>

        <View style={{alignSelf: 'center', paddingHorizontal: scaledValue(20)}}>
          <Input
            value={message}
            multiline={true}
            label={t('your_message_string')}
            onChangeText={setMessage}
            style={styles.inputStyle}
          />
        </View>

        <View style={styles.headerContainer}>
          <GText
            GrMedium
            text={t('upload_string')}
            style={styles.ongoingText}
          />
          <GText
            GrMedium
            text={` ${t('records_string')}`}
            style={styles.plansText}
          />
        </View>

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

        <GButton
          onPress={book_appointment_hit}
          title={t('book_appointment_string')}
          textStyle={styles.buttonText}
          style={styles.buttonStyle}
        />
      </ScrollView>
      {show && (
        <MonthPicker
          onChange={onValueChange}
          value={date}
          minimumDate={new Date()}
          maximumDate={new Date(2025, 5)}
        />
      )}

      <OptionMenuSheet
        refRBSheet={refRBSheet}
        title={'Select reason'}
        options={medicalIssues}
        onChoose={val => {
          // setSelectLaw(val);
          setReason(val?.title);
          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </View>
  );
};

export default BookAppointment;

export const medicalIssues = [
  {id: 0, title: 'Allergies', textColor: '#3E3E3E'},
  {id: 1, title: 'Dental Care', textColor: '#3E3E3E'},
  {id: 2, title: 'Bladder Infection', textColor: '#3E3E3E'},
  {id: 3, title: 'Fleas', textColor: '#3E3E3E'},
  {id: 4, title: 'Upset Stomach', textColor: '#3E3E3E'},
  {id: 5, title: 'Skin Condition', textColor: '#3E3E3E'},
  {id: 6, title: 'Eye Condition', textColor: '#3E3E3E'},
  {id: 7, title: 'Vomiting or Diarrhea', textColor: '#3E3E3E'},
  {id: 8, title: 'Fleas', textColor: '#3E3E3E'},
];
