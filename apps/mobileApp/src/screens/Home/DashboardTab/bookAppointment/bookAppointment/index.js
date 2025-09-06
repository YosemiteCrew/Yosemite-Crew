import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  TextInput,
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
  formatToLocalISO,
  getCurrentMonthAndYear,
  getMonthAndDay,
  getMonthYear,
  getShortDayAndDate,
} from '../../../../../utils/constants';
import {
  book_appointment_api,
  get_time_slots_by_date,
  get_time_slots_by_Month,
  reschedule_appointment,
} from '../../../../../redux/slices/appointmentSlice';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import {pick, types} from '@react-native-documents/picker';
import MonthPicker from 'react-native-month-year-picker';
import {showToast} from '../../../../../components/Toast';
import GImage from '../../../../../components/GImage';
import {createPetAppointmentFHIRResource} from '../../../../../helpers/createPetAppointmentFHIRResource';
import {CommonActions} from '@react-navigation/native';
import {navigationContainerRef} from '../../../../../../App';

const BookAppointment = ({navigation, route}) => {
  const {
    doctorDetail,
    departmentDetail,
    businessDetails,
    screen,
    item,
    getAppointments,
  } = route?.params;

  console.log('¡temmmm', JSON.stringify(item));
  const appointmentItem = item;
  const {t} = useTranslation();
  const refRBSheet = useRef();

  const [selectedPetId, setSelectedPetId] = useState(
    screen
      ? {
          id: item?.petId,
        }
      : null,
  );
  const [pickSlotTime, setPickSlotTime] = useState({
    slotTime: item?.time,
    id: item?.slotId,
  });
  const [pickSlot, setPickSlot] = useState(null);
  const [apiCallImage, setApiCallImage] = useState([]);

  const [message, setMessage] = useState('');
  const [date, setDate] = useState(new Date());
  const [currentMonthYear, setCurrentMonthYear] = useState(getMonthYear());
  const [reason, setReason] = useState('');
  const dispatch = useAppDispatch();
  const petList = useAppSelector(state => state.pets?.petLists);

  const [timeSlotsList, setTimeSlotsList] = useState([]);
  const [monthlySlotsLists, setMonthlySlotsLists] = useState([]);

  const [show, setShow] = useState(false);

  const showPicker = useCallback(value => setShow(value), []);

  const onValueChange = useCallback(
    (event, newDate) => {
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
      // headerRight: () => (
      //   <HeaderButton
      //     icon={Images.bellBold}
      //     tintColor={colors.jetBlack}
      //     onPress={() => {}}
      //   />
      // ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const handlePetSelection = pet => {
    if (selectedPetId?.id === pet?.id) {
      setSelectedPetId(null);
    } else {
      setSelectedPetId(pet);
    }
  };

  const getTimeSlots = date => {
    const api_credentials = {
      appointmentDate: date,
      doctorId: doctorDetail?.id,
    };
    dispatch(get_time_slots_by_date(api_credentials)).then(res => {
      if (get_time_slots_by_date.fulfilled.match(res)) {
        setTimeSlotsList(res.payload?.data?.entry);
      }
    });
  };

  const getTimeSlotsByMonth = date => {
    const {month, year} = getCurrentMonthAndYear(date || new Date());

    const getApppointmentMont = new Date(item?.date)?.getMonth() + 1;
    const getApppointmentYear = new Date(item?.date)?.getFullYear();

    const appointment_api_credentials = {
      slotMonth: getApppointmentMont,
      slotYear: getApppointmentYear,
      doctorId: doctorDetail?.id,
    };

    const api_credentials = {
      slotMonth: month,
      slotYear: year,
      doctorId: doctorDetail?.id,
    };
    dispatch(
      get_time_slots_by_Month(
        screen ? appointment_api_credentials : api_credentials,
      ),
    ).then(res => {
      if (get_time_slots_by_Month.fulfilled.match(res)) {
        const filterMonthlySlotsLists =
          res?.payload?.data?.entry[1]?.resource?.component?.filter(
            item => item?.code?.date >= currentDate,
          );

        setMonthlySlotsLists(filterMonthlySlotsLists);
        const firstAvailableSlot = filterMonthlySlotsLists?.find(
          slot => slot.valueInteger > 0,
        );
        if (screen) {
          setPickSlot(item?.date);
        } else {
          if (firstAvailableSlot) {
            setPickSlot(firstAvailableSlot.code.date);
          }
        }
      }
    });
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

      // setApiCallImage({
      //   name: result[0]?.name,
      //   uri: fileUri,
      //   type: result[0]?.type,
      // });
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

  const onSuccessDoc = files => {
    let name = files?.name;
    let type = files?.type;
    let localUri = files?.uri;
    setApiCallImage(prevState => [...prevState, {name, uri: localUri, type}]);
    // setApiCallImage({ name, uri: localUri, type });
  };

  console.log(
    'formatToLocalISO(pickSlot, pickSlotTime?.slotTime)',
    pickSlotTime?.slotTime,
  );

  const book_appointment_hit = () => {
    const api_credentials = {
      petId: selectedPetId?.id,
      doctorId: doctorDetail?.id,
      businessId: businessDetails?.id,
      startDateTime: formatToLocalISO(pickSlot, pickSlotTime?.slotTime),
      description: message,
      reasonText: reason,
      departmentId: departmentDetail?._id,
      departmentName: departmentDetail?.departmentName,
      slotId: pickSlotTime?.id,
    };

    const rescheduleAppointmentInput = {
      data: {
        appointmentDate: pickSlot,
        timeslot: pickSlotTime?.slotTime,
      },
    };
    console.log(
      'rescheduleAppointmentInputrescheduleAppointmentInput',
      JSON.stringify(rescheduleAppointmentInput),
    );

    if (screen) {
      dispatch(
        reschedule_appointment({
          appointmentID: item?.id,
          api_credentials: rescheduleAppointmentInput,
        }),
      ).then(res => {
        if (reschedule_appointment.fulfilled.match(res)) {
          if (res.payload.status === 1) {
            navigation?.goBack();
            getAppointments();
          }
        }
      });
    } else {
      if (!selectedPetId?.id) {
        showToast(0, 'Please select your companion.');
      } else if (!pickSlotTime?.slotTime) {
        showToast(0, 'Please select one slot.');
      } else if (!reason) {
        showToast(0, 'Please select reason for appointment.');
      } else if (!message) {
        showToast(0, 'Please describe your concern.');
      } else {
        const fhirPayload = createPetAppointmentFHIRResource(api_credentials);

        const input = {
          data: fhirPayload,
          files: apiCallImage,
        };
        dispatch(book_appointment_api(input)).then(res => {
          if (book_appointment_api.fulfilled.match(res)) {
            if (res.payload.status === 1) {
              navigationContainerRef.navigate('TabBar', {
                screen: 'Appointments',
              });
            }
          }
        });
      }
    }

    // dispatch(book_appointment_api(api_credentials));
  };

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <GImage
            image={doctorDetail?.doctorImage}
            style={styles.doctorImgStyle}
          />

          <View style={styles.textView}>
            <GText
              GrMedium
              text={`Dr. ${doctorDetail?.name}`}
              style={styles.doctorNameText}
            />
            <GText
              SatoshiBold
              text={doctorDetail?.specialization}
              style={[
                styles.departmentText,
                {marginTop: scaledValue(4), textTransform: 'capitalize'},
              ]}
            />
            <GText
              SatoshiBold
              text={doctorDetail?.qualification}
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
          <ScrollView
            contentContainerStyle={{gap: scaledValue(12)}}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {petList?.map((item, index) => {
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.petItem]}
                  onPress={() => handlePetSelection(item)}>
                  <GImage
                    image={item?.petImages}
                    style={styles.imgStyle}
                    noImageSource={Images.Kizi}
                  />
                  <GText
                    SatoshiBold
                    text={item?.name}
                    style={styles.petTitle}
                  />
                  <View
                    style={styles.petUnderline(selectedPetId?.id === item?.id)}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
          onPress={() => showPicker(true)}
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
              const {shortDayName, dateNumber} = getShortDayAndDate(
                item?.code?.date,
              );

              return (
                <TouchableOpacity
                  disabled={item?.valueInteger === 0}
                  onPress={() => {
                    setPickSlot(item?.code?.date);
                    setPickSlotTime();
                  }}
                  style={styles.slotCard(pickSlot, item)}>
                  <GText
                    SatoshiBold
                    text={shortDayName}
                    style={styles.dayText(pickSlot, item?.code?.date)}
                  />
                  <GText
                    GrMedium
                    text={dateNumber}
                    style={styles.dateText(pickSlot, item?.code?.date)}
                  />
                  <GText
                    SatoshiBold
                    text={item?.valueInteger || 'N/A'}
                    style={styles.slotText(pickSlot, item?.code?.date)}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
        {timeSlotsList?.length > 0 && (
          <View style={styles.slotTimeUpperView}>
            {timeSlotsList?.map((item, index) => {
              return (
                <TouchableOpacity
                  key={index}
                  disabled={item?.resource?.isBooked === 'true' && true}
                  onPress={() => setPickSlotTime(item?.resource)}
                  style={styles.slotTimeCard(pickSlotTime?.slotTime, item)}>
                  <GText
                    SatoshiBold
                    text={item?.resource?.slotTime}
                    style={styles.slotTime(pickSlotTime?.slotTime, item)}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {screen ? null : (
          <>
            <View
              style={[styles.headerContainer, {marginTop: scaledValue(30)}]}>
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
            <View
              style={[styles.headerContainer, {marginTop: scaledValue(30)}]}>
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

            <View
              style={{alignSelf: 'center', paddingHorizontal: scaledValue(20)}}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline={true}
                style={styles.inputStyle}
                placeholder={t('your_message_string')}
                placeholderTextColor={colors.darkPurple2}
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

            {apiCallImage?.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: scaledValue(20),
                  gap: scaledValue(16),
                  paddingHorizontal: scaledValue(20),
                }}>
                {apiCallImage?.map((i, d) => (
                  <View>
                    <Image
                      source={{uri: i?.uri}}
                      borderRadius={scaledValue(4)}
                      style={styles.imageStyle}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setApiCallImage(prev =>
                          prev.filter((_, idx) => idx !== d),
                        );
                      }}
                      style={styles.crossImgView}>
                      <Image
                        source={Images.CrossIcon}
                        style={styles.crossStyle}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={uploadDocument}
                  style={styles.addImgButton}>
                  <Image
                    source={Images.PlusIcon}
                    tintColor={colors.jetBlack}
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
          </>
        )}

        {/* <TouchableOpacity
          onPress={uploadDocument}
          style={styles.uploadContainer}
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

        <GButton
          onPress={book_appointment_hit}
          title={
            screen ? 'Rechedule Appointment' : t('book_appointment_string')
          }
          textStyle={styles.buttonText}
          style={styles.buttonStyle}
        />
      </ScrollView>
      {show && (
        <MonthPicker
          onChange={onValueChange}
          value={date}
          minimumDate={new Date()}
          maximumDate={
            new Date(new Date().getFullYear(), new Date().getMonth() + 1)
          }
          // maximumDate={new Date(2025, 5)}
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
