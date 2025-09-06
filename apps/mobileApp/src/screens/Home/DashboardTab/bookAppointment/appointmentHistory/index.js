import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import Swiper from 'react-native-swiper';
import AppointmentCard from '../../../../../components/AppointmentCard';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../../redux/store/storeUtils';
import {
  cancel_appointment,
  get_appointment_list,
} from '../../../../../redux/slices/appointmentSlice';
import {transformAllAppointments} from '../../../../../helpers/transformAppointments';
import moment from 'moment';
import GButton from '../../../../../components/GButton';

const AppointmentHistory = ({navigation}) => {
  const loggedUserData = useAppSelector(state => state.auth.user);
  const {t} = useTranslation();
  const [scrollIndex, setScrollIndex] = useState(0);
  const dispatch = useAppDispatch();
  const [pendingAppointments, setPendingAppointments] = useState({
    pendingList: [],
    pendingCount: '',
  });
  const [upComingAppointmentsList, setUpComingAppointmentsList] = useState({
    upcomingList: [],
    upcomingCount: '',
  });
  const [pastAppointments, setPastAppointments] = useState({
    pastList: [],
    pastCount: '',
  });
  const [cancelAppointments, setCancelAppointments] = useState({
    cancelList: [],
    cancelCount: '',
  });
  const [appointmentType, setAppointmentType] = useState('all');

  const getAppointments = () => {
    dispatch(
      get_appointment_list({
        type: appointmentType,
        limit: 10,
        offset: 0,
      }),
    ).then(res => {
      if (get_appointment_list.fulfilled.match(res)) {
        const transformed = transformAllAppointments(res?.payload);
        setUpComingAppointmentsList({
          upcomingList: transformed?.upcoming,
          upcomingCount: res?.payload?.data?.upcoming?.count,
        });
        setPendingAppointments({
          pendingList: transformed?.pending,
          pendingCount: res?.payload?.data?.pending?.count,
        });
        setPastAppointments({
          pastList: transformed?.past,
          pastCount: res?.payload?.data?.past?.count,
        });
        setCancelAppointments({
          cancelList: transformed?.cancel,
          cancelCount: res?.payload?.data?.cancel?.count,
        });
      }
    });
  };

  useEffect(() => {
    getAppointments();
  }, [appointmentType]);
  console.log('pedning', JSON.stringify(pendingAppointments?.pendingList));

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
          // icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          // onPress={() => navigation.goBack()}
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

  const cancelAppointment = id => {
    const input = {
      appointmentId: id,
    };

    dispatch(cancel_appointment(input)).then(res => {
      if (cancel_appointment.fulfilled.match(res)) {
        if (res.payload?.status === 1) {
          getAppointments();
        }
      }
    });
  };

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}>
        <View style={styles.optionContainer}>{options.map(renderOption)}</View>
      </ScrollView>
      {upComingAppointmentsList?.upcomingList?.length > 0 ||
      pendingAppointments?.pendingList?.length > 0 ||
      pastAppointments?.pastList?.length > 0 ||
      cancelAppointments?.cancelList?.length > 0 ? (
        <ScrollView
          contentContainerStyle={{paddingBottom: scaledValue(151)}}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                getAppointments();
              }}
            />
          }
          showsVerticalScrollIndicator={false}>
          {upComingAppointmentsList?.upcomingList?.length > 0 && (
            <>
              <View style={styles.headerView}>
                <GText
                  GrMedium
                  text={`${t('upcoming_string')} `}
                  style={styles.teamText}
                />
                <GText
                  GrMedium
                  text={`(${upComingAppointmentsList?.upcomingList?.length})`}
                  style={styles.countText}
                />
              </View>

              <View style={{marginTop: scaledValue(12)}}>
                <FlatList
                  data={upComingAppointmentsList?.upcomingList} // Add real data here for confirmed appointments
                  contentContainerStyle={{
                    gap: scaledValue(20),
                    marginBottom: scaledValue(15),
                  }}
                  renderItem={({item, index}) => {
                    const combinedDate = `${item?.date} ${item?.time}`;
                    const formatted = moment(
                      combinedDate,
                      'YYYY-MM-DD h:mm A',
                    ).format('dddd, DD MMM - hh:mm A');
                    return (
                      <View key={index}>
                        <AppointmentCard
                          item={item}
                          petImage={item?.pet?.image}
                          key={index}
                          imageSource={item?.vet?.image}
                          doctorName={item?.vet?.name}
                          department={item?.vet?.specialization}
                          qualifications={item?.vet?.qualification}
                          hospitalName={item?.location}
                          appointmentTime={formatted}
                          navigation={navigation}
                          // showCancel
                          appointmentDirection={() => {}}
                          appointmentRescheduleOnPress={() => {
                            navigation?.navigate('StackScreens', {
                              screen: 'BookAppointment',
                              params: {
                                doctorDetail: {
                                  id: item?.vetId,
                                  doctorImage: item?.vet?.image,
                                  name: item?.vet?.name,
                                  qualification: item?.vet?.qualification,
                                  specialization: item?.vet?.specialization,
                                },
                                departmentDetail: {
                                  _id: item?.vet?.departmentId,
                                  departmentName: item?.vet?.specialization,
                                },
                                businessDetails: {id: item?.businessId},
                                screen: 'dashboard',
                                item: item,
                                getAppointments,
                              },
                            });
                          }}
                          pendingOnPress={() => {
                            cancelAppointment(item?.id);
                          }}
                          buttonText={t('get_directions_string')}
                          showButton
                          appointmentTitle={t('cancel_appointment_string')}
                        />
                      </View>
                    );
                  }}
                />
                {/* <Swiper
                  height={
                    upComingAppointmentsList?.upcomingList?.length > 1
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
                  {upComingAppointmentsList?.upcomingList?.map(
                    (item, index) => {
                      const combinedDate = `${item?.date} ${item?.time}`;
                      const formatted = moment(
                        combinedDate,
                        'YYYY-MM-DD h:mm A',
                      ).format('dddd, DD MMM - hh:mm A');
                      return (
                        <View key={index}>
                          <AppointmentCard
                            item={item}
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
                    },
                  )}
                </Swiper> */}
              </View>
            </>
          )}

          {pendingAppointments?.pendingList?.length > 0 && (
            <>
              <View
                style={[
                  styles.headerView,
                  {
                    // marginTop: scaledValue(0)
                  },
                ]}>
                <GText
                  GrMedium
                  text={`${t('pending_string')} `}
                  style={styles.teamText}
                />
                <GText
                  GrMedium
                  text={`(${pendingAppointments?.pendingList?.length})`}
                  style={styles.countText}
                />
              </View>
              <FlatList
                data={pendingAppointments?.pendingList} // Add real data here for confirmed appointments
                contentContainerStyle={{
                  gap: scaledValue(20),
                }}
                renderItem={({item, index}) => {
                  const combinedDate = `${item?.date} ${item?.time}`;
                  const formatted = moment(
                    combinedDate,
                    'YYYY-MM-DD h:mm A',
                  ).format('dddd, DD MMM - hh:mm A');

                  return (
                    <AppointmentCard
                      item={item}
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
                      pendingOnPress={() => {
                        cancelAppointment(item?.id);
                      }}
                      buttonImg={Images.CrossFill}
                      buttonText={t('cancel_string')}
                      // showCancel
                      pending
                      // showButton
                    />
                  );
                }}
              />
            </>
          )}
          {pastAppointments?.pastList?.length > 0 && (
            <>
              <View style={[styles.headerView]}>
                <GText GrMedium text={'Past '} style={styles.teamText} />
                <GText
                  GrMedium
                  text={`(${pastAppointments?.pastCount})`}
                  style={styles.countText}
                />
              </View>
              <View
                style={
                  {
                    // marginTop: scaledValue(12),
                  }
                }>
                <FlatList
                  data={pastAppointments?.pastList} // Add real data here for past appointments
                  contentContainerStyle={{
                    gap: scaledValue(20),
                    marginBottom: scaledValue(15),
                  }}
                  renderItem={({item, index}) => {
                    const formatted = moment(item?.date).format(
                      'dddd, DD MMMM YYYY',
                    );

                    return (
                      <AppointmentCard
                        item={item}
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
            </>
          )}
          {cancelAppointments?.cancelList?.length > 0 && (
            <>
              <View style={[styles.headerView]}>
                <GText
                  GrMedium
                  text={`${t('cancel_string')} `}
                  style={styles.teamText}
                />
                <GText
                  GrMedium
                  text={`(${cancelAppointments?.cancelCount})`}
                  style={styles.countText}
                />
              </View>
              <View style={{}}>
                <FlatList
                  data={cancelAppointments?.cancelList} // Add real data here for past appointments
                  contentContainerStyle={{
                    gap: scaledValue(20),
                    marginBottom: scaledValue(10),
                  }}
                  renderItem={({item, index}) => {
                    const formatted = moment(item?.date).format(
                      'dddd, DD MMMM YYYY',
                    );

                    return (
                      <AppointmentCard
                        item={item}
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
            </>
          )}
        </ScrollView>
      ) : (
        <View style={{flex: 1, marginTop: scaledValue(125)}}>
          <Image
            source={Images.noAppointment}
            style={{
              width: scaledValue(280),
              height: scaledValue(192),
              alignSelf: 'center',
            }}
          />
          <GText
            GrMedium
            text={'We’ve dug and dug… \nbut no appointments found.'}
            style={{
              fontSize: scaledValue(20),
              lineHeight: scaledHeightValue(20 * 1.2),
              textAlign: 'center',
              marginTop: scaledValue(16),
            }}
          />
          <GText
            text={
              'We’ll save your appointment history here once you start seeing your vet.'
            }
            style={{
              fontSize: scaledValue(14),
              lineHeight: scaledHeightValue(14 * 1.2),
              textAlign: 'center',
              marginTop: scaledValue(8),
              paddingHorizontal: scaledValue(40),
            }}
          />
          <GButton
            onPress={() => {
              navigation?.navigate('StackScreens', {
                screen: 'BookAppointmentHome',
              });
            }}
            title={t('book_your_first_appointment_string')}
            style={{
              marginHorizontal: scaledValue(40),
              marginTop: scaledValue(32),
            }}
          />
        </View>
      )}
    </View>
  );
};

export default AppointmentHistory;
