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
} from '../../../../../redux/slices/appointmentSlice';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import {pick, types} from '@react-native-documents/picker';
import MonthPicker from 'react-native-month-year-picker';
import {showToast} from '../../../../../components/Toast';
import GImage from '../../../../../components/GImage';
import {createPetAppointmentFHIRResource} from '../../../../../helpers/createPetAppointmentFHIRResource';

const BookAppointment = ({navigation, route}) => {
  const {doctorDetail, departmentDetail, businessDetails} = route?.params;
  const {t} = useTranslation();
  const refRBSheet = useRef();

  const [selectedPetId, setSelectedPetId] = useState(null);
  const [pickSlotTime, setPickSlotTime] = useState(null);
  const [pickSlot, setPickSlot] = useState(null);
  const [apiCallImage, setApiCallImage] = useState([]);
  const qualification =
    doctorDetail?.resource.qualification?.[0]?.code?.text || 'N/A';
  const department =
    doctorDetail?.resource.department?.[0]?.code?.text || 'N/A';

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
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.jetBlack}
          onPress={() => {}}
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

  const handlePetSelection = pet => {
    if (selectedPetId?.id === pet?.resource?.id) {
      setSelectedPetId(null);
    } else {
      setSelectedPetId(pet?.resource);
    }
  };

  const getTimeSlots = date => {
    const api_credentials = {
      appointmentDate: date,
      doctorId: doctorDetail?.resource?.id,
    };
    dispatch(get_time_slots_by_date(api_credentials)).then(res => {
      if (get_time_slots_by_date.fulfilled.match(res)) {
        setTimeSlotsList(res.payload?.data?.entry);
      }
    });
  };

  const getTimeSlotsByMonth = date => {
    const {month, year} = getCurrentMonthAndYear(date || new Date());
    const api_credentials = {
      slotMonth: month,
      slotYear: year,
      doctorId: doctorDetail?.resource?.id,
    };
    dispatch(get_time_slots_by_Month(api_credentials)).then(res => {
      if (get_time_slots_by_Month.fulfilled.match(res)) {
        const filterMonthlySlotsLists =
          res?.payload?.data?.entry[1]?.resource?.component?.filter(
            item => item?.code?.date >= currentDate,
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
  const book_appointment_hit = () => {
    const api_credentials = {
      petId: selectedPetId?.id,
      doctorId: doctorDetail?.resource?.id,
      businessId: businessDetails?.id,
      startDateTime: formatToLocalISO(pickSlot, pickSlotTime?.slotTime),
      description: message,
      reasonText: reason,
      departmentId: departmentDetail?.id,
      departmentName: department,
      slotId: pickSlotTime?.id,

      // timeslot: pickSlotTime?.slotTime,
      // files: '',
    };

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

      dispatch(book_appointment_api(input));
    }

    // dispatch(book_appointment_api(api_credentials));
  };

  const docDetails = doctorDetail?.resource?.extension?.reduce((acc, item) => {
    const value = item.valueString ?? item.valueDecimal ?? item.valueInteger;

    if (value !== undefined) {
      acc[item.title] = value;
    }

    return acc;
  }, {});

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <GImage
            image={docDetails?.doctorImage}
            style={styles.doctorImgStyle}
          />

          <View style={styles.textView}>
            <GText
              GrMedium
              text={`Dr. ${doctorDetail?.resource?.name[0]?.text}`}
              style={styles.doctorNameText}
            />
            <GText
              SatoshiBold
              text={department}
              style={[
                styles.departmentText,
                {marginTop: scaledValue(4), textTransform: 'capitalize'},
              ]}
            />
            <GText
              SatoshiBold
              text={qualification}
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
            {petList?.entry?.map((item, index) => {
              const petDetails = item?.resource?.extension?.reduce(
                (acc, item) => {
                  acc[item.title] = item.valueString;
                  return acc;
                },
                {},
              );

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.petItem,
                    {
                      opacity:
                        selectedPetId?.id === item?.resource?.id ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => handlePetSelection(item)}>
                  <GImage
                    image={petDetails?.petImage?.url}
                    style={styles.imgStyle}
                    noImageSource={Images.Kizi}
                  />
                  <GText
                    SatoshiBold
                    text={item?.resource?.name[0]?.text}
                    style={styles.petTitle}
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
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline={true}
            style={styles.inputStyle}
            placeholder={t('your_message_string')}
            placeholderTextColor={colors.darkPurple2}
          />
          {/* <Input
            value={message}
            multiline={true}
            label={t('your_message_string')}
            onChangeText={setMessage}
            style={styles.inputStyle}
          /> */}
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
