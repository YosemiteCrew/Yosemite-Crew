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
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import Input from '../../../../../components/Input';
import ToggleButton from '../../../../../components/ToogleButton';
import LinearGradient from 'react-native-linear-gradient';
import GButton from '../../../../../components/GButton';
import Modal from 'react-native-modal';
import GTextButton from '../../../../../components/GTextButton/GTextButton';
import DatePicker from 'react-native-date-picker';

const AddNewTask = ({navigation}) => {
  const {t} = useTranslation();
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [visible, setVisible] = useState(false);
  const [toggleState, setToggleState] = useState(true);
  const [calenderToggle, setCalenderToggle] = useState(false);
  const [selectReminder, setSelectReminder] = useState(null);

  const [date, setDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [formValue, setFormValue] = useState({
    taskName: '',
    date: '',
    time: '',
    repeatTask: '',
    reminder: '',
  });

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

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
    });
  };

  const petList = [
    {
      id: 1,
      name: 'kizie',
      img: Images.Kizi,
    },
    {
      id: 2,
      name: 'Oscar',
      img: Images.CatImg,
    },
  ];

  const userList = [
    {
      id: 1,
      name: 'Sky',
      img: Images.Sky,
    },
    {
      id: 2,
      name: 'Pika',
      img: Images.Pika,
    },
  ];

  const handlePetSelection = pet => {
    if (selectedPetId?.id === pet.id) {
      setSelectedPetId(null);
    } else {
      setSelectedPetId(pet);
    }
  };

  const handleUserSelection = user => {
    if (selectedUserId?.id === user.id) {
      setSelectedUserId(null);
    } else {
      setSelectedUserId(user);
    }
  };

  const reminderList = [
    {
      id: 1,
      reminder: '30 mins prior',
    },
    {
      id: 2,
      reminder: '1 hour prior',
    },
    {
      id: 3,
      reminder: '12 hours prior',
    },
    {
      id: 4,
      reminder: '1 day prior',
    },
    {
      id: 5,
      reminder: '3 days prior',
    },
  ];

  const list = [
    {
      id: 1,
      title: 'Google Calendar',
      img: Images.GoogleCalender,
    },
    {
      id: 2,
      title: 'iCloud Calendar',
      img: Images.ICloud,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.dashboardMainView}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView style={styles.scrollView}>
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
              style={styles.petItem(selectedPetId?.id, item?.id)}
              onPress={() => handlePetSelection(item)}>
              <Image source={item?.img} style={styles.imgStyle} />
              <GText SatoshiBold text={item?.name} style={styles.petTitle} />
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
            text={` ${t('your_pet_small_string')}`}
            style={styles.plansText}
          />
        </View>
        <View style={styles.petListContainer}>
          {userList.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.petItem(selectedUserId?.id, item.id)}
              onPress={() => handleUserSelection(item)}>
              <Image source={item?.img} style={styles.imgStyle} />
              <GText SatoshiBold text={item?.name} style={styles.petTitle} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.inputView}>
          <Input
            value={formValue.taskName}
            label={t('task_name_string')}
            onChangeText={value =>
              setFormValue({...formValue, taskName: value})
            }
            style={styles.input}
          />
          <View style={styles.innerInputView}>
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
            <TouchableOpacity
              onPress={() => setOpen(true)}
              style={styles.professionalButton}>
              <GText
                SatoshiRegular
                text={t('time_string')}
                style={styles.professionalText}
              />
              <Image source={Images.Clock} style={styles.iconStyle} />
            </TouchableOpacity>
            {/* 
            <Input
              value={formValue.taskName}
              rightIcon={Images.Clock}
              iconStyle={styles.iconStyle}
              label={t('time_string')}
              onChangeText={value =>
                setFormValue({...formValue, taskName: value})
              }
              style={styles.dateInput}
            /> */}
          </View>
          <Input
            value={formValue.repeatTask}
            rightIcon={Images.ArrowDown}
            iconStyle={styles.iconStyle}
            label={t('repeat_task_string')}
            onChangeText={value =>
              setFormValue({...formValue, repeatTask: value})
            }
            style={styles.input}
          />
        </View>
        <View style={styles.dateRow}>
          <GText
            SatoshiBold
            text={t('reminder_string')}
            style={styles.dateText}
          />
          <ToggleButton
            toggleState={toggleState}
            setToggleState={setToggleState}
          />
        </View>
        <View style={styles.reminderView}>
          {reminderList?.map((item, index) => (
            <LinearGradient
              key={index}
              style={styles.linearView}
              colors={
                selectReminder === item.id
                  ? ['rgba(253, 189, 116, 0.21)', 'rgba(253, 189, 116, 0.07)']
                  : [colors.themeColor, colors.themeColor]
              }>
              <TouchableOpacity
                onPress={() => {
                  setFormValue({
                    ...formValue,
                    reminder: item.reminder,
                  });
                  setSelectReminder(item.id);
                }}
                style={styles.placeView(selectReminder, item.id)}>
                <GText
                  SatoshiRegular
                  text={item.reminder}
                  style={styles.placeText(selectReminder, item.id)}
                />
              </TouchableOpacity>
            </LinearGradient>
          ))}
        </View>
        <View style={[styles.dateRow, {marginTop: scaledValue(24)}]}>
          <GText
            SatoshiBold
            text={t('sync_with_calender_string')}
            style={styles.dateText}
          />
          <ToggleButton
            onPress={() => {
              setVisible(true);
              setCalenderToggle(true);
            }}
            toggleState={calenderToggle}
            setToggleState={setCalenderToggle}
          />
        </View>
        <GButton
          onPress={() => {}}
          title={t('add_task_string')}
          style={styles.buttonStyle}
          textStyle={styles.buttonText}
        />
      </ScrollView>
      <Modal isVisible={visible}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            onPress={() => {
              setVisible(false);
              setCalenderToggle(false);
            }}
            style={styles.closeButton}>
            <Image source={Images.Close} style={styles.closeIcon} />
          </TouchableOpacity>
          <GText
            GrMedium
            text={t('sync_with_you_calender_string')}
            style={styles.modalTitle}
          />
          <View style={styles.listView}>
            {list?.map((i, d) => (
              <View style={styles.itemView}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Image source={i?.img} style={styles.imgCalenderStyle} />
                  <GText
                    SatoshiBold
                    text={i?.title}
                    style={styles.titleStyle}
                  />
                </View>
                <GTextButton
                  title={'Connect'}
                  titleStyle={styles.connectStyle}
                />
              </View>
            ))}
          </View>
          <View style={styles.buttonView}>
            <GButton
              onPress={() => {}}
              title={t('cancel_string')}
              textStyle={styles.cancelText}
              style={styles.cancelButtonStyle}
            />
          </View>
        </View>
      </Modal>
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
    </KeyboardAvoidingView>
  );
};

export default AddNewTask;
