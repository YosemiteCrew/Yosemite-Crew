import {FlatList, Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import DatePicker from 'react-native-date-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GButton from '../../../../../components/GButton';
import PetRecordCard from '../../../../../components/PetRecordCard';
import {Divider} from 'react-native-paper';
import moment from 'moment';

const AddNewRecord = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [date, setDate] = useState(null);
  const [open, setOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [time, setTime] = useState(null);

  const setDateFormat = date
    ? moment(date).format('ll')
    : moment().format('ll');

  const setTimeFormat = time
    ? moment(time).format('LT')
    : moment().format('LT');

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
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
    {
      id: 1,
      name: 'Kizie',
      img: Images.Kizi,
    },
    {
      id: 2,
      name: 'Oscar',
      img: Images.CatImg,
    },
  ];

  const handlePetSelection = pet => {
    if (selectedPetId?.id === pet.id) {
      setSelectedPetId(null);
    } else {
      setSelectedPetId(pet);
    }
  };
  return (
    <View style={styles.dashboardMainView}>
      <View style={styles.container}>
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
          <FlatList
            data={petList}
            horizontal
            contentContainerStyle={styles.petList}
            renderItem={({item, index}) => {
              return (
                <TouchableOpacity
                  onPress={() => handlePetSelection(item)}
                  style={[
                    styles.petItem,
                    {opacity: selectedPetId?.id === item.id ? 0.5 : 1},
                  ]}>
                  <Image source={item.img} style={styles.petImage} />
                  <GText
                    SatoshiBold
                    text={item?.name}
                    style={styles.petNameText}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
        <GText
          GrMedium
          text={t('diabetes_log_string')}
          style={styles.recordDateText}
        />
        <PetRecordCard
          title="Date"
          labelName={setDateFormat?.toString()}
          labelColor="#FDBD7429"
          labelStyle={{borderRadius: scaledValue(6)}}
          labelTextStyle={styles.labelTextStyle}
          onPress={() => setOpen(true)}
        />
        <Divider />
        <PetRecordCard
          title="Time"
          labelName={setTimeFormat?.toString()}
          labelColor="#FDBD7429"
          labelStyle={{borderRadius: scaledValue(6)}}
          labelTextStyle={styles.labelTextStyle}
          onPress={() => setTimeOpen(true)}
        />
      </View>
      <View style={styles.buttonView(insets)}>
        <GButton
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'AddNewRecord1',
              params: {
                data: {
                  dateTime: `${setDateFormat?.toString()} ${setTimeFormat?.toString()}`,
                },
              },
            });
          }}
          title={t('continue_string')}
          textStyle={styles.buttonText}
          style={styles.buttonStyle}
        />
      </View>
      <DatePicker
        modal
        open={open}
        date={date || new Date()}
        mode="date"
        onConfirm={val => {
          setDate(val);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
      <DatePicker
        modal
        open={timeOpen}
        date={time || new Date()}
        mode="time"
        onConfirm={val => {
          setTime(val);
          setTimeOpen(false);
        }}
        onCancel={() => setTimeOpen(false)}
      />
    </View>
  );
};

export default AddNewRecord;
