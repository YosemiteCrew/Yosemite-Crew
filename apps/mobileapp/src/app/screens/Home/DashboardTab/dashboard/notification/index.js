import {
  FlatList,
  Image,
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

const Notifications = ({navigation}) => {
  const {t} = useTranslation();
  const [selectedOption, setSelectedOption] = useState(t('all_string'));
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

  const options = [
    {id: 1, title: t('all_string')},
    {id: 2, title: t('alert_string')},
    {id: 3, title: t('appointments_string')},
    {id: 4, title: t('messages_string')},
    {id: 5, title: t('reminders_string')},
    {id: 6, title: t('vaccinations_string')},
  ];

  const renderOption = item => (
    <TouchableOpacity
      key={item.id}
      onPress={() => setSelectedOption(item.title)}
      style={[
        styles.optionButton,
        {
          borderWidth: selectedOption === item.title ? 0 : scaledValue(1),
          backgroundColor:
            selectedOption === item.title ? colors.appRed : 'transparent',
        },
      ]}>
      <GText
        GrMedium
        text={item.title}
        style={[
          styles.optionText,
          {
            color: selectedOption === item.title ? colors.white : colors.appRed,
          },
        ]}
      />
    </TouchableOpacity>
  );

  const filterNotifications = () => {
    if (selectedOption == 'All') {
      return notifications;
    } else {
      return notifications.filter(item => item.category == selectedOption);
    }
  };

  const notifications = [
    {
      id: 1,
      title: 'Daily Walk Reminder',
      timeAgo: '30m ago',
      message: 'Kizie hasn’t had her daily walk yet. Let’s get her moving!',
      icon: Images.Reminder,
      petImage: Images.Kizi,
      category: 'Reminders',
    },
    {
      id: 2,
      title: 'Message from Your Vet',
      timeAgo: '5h ago',
      message: 'New message from your vet regarding Kizie’s recent check-up.',
      icon: Images.Message,
      petImage: Images.Kizi,
      category: 'Messages',
    },
    {
      id: 3,
      title: 'Flea Treatment Due',
      timeAgo: '12h ago',
      message:
        'Oscar’s flea treatment is due today. Keep her protected from pests.',
      icon: Images.Alert,
      petImage: Images.CatImg,
      category: 'Alerts',
    },
    {
      id: 4,
      title: 'Grooming Appointment Confirmed',
      timeAgo: '2d ago',
      message:
        'Oscar’s grooming appointment is confirmed for tomorrow at 4:00 PM.',
      icon: Images.Appointment,
      petImage: Images.CatImg,
      category: 'Appointments',
    },
    {
      id: 5,
      title: 'Vaccination Due Soon',
      timeAgo: '1w ago',
      message:
        'Oscar’s next vaccination is due this week. Schedule an appointment to keep him protected.',
      icon: Images.Vaccination,
      petImage: Images.CatImg,
      category: 'Vaccinations',
    },
    {
      id: 6,
      title: 'Exercise Reminder',
      timeAgo: '10d ago',
      message:
        'Time for Kizie’s daily exercises. Let’s keep her on track with her recovery.',
      icon: Images.Reminder,
      petImage: Images.Kizi,
      category: 'Reminders',
    },
  ];

  const NotificationItem = ({item}) => (
    <TouchableOpacity activeOpacity={0.5} style={styles.listTile}>
      <View style={styles.imgTextView}>
        <Image source={item?.icon} style={styles.messageImg} />
        <View style={styles.innerTextView}>
          <GText GrMedium text={item?.title} style={styles.titleStyle} />
          <GText SatoshiBold text={item?.timeAgo} style={styles.timeText} />
          <GText
            SatoshiRegular
            text={item?.message}
            style={styles.messageText}
          />
        </View>
      </View>
      <Image source={item?.petImage} style={styles.petImg} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.dashboardMainView}>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}>
          <View style={styles.optionContainer}>
            {options.map(renderOption)}
          </View>
        </ScrollView>
      </View>
      <FlatList
        data={filterNotifications()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.flatListContainer}
        renderItem={({item}) => <NotificationItem item={item} />}
      />
    </View>
  );
};

export default Notifications;
