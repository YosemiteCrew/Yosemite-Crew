import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  Text,
  View,
  Dimensions,
} from 'react-native';
import GText from '../../../../components/GText/GText';
import {Images} from '../../../../utils';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import {scaledHeightValue, scaledValue} from '../../../../utils/design.utils';
import {colors} from '../../../../../assets/colors';
import AppointmentCard from '../../../../components/AppointmentCard';
import Swiper from 'react-native-swiper';
import Modal from 'react-native-modal';
import HalfCircleProgress from '../../../../components/HalfCircleProgress';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../redux/store/storeUtils';
import {get_pet_list} from '../../../../redux/slices/petSlice';
import GImage from '../../../../components/GImage';
import {
  cancel_appointment,
  get_appointment_list,
} from '../../../../redux/slices/appointmentSlice';
import {transformAllAppointments} from '../../../../helpers/transformAppointments';
import moment from 'moment';

const Dashboard = ({navigation}) => {
  const {t} = useTranslation();
  const swiperRef = useRef();
  const petList = useAppSelector(state => state.pets?.petLists);
  const [selectPet, setSelectPet] = useState(petList[0]);
  const userData = useAppSelector(state => state.auth.user);
  const [upComingAppointmentsList, setUpComingAppointmentsList] = useState([]);

  const dispatch = useAppDispatch();
  const getAppointments = () => {
    dispatch(
      get_appointment_list({
        type: 'upcoming',
        limit: 10,
        offset: 0,
      }),
    ).then(res => {
      if (get_appointment_list.fulfilled.match(res)) {
        const transformed = transformAllAppointments(res?.payload);
        setUpComingAppointmentsList(transformed?.upcoming);
      }
    });
  };

  useEffect(() => {
    dispatch(
      get_pet_list({
        offset: 0,
        limit: 10,
      }),
    );
    getAppointments();
  }, []);

  useEffect(() => {
    setSelectPet(petList[0]);
  }, [petList]);

  const [scrollIndex, setScrollIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const handlePetSelection = pet => {
    if (selectPet?.id === pet?.id) {
      setSelectPet(null);
    } else {
      setSelectPet(pet);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerContainerRight}>
          {/* <TouchableOpacity onPress={() => setVisible(true)}>
            <Image source={Images.Emergency} style={styles.emergencyIcon} />
          </TouchableOpacity> */}
          <TouchableOpacity
            style={styles.headerRight}
            // onPress={() =>
            //   navigation.navigate('StackScreens', {screen: 'Notifications'})
            // }
          >
            {/* <Image source={Images.bellBold} style={styles.headerIcon} /> */}
          </TouchableOpacity>
        </View>
      ),
      headerLeft: () => (
        <View style={styles.headerContainerLeft}>
          <GImage
            image={userData?.profileImage[0]?.url}
            style={styles.userImage}
          />
          <GText
            GrMedium
            // componentProps={{numberOfLines: 1, ellipsizeMode: 'tail'}}
            text={`Hello, ${userData?.firstName}`}
            style={styles.greetingText}
          />
        </View>
      ),
    });
  }, [navigation, userData]);

  const modalData = [
    {
      modalImg: Images.helmetView,
      modalHeading: 'Contact Vet/ Practice',
      modalText:
        'Quickly reach your veterinarian or\n practice for urgent support and \nguidance.',
    },
    {
      modalImg: Images.medView,
      modalHeading: 'Report Drug-Related\nConcerns',

      modalText:
        'Notify the manufacturer about issues or \nconcerns with a pharmaceutical product.',
    },
  ];

  const wellnessSummaryList = [
    {
      id: 1,
      title: `⏲️\nBody Weight`,
      subTitle: '28lbs',
      status: 'Normal',
      screen: '',
    },
    {
      id: 2,
      title: `🎾\nExercise`,
      subTitle: 'Moderate',
      status: '',
      screen: '',
    },
    {
      id: 3,
      title: `🍗\nFood Intake`,
      subTitle: 'Overeating',
      status: '',
      screen: '',
    },
    {
      id: 4,
      title: `💧\nWater Intake`,
      subTitle: 'Low',
      status: '',
      screen: '',
    },
  ];

  const quickActions = [
    {
      id: 1,
      title: t('parasite_management_string'),
      img: Images.Parasite,
      screen: 'ParasiticideManagementHome',
    },
    {
      id: 2,
      title: t('vaccination_management_string'),
      img: Images.Inj,
      screen: 'VaccineManagementHome',
    },
    {
      id: 3,
      title: t('pain_management_string'),
      img: Images.Bone,
      screen: 'PainManagementHome',
    },
    {
      id: 4,
      title: t('book_an_appointment'),
      img: Images.Kit,
      screen: 'BookAppointmentHome',
    },
    {
      id: 5,
      title: t('medical_records_string'),
      img: Images.MedicalRecord,
      screen: 'MedicalRecordHome',
    },
    {
      id: 6,
      title: t('share_pet_duties_string'),
      img: Images.ShareDuty,
      screen: 'SharePetDutiesHome',
    },
    {
      id: 7,
      title: t('diabetes_management_string'),
      img: Images.dropperMinimalistic,
      screen: 'DiabetesManagement',
    },
    {
      id: 8,
      title: t('blog_string'),
      img: Images.bookMinimalistic,
      screen: 'BlogListing',
    },
  ];

  const renderPetItem = ({item}) => {
    const isSelected = selectPet?.id === item?.id;

    return (
      <TouchableOpacity
        style={styles.petItemContainer}
        onPress={() => handlePetSelection(item)}
        activeOpacity={0.7}>
        <GImage
          image={item?.petImages}
          style={styles.petImage(isSelected)}
          noImageSource={Images.Kizi}
        />
        <GText SatoshiBold text={item?.name} style={styles.petNameText} />
        <View style={styles.petUnderline(isSelected)} />
      </TouchableOpacity>
    );
  };

  const renderQuickActionItem = ({item}) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('StackScreens', {screen: item.screen})}
      style={styles.quickActionItem}
      activeOpacity={0.8}>
      <View style={styles.quickActionImageView}>
        <Image source={item.img} style={styles.quickActionImage} />
      </View>
      <GText GrMedium text={item.title} style={styles.quickActionText} />
    </TouchableOpacity>
  );
  const renderItem = ({item}) => {
    return (
      <TouchableOpacity
        onPress={() => {
          setVisible(false);
          navigation?.navigate('StackScreens', {
            screen: 'ContactVet',
          });
        }}
        style={styles.modalFlatlistMain}>
        <View style={styles.imgView}>
          <Image style={styles.modalImg} source={item.modalImg} />
        </View>

        <View style={styles.textView}>
          <GText
            GrMedium
            text={item.modalHeading}
            style={styles.modalHeading}
          />
          <GText SatoshiMedium text={item.modalText} style={styles.modalText} />
        </View>
      </TouchableOpacity>
    );
  };
  const renderWellnessSummaryItem = ({item}) => (
    <View style={styles.wellnessSummaryItemView} activeOpacity={0.5}>
      <GText GrMedium text={item.title} style={styles.wellnessSummaryTitle} />
      <View style={{marginBottom: scaledValue(30)}}>
        <HalfCircleProgress
          percent={70}
          subTitle={item.subTitle}
          status={item.status}
        />
        <View style={styles.statusView}>
          <GText GrMedium style={styles.subTitleText} text={item.subTitle} />
          {item.status && (
            <GText
              SatoshiRegular
              text={item.status}
              style={styles.graphStatusText}
            />
          )}
        </View>
      </View>
    </View>
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
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        {/* <TouchableOpacity style={styles.searchTouchable}>
          <GText
            text={t('search_hos_doc_pms_string')}
            style={styles.searchText}
          />
          <Image source={Images.Search} style={styles.solarWalledImage} />
        </TouchableOpacity> */}
        {/* {petList?.length < 1 && (
          <>
            <GText
              GrMedium
              text={'Welcome to your companions’s'}
              style={styles.welcomeTitle}
            />
            <GText
              GrMedium
              text={'new favorite place!'}
              style={styles.welcomeSubtitle}
            />
            <Image
              source={Images.DashboardWelcome}
              style={styles.welcomeImage}
            />
          </>
        )} */}

        <GText GrMedium text="Your Companions" style={styles.petsText} />
        {petList?.length > 0 ? (
          <>
            <View style={styles.petListContainer}>
              <View>
                <FlatList
                  showsHorizontalScrollIndicator={false}
                  data={petList}
                  horizontal
                  contentContainerStyle={styles.petList}
                  renderItem={renderPetItem}
                />
              </View>
            </View>
          </>
        ) : (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('StackScreens', {screen: 'ChooseYourPet'})
            }
            activeOpacity={0.8}
            style={styles.addCompanionTouchable}>
            <View style={styles.addCompanionImageContainer}>
              <Image
                source={Images.solarCircle}
                style={styles.solarCircleImage}
              />
              <Image source={Images.PawImage} style={styles.pawImage} />
            </View>
            <GText
              GrMedium
              text={'Add your First Companion'}
              style={styles.addCompanionText}
            />
          </TouchableOpacity>
        )}

        {upComingAppointmentsList?.length === 0 && (
          <>
            <GText
              GrMedium
              text={'Upcoming Appointments'}
              style={styles.upcomingHeading}
            />
            <View style={styles.noUpcomingContainer}>
              <GText
                GrMedium
                text={'No upcoming Appointments yet.'}
                style={styles.noUpcomingText}
              />
              <GText
                SatoshiRegular
                text={'Add a companion to start\nmanaging their health.'}
                style={styles.noUpcomingSubText}
              />
            </View>
          </>
        )}

        {/* <GText
          GrMedium
          text={'Upcoming Assessments'}
          style={styles.assessmentHeading}
        />
        <View style={styles.noAssessmentContainer}>
          <GText
            GrMedium
            text={'No upcoming Assessments yet.'}
            style={styles.noAssessmentText}
          />
          <GText
            SatoshiRegular
            text={'Add a companion to start managing their health.'}
            style={styles.noAssessmentSubText}
          />
        </View> */}
        {upComingAppointmentsList?.length > 0 && (
          <>
            <View style={styles.headerView}>
              <GText
                GrMedium
                text={`${t('upcoming_appointment_string')} `}
                style={styles.teamText}
              />
              <GText
                GrMedium
                text={`(${upComingAppointmentsList?.length})`}
                style={styles.countText}
              />
            </View>

            <FlatList
              data={upComingAppointmentsList} // Add real data here for confirmed appointments
              contentContainerStyle={{
                gap: scaledValue(20),
                marginBottom: scaledValue(5),
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
                      key={index}
                      petImage={item?.pet?.image}
                      imageSource={item?.vet?.image}
                      doctorName={item?.vet?.name}
                      department={item?.vet?.specialization}
                      qualifications={item?.vet?.qualification}
                      hospitalName={item?.location}
                      appointmentTime={formatted}
                      navigation={navigation}
                      confirmed
                      dashBoard
                      dashBoardCancelOnPress={() => {
                        cancelAppointment(item?.id);
                      }}
                      dashBoardRescheduleOnPress={() => {
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
                      swiperCardStyle={styles.swiperCardStyle}
                      doctorNameTextStyle={{color: colors.jetBlack}}
                      departmentTextStyle={{color: colors.jetBlack}}
                      buttonStyle={{
                        backgroundColor: colors.jetBlack50,
                        gap: scaledValue(6),
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      buttonIconStyle={{tintColor: colors.jetBlack, opacity: 1}}
                    />
                  </View>
                );
              }}
            />

            {/* <Swiper
              height={
                upComingAppointmentsList?.length > 1
                  ? scaledValue(359)
                  : scaledValue(300)
              }
              ref={swiperRef}
              loop={false}
              // style={{backgroundColor: 'red'}}
              bounces={false}
              onIndexChanged={index => setScrollIndex(index)}
              activeDotColor={colors.appRed}
              dotColor={colors.appRed}
              activeDotStyle={styles.activeDotStyle}
              dotStyle={styles.dotStyle}
              paginationStyle={styles.swiperPaginationStyle}>
              {upComingAppointmentsList.map((item, index) => {
                const combinedDate = `${item?.date} ${item?.time}`;
                const formatted = moment(
                  combinedDate,
                  'YYYY-MM-DD h:mm A',
                ).format('dddd, DD MMM - hh:mm A');
                return (
                  <View key={index}>
                    <AppointmentCard
                      key={index}
                      petImage={item?.pet?.image}
                      imageSource={item?.vet?.image}
                      doctorName={item?.vet?.name}
                      department={item?.vet?.specialization}
                      qualifications={item?.vet?.qualification}
                      hospitalName={item?.location}
                      appointmentTime={formatted}
                      navigation={navigation}
                      confirmed
                      dashBoard
                      swiperCardStyle={styles.swiperCardStyle}
                      doctorNameTextStyle={{color: colors.jetBlack}}
                      departmentTextStyle={{color: colors.jetBlack}}
                      buttonStyle={{
                        backgroundColor: colors.jetBlack50,
                        gap: scaledValue(6),
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      buttonIconStyle={{tintColor: colors.jetBlack, opacity: 1}}
                    />
                  </View>
                );
              })}
            </Swiper> */}
          </>
        )}

        {/* <View style={styles.vaccinationStatusMainView}>
          <View style={styles.statusCardView1}>
            <View style={styles.syringeBoldImageView}>
              <Image
                source={Images.syringe_bold}
                style={styles.syringeBoldImage}
              />
            </View>
            <View style={{flex: 1, marginLeft: scaledValue(7)}}>
              <GText
                GrMedium
                text={'Vaccination'}
                style={styles.vaccinationText}
              />
              <GText
                GrMedium
                text={'Status'}
                style={styles.vaccinationStatusText}
              />
            </View>
            <View style={styles.upToDateView}>
              <Image
                tintColor={colors.jetBlack}
                source={Images.CircleCheck}
                style={styles.circleCheckImage}
              />
              <GText
                SatoshiBold
                text={'Up-to-date'}
                style={styles.upToDateText}
              />
            </View>
          </View>
        </View> */}
        {/* <View style={styles.yearlySummaryMainView}>
          <View style={styles.statusCardView2}>
            <View style={styles.statusCardImageView}>
              <Image
                source={Images.solar_wallet}
                style={styles.solarWalledImage}
              />
            </View>
            <View style={{marginLeft: scaledValue(12)}}>
              <GText
                SatoshiBold
                text={'Yearly Spend Summary'}
                style={styles.yearlySummaryText}
              />
              <GText
                GrMedium
                text={'$2,487'}
                style={styles.statusCardSubText}
              />
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              navigation?.navigate('StackScreens', {
                screen: 'YearlySpendScreen',
              });
            }}
            style={styles.imageView}>
            <Image style={styles.editIconImage} source={Images.Edit} />
          </TouchableOpacity>
        </View> */}
        {/* <GText
          SatoshiBold
          text={t('wellness_summary_string')}
          style={styles.wellnessSummaryText}
        />
        <FlatList
          data={wellnessSummaryList}
          numColumns={2}
          columnWrapperStyle={styles.wellnessSummaryWrapper}
          contentContainerStyle={styles.wellnessSummaryList}
          renderItem={renderWellnessSummaryItem}
        /> */}
        {petList?.length > 0 && (
          <FlatList
            data={quickActions}
            numColumns={3}
            style={{marginTop: scaledValue(15)}}
            columnWrapperStyle={styles.quickActionsWrapper}
            contentContainerStyle={styles.quickActionsList}
            renderItem={renderQuickActionItem}
            ListHeaderComponent={() => {
              return (
                <GText
                  GrMedium
                  text={t('quick_actions_string')}
                  style={styles.quickAcitonTitleText}
                />
              );
            }}
          />
        )}

        <Modal
          isVisible={visible}
          statusBarTranslucent={true}
          onBackdropPress={() => setVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalInnerContainer}>
              <View style={styles.imageContainer}>
                <TouchableOpacity
                  style={{
                    alignSelf: 'flex-end',
                    position: 'absolute',
                    top: scaledValue(10),
                    right: scaledValue(10),
                  }}>
                  <Image style={styles.crossIcon} source={Images.crossIcon} />
                </TouchableOpacity>
                <Image style={styles.dogImage} source={Images.noPet} />
              </View>
              <View style={styles.modalContentContainer}>
                <GText
                  GrMedium
                  text={t('emergency_desc_string')}
                  style={styles.mainHeading}
                />

                <GText
                  text={t('choose_an_option_string')}
                  style={styles.Subheading}
                />

                <FlatList
                  data={modalData}
                  renderItem={renderItem}
                  contentContainerStyle={styles.modalListContent}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
};

export default Dashboard;
