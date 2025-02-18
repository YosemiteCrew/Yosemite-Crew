import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useState} from 'react';
import {colors} from '../../../../assets/colors';
import {scaledValue} from '../../../utils/design.utils';
import {Images} from '../../../utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GText from '../../../components/GText/GText';
import Input from '../../../components/Input';
import {useTranslation} from 'react-i18next';
import {fonts} from '../../../utils/fonts';
import LinearGradient from 'react-native-linear-gradient';
import GButton from '../../../components/GButton';
import DatePicker from 'react-native-date-picker';
import {styles} from './styles';

const AddPetDetails = ({navigation, route}) => {
  const {petBreed} = route?.params;
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();
  const [selectedId, setSelectedId] = useState(null);
  const [date, setDate] = useState('');
  const [open, setOpen] = useState(false);
  const handlePress = id => {
    setSelectedId(id);
  };

  const [select, setSelected] = useState(null);
  const handlePresshit = id => {
    setSelected(id);
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  const [formValue, setFormValue] = useState({
    name: '',
    dob: date && formatDate(date),
    gender: '',
    weight: '',
    color: '',
    blood_group: '',
    zip: '',
    neutered: '',
  });

  const gender = [
    {
      id: 1,
      gender: t('male_string'),
    },
    {
      id: 2,
      gender: t('female_string'),
    },
  ];
  const neutered = [
    {
      id: 1,
      neutered: t('neutered_string'),
    },
    {
      id: 2,
      neutered: t('not_neutered_string'),
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : ''}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.headerContainer,
            {marginTop: statusBarHeight + scaledValue(18)},
          ]}>
          <TouchableOpacity
            onPress={() => {
              navigation?.goBack();
            }}
            style={styles.backButton}>
            <Image
              source={Images.Left_Circle_Arrow}
              style={styles.backButtonImage}
            />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <GText
              GrMedium
              text={t('more_about_string')}
              style={styles.headerText}
            />
            <GText
              GrMedium
              componentProps={{
                numberOfLines: 1,
              }}
              text={petBreed}
              style={styles.headerTextHighlighted}
            />
          </View>
        </View>
        <TouchableOpacity style={styles.profileImageContainer}>
          <Image source={Images.importProfile} style={styles.profileImage} />
        </TouchableOpacity>
        <View style={styles.formContainer}>
          <Input
            value={formValue.name}
            label={t('name_string')}
            onChangeText={value => setFormValue({...formValue, name: value})}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <TouchableOpacity
            onPress={() => setOpen(true)}
            style={styles.datePickerContainer}>
            <GText
              SatoshiRegular
              text={date ? formatDate(date) : t('dob_string')}
              style={styles.dateText}
            />
            <Image source={Images.Calender} style={styles.dateIcon} />
          </TouchableOpacity>
          <View style={styles.genderContainer}>
            {gender.map((item, index) => (
              <LinearGradient
                key={index}
                style={styles.genderItem}
                colors={
                  selectedId === item.id
                    ? ['rgba(253, 189, 116, 0.21)', 'rgba(253, 189, 116, 0.07)']
                    : [colors.themeColor, colors.themeColor]
                }>
                <TouchableOpacity
                  onPress={() => {
                    setFormValue({...formValue, gender: item.gender});
                    handlePress(item.id);
                  }}
                  style={[
                    styles.genderButton,
                    {
                      borderWidth:
                        selectedId === item.id
                          ? scaledValue(1)
                          : scaledValue(0.5),
                      borderColor:
                        selectedId === item.id ? colors.appRed : '#312943',
                    },
                  ]}>
                  <GText
                    text={item.gender}
                    style={[
                      styles.genderText,
                      {
                        color:
                          selectedId === item.id ? colors.appRed : '#312943',
                        fontFamily:
                          selectedId === item.id
                            ? fonts.SATOSHI_BOLD
                            : fonts.SATOSHI_REGULAR,
                      },
                    ]}
                  />
                </TouchableOpacity>
              </LinearGradient>
            ))}
          </View>
          <TouchableOpacity style={styles.weightContainer}>
            <GText
              SatoshiRegular
              text={t('current_weight_string')}
              style={styles.weightText}
            />
            <View style={styles.weightIconContainer}>
              <GText SatoshiBold text={'lbs'} style={styles.weightUnitText} />
              <Image source={Images.ArrowDown} style={styles.weightIcon} />
            </View>
          </TouchableOpacity>
          <Input
            value={formValue.color}
            label={t('color_string')}
            onChangeText={value => setFormValue({...formValue, color: value})}
            style={styles.input}
            keyboardType={'default'}
          />
          <TouchableOpacity style={styles.bloodGroupContainer}>
            <GText
              SatoshiRegular
              text={t('blood_group_string')}
              style={styles.bloodGroupText}
            />
            <Image source={Images.ArrowDown} style={styles.bloodGroupIcon} />
          </TouchableOpacity>
          <View style={styles.neuteredContainer}>
            {neutered.map((item, index) => (
              <LinearGradient
                key={index}
                style={styles.neuteredItem}
                colors={
                  select === item.id
                    ? ['rgba(253, 189, 116, 0.21)', 'rgba(253, 189, 116, 0.07)']
                    : [colors.themeColor, colors.themeColor]
                }>
                <TouchableOpacity
                  onPress={() => {
                    setFormValue({...formValue, neutered: item.neutered});
                    handlePresshit(item.id);
                  }}
                  style={[
                    styles.neuteredButton,
                    {
                      borderWidth:
                        select === item.id ? scaledValue(1) : scaledValue(0.5),
                      borderColor:
                        select === item.id ? colors.appRed : '#312943',
                    },
                  ]}>
                  <GText
                    text={item.neutered}
                    style={[
                      styles.neuteredText,
                      {
                        color: select === item.id ? colors.appRed : '#312943',
                        fontFamily:
                          select === item.id
                            ? fonts.SATOSHI_BOLD
                            : fonts.SATOSHI_REGULAR,
                      },
                    ]}
                  />
                </TouchableOpacity>
              </LinearGradient>
            ))}
          </View>
          <GButton
            onPress={() => {
              navigation?.navigate('MorePetDetails');
            }}
            title={t('confirm_button_string')}
            style={styles.createButton}
            textStyle={styles.createButtonText}
          />
        </View>
        <DatePicker
          modal
          open={open}
          date={date || new Date()}
          mode="date"
          onConfirm={date => {
            setOpen(false);
            setDate(date);
          }}
          onCancel={() => setOpen(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddPetDetails;
