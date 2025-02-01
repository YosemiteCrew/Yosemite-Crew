import React, {useEffect, useState} from 'react';
import {
  FlatList,
  Image,
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

const BookAppointment = ({navigation}) => {
  const {t} = useTranslation();
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [pickSlotTime, setPickSlotTime] = useState(null);
  const [pickSlot, setPickSlot] = useState(null);
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    configureHeader();
    setPickSlot(slotsList[0]?.id);
  }, []);

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

  const petList = [
    {id: 1, name: 'Kizie', img: Images.Kizi},
    {id: 2, name: 'Oscar', img: Images.CatImg},
  ];

  const handlePetSelection = pet => {
    setSelectedPetId(selectedPetId?.id === pet.id ? null : pet);
  };

  const slotsList = [
    {id: 1, day: 'Wed', date: '4', slots: '4 Slots'},
    {id: 2, day: 'Thu', date: '5', slots: '7 Slots'},
    {id: 3, day: 'Fri', date: '6', slots: 'N/A'},
    {id: 5, day: 'Mon', date: '9', slots: '3 Slots'},
    {id: 6, day: 'Tue', date: '10', slots: '6 Slots'},
    {id: 7, day: 'Wed', date: '4', slots: '4 Slots'},
  ];

  const slotTime = [
    {
      id: 1,
      slotTime: [
        {id: 1, time: '10:00AM', status: 'Available'},
        {id: 2, time: '11:00AM', status: 'Available'},
        {id: 3, time: '12:00PM', status: 'Not-Available'},
        {id: 4, time: '1:00PM', status: 'Available'},
        {id: 5, time: '2:00PM', status: 'Not-Available'},
        {id: 6, time: '3:00PM', status: 'Available'},
        {id: 7, time: '4:00PM', status: 'Available'},
        {id: 8, time: '5:00PM', status: 'Not-Available'},
      ],
    },
    {
      id: 2,
      slotTime: [
        {id: 1, time: '10:00AM', status: 'Available'},
        {id: 2, time: '11:00AM', status: 'Not-Available'},
        {id: 3, time: '12:00PM', status: 'Not-Available'},
        {id: 4, time: '1:00PM', status: 'Available'},
        {id: 5, time: '2:00PM', status: 'Available'},
        {id: 6, time: '3:00PM', status: 'Available'},
        {id: 7, time: '4:00PM', status: 'Available'},
        {id: 8, time: '5:00PM', status: 'Available'},
      ],
    },
    {
      id: 5,
      slotTime: [
        {id: 1, time: '10:00AM', status: 'Available'},
        {id: 2, time: '11:00AM', status: 'Available'},
        {id: 3, time: '12:00PM', status: 'Available'},
        {id: 4, time: '1:00PM', status: 'Available'},
        {id: 5, time: '2:00PM', status: 'Available'},
        {id: 6, time: '3:00PM', status: 'Available'},
        {id: 7, time: '4:00PM', status: 'Available'},
        {id: 8, time: '5:00PM', status: 'Available'},
      ],
    },
    {
      id: 6,
      slotTime: [
        {id: 1, time: '10:00AM', status: 'Available'},
        {id: 2, time: '11:00AM', status: 'Available'},
        {id: 3, time: '12:00PM', status: 'Available'},
        {id: 4, time: '1:00PM', status: 'Available'},
        {id: 5, time: '2:00PM', status: 'Not-Available'},
        {id: 6, time: '3:00PM', status: 'Available'},
        {id: 7, time: '4:00PM', status: 'Not-Available'},
        {id: 8, time: '5:00PM', status: 'Not-Available'},
      ],
    },
    {
      id: 7,
      slotTime: [
        {id: 1, time: '10:00AM', status: 'Available'},
        {id: 2, time: '11:00AM', status: 'Available'},
        {id: 3, time: '12:00PM', status: 'Available'},
        {id: 4, time: '1:00PM', status: 'Available'},
        {id: 5, time: '2:00PM', status: 'Available'},
        {id: 6, time: '3:00PM', status: 'Available'},
        {id: 7, time: '4:00PM', status: 'Not-Available'},
        {id: 8, time: '5:00PM', status: 'Available'},
      ],
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Image source={Images.DoctorImg} style={styles.doctorImgStyle} />
          <View style={styles.textView}>
            <GText
              GrMedium
              text={'Dr. David Brown'}
              style={styles.doctorNameText}
            />
            <GText
              SatoshiBold
              text={'Gastroenterology'}
              style={[styles.departmentText, {marginTop: scaledValue(4)}]}
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
            text={` ${t('your_pet_small_string')}`}
            style={styles.plansText}
          />
        </View>

        <View style={styles.petListContainer}>
          {petList.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.petItem,
                {opacity: selectedPetId?.id === item.id ? 0.5 : 1},
              ]}
              onPress={() => handlePetSelection(item)}>
              <Image source={item.img} style={styles.imgStyle} />
              <GText SatoshiBold text={item.name} style={styles.petTitle} />
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
          onPress={() => setOpen(true)}
          style={styles.professionalButton}>
          <GText
            SatoshiRegular
            text={'September 2024'}
            style={styles.professionalText}
          />
          <Image source={Images.ArrowDown} style={styles.arrowIcon} />
        </TouchableOpacity>

        <View style={styles.slotListUpperView}>
          <FlatList
            data={slotsList}
            horizontal
            contentContainerStyle={{gap: scaledValue(8)}}
            showsHorizontalScrollIndicator={false}
            renderItem={({item}) => (
              <TouchableOpacity
                disabled={item?.slots === 'N/A'}
                onPress={() => {
                  setPickSlot(item?.id);
                  setPickSlotTime();
                }}
                style={styles.slotCard(pickSlot, item)}>
                <GText
                  SatoshiBold
                  text={item?.day}
                  style={styles.dayText(pickSlot, item?.id)}
                />
                <GText
                  GrMedium
                  text={item?.date}
                  style={styles.dateText(pickSlot, item?.id)}
                />
                <GText
                  SatoshiBold
                  text={item?.slots}
                  style={styles.slotText(pickSlot, item?.id)}
                />
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.slotTimeUpperView}>
          {slotTime
            .filter(slot => slot.id === pickSlot)
            .flatMap(slot => slot.slotTime)
            .map(time => (
              <TouchableOpacity
                key={time.id}
                disabled={time.status === 'Not-Available'}
                onPress={() => setPickSlotTime(time)}
                style={styles.slotTimeCard(pickSlotTime, time)}>
                <GText
                  SatoshiBold
                  text={time.time}
                  style={styles.slotTime(pickSlotTime?.id, time.id)}
                />
              </TouchableOpacity>
            ))}
        </View>

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
            multiline
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

        <TouchableOpacity style={styles.uploadContainer}>
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
          title={t('book_appointment_string')}
          textStyle={styles.buttonText}
          style={styles.buttonStyle}
        />
      </ScrollView>

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
    </View>
  );
};

export default BookAppointment;
