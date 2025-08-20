import {FlatList, ScrollView, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import Swiper from 'react-native-swiper';
import AppointmentCard from '../../../../../components/AppointmentCard';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../../redux/store/storeUtils';
import {get_appointment_list} from '../../../../../redux/slices/appointmentSlice';
import {transformAllAppointments} from '../../../../../helpers/transformAppointments';
import moment from 'moment';

const AppointmentHistory = ({navigation}) => {
  const loggedUserData = useAppSelector(state => state.auth.user);
  const {t} = useTranslation();
  const [scrollIndex, setScrollIndex] = useState(0);
  const dispatch = useAppDispatch();
  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [upComingAppointmentsList, setUpComingAppointmentsList] = useState([]);
  const [pastAppointments, setPastAppointments] = useState([]);
  const [cancelAppointments, setCancelAppointments] = useState([]);
  const [appointmentType, setAppointmentType] = useState('all');

  useEffect(() => {
    dispatch(
      get_appointment_list({
        type: appointmentType,
        limit: 10,
        offset: 0,
      }),
    ).then(res => {
      if (get_appointment_list.fulfilled.match(res)) {
        const transformed = transformAllAppointments(res?.payload);
        setUpComingAppointmentsList(transformed?.upcoming);
        setPendingAppointments(transformed?.pending);
        setPastAppointments(transformed?.past);
        setCancelAppointments(transformed?.cancel);
      }
    });
  }, [appointmentType]);

  const swiperRef = useRef();
  const [selectedOption, setSelectedOption] = useState(t('all_string'));
  useEffect(() => {
    configureHeader();
  }, []);

  const options = [
    {id: 1, title: t('all_string'), value: 'all'},
    {id: 2, title: t('upcoming_string'), value: 'upcoming'},
    {id: 3, title: t('pending_string'), value: 'pending'},
    {id: 4, title: t('past_string'), value: 'past'},
    {id: 5, title: t('cancel_string'), value: 'cancel'},
  ];

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
          style={{marginHorizontal: scaledValue(16)}}
        />
      ),
    });
  };

  const renderOption = item => (
    <TouchableOpacity
      key={item.id}
      onPress={() => {
        setSelectedOption(item.title);
        setAppointmentType(item?.value);
      }}
      style={[
        styles.optionButton,
        {
          borderWidth: selectedOption === item.title ? 0 : scaledValue(1),
          backgroundColor:
            selectedOption === item.title ? colors.jetBlack : 'transparent',
        },
      ]}>
      <GText
        GrMedium
        text={item.title}
        style={[
          styles.optionText,
          {
            color:
              selectedOption === item.title ? colors.white : colors.jetBlack,
          },
        ]}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}>
          <View style={styles.optionContainer}>
            {options.map(renderOption)}
          </View>
        </ScrollView>
        {upComingAppointmentsList?.length > 0 && (
          <>
            <View style={styles.headerView}>
              <GText
                GrMedium
                text={`${t('upcoming_string')} `}
                style={styles.teamText}
              />
              <GText
                GrMedium
                text={`(${upComingAppointmentsList?.length})`}
                style={styles.countText}
              />
            </View>

            <View style={{marginTop: scaledValue(12)}}>
              <Swiper
                height={
                  upComingAppointmentsList?.length > 1
                    ? scaledValue(359)
                    : scaledValue(330)
                }
                ref={swiperRef}
                loop={false}
                bounces={false}
                onIndexChanged={index => setScrollIndex(index)}
                activeDotColor={colors.appRed}
                dotColor={colors.appRed}
                activeDotStyle={styles.activeDotStyle}
                dotStyle={styles.dotStyle}
                paginationStyle={styles.paginationStyle}>
                {upComingAppointmentsList?.map((item, index) => {
                  const combinedDate = `${item?.date} ${item?.time}`;
                  const formatted = moment(
                    combinedDate,
                    'YYYY-MM-DD h:mm A',
                  ).format('dddd, DD MMM - hh:mm A');
                  return (
                    <View key={index}>
                      <AppointmentCard
                        petImage={item?.pet?.image}
                        key={index}
                        imageSource={item?.vet?.image}
                        doctorName={item?.vet?.name}
                        department={item?.vet?.specialization}
                        qualifications={item?.vet?.qualification}
                        hospitalName={item?.location}
                        appointmentTime={formatted}
                        navigation={navigation}
                        showCancel
                        buttonText={t('get_directions_string')}
                        showButton
                        appointmentTitle={t('cancel_appointment_string')}
                      />
                    </View>
                  );
                })}
              </Swiper>
            </View>
          </>
        )}

        <View
          style={[
            styles.headerView,
            {
              // marginTop: scaledValue(0)
            },
          ]}>
          <GText
            GrMedium
            text={`${t('confirm_string')} `}
            style={styles.teamText}
          />
          <GText GrMedium text={'(1)'} style={styles.countText} />
        </View>
        <FlatList
          data={pendingAppointments} // Add real data here for confirmed appointments
          contentContainerStyle={{
            gap: scaledValue(20),
            marginTop: scaledValue(12),
          }}
          renderItem={({item, index}) => {
            const combinedDate = `${item?.date} ${item?.time}`;
            const formatted = moment(combinedDate, 'YYYY-MM-DD h:mm A').format(
              'dddd, DD MMM - hh:mm A',
            );

            return (
              <AppointmentCard
                key={index}
                petImage={item?.pet?.image}
                imageSource={item?.vet?.image}
                doctorName={item?.vet?.name}
                department={item?.vet?.specialization}
                qualifications={item?.vet?.qualification}
                hospitalName={item?.location}
                appointmentTime={formatted}
                appointmentTitle={t('cancel_appointment_string')}
                navigation={navigation}
                confirmed
                buttonImg={Images.CrossFill}
                buttonText={t('cancel_string')}
                // showCancel
                pending
                // showButton
              />
            );
          }}
        />

        <View style={[styles.headerView, {marginTop: scaledValue(37)}]}>
          <GText GrMedium text={'August 2024 '} style={styles.teamText} />
          <GText GrMedium text={'(2)'} style={styles.countText} />
        </View>
        <View
          style={{
            paddingBottom: scaledValue(151),
            // marginTop: scaledValue(12),
          }}>
          <FlatList
            data={pastAppointments} // Add real data here for past appointments
            contentContainerStyle={{gap: scaledValue(20)}}
            renderItem={({item, index}) => {
              const formatted = moment(item?.date).format('dddd, DD MMMM YYYY');

              return (
                <AppointmentCard
                  key={index}
                  petImage={item?.pet?.image}
                  imageSource={item?.vet?.image}
                  doctorName={item?.vet?.name}
                  department={item?.vet?.specialization}
                  qualifications={formatted}
                  hospitalName={item?.time}
                  appointmentTime="See Prescription"
                  navigation={navigation}
                  appointmentTitle={t('book_another_appointment_string')}
                  monthly
                  showCancel
                  onPress={() => {
                    navigation?.navigate('StackScreens', {
                      screen: 'SeePrescription',
                      params: {
                        appointmentDetail: item,
                      },
                    });
                  }}
                />
              );
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default AppointmentHistory;
