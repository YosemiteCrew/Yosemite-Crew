import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  Text,
  View,
} from 'react-native';
import GText from '../../../../components/GText/GText';
import {Images} from '../../../../utils';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import {scaledValue} from '../../../../utils/design.utils';
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

const Dashboard = ({navigation}) => {
  const {t} = useTranslation();
  const swiperRef = useRef();
  const [selectPet, setSelectPet] = useState({});
  const userData = useAppSelector(state => state.auth.user);

  const dispatch = useAppDispatch();
  const getPetList = useAppSelector(state => state.pets?.petLists);
  const petList = useAppSelector(state => state.pets?.petLists);

  useEffect(() => {
    dispatch(
      get_pet_list({
        offset: 0,
        limit: 10,
      }),
    );
  }, []);

  const [scrollIndex, setScrollIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const handlePetSelection = pet => {
    if (selectPet?._id === pet._id) {
      setSelectPet(null);
    } else {
      setSelectPet(pet);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingRight: scaledValue(20),
          }}>
          <TouchableOpacity onPress={() => setVisible(true)}>
            <Image
              source={Images.Emergency}
              style={{
                width: scaledValue(24),
                height: scaledValue(24),
                marginRight: scaledValue(6),
              }}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerRight}
            onPress={() =>
              navigation.navigate('StackScreens', {screen: 'Notifications'})
            }>
            <Image source={Images.bellBold} style={styles.headerIcon} />
          </TouchableOpacity>
        </View>
      ),
      headerLeft: () => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: scaledValue(20),
          }}>
          <Image
            source={Images.User}
            style={{
              width: scaledValue(40),
              height: scaledValue(40),
              borderRadius: scaledValue(40),
            }}
          />
          <GText
            GrMedium
            componentProps={{numberOfLines: 1, ellipsizeMode: 'tail'}}
            text={`Henlo, ${userData?.firstName}`}
            style={styles.greetingText}
          />
        </View>
      ),
    });
  }, [navigation]);

  // const petList = [
  //   {id: 1, name: 'Kizie', img: Images.Kizi},
  //   {id: 2, name: 'Oscar', img: Images.CatImg},
  // ];

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

  const renderPetItem = ({item}) => (
    <TouchableOpacity
      onPress={() => handlePetSelection(item)}
      style={{opacity: selectPet?._id === item._id ? 0.4 : 1}}>
      <Image source={Images.Kizi} style={styles.petImage} />
      <GText SatoshiBold text={item.petName} style={styles.petNameText} />
    </TouchableOpacity>
  );

  const renderQuickActionItem = ({item}) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('StackScreens', {screen: item.screen})}
      style={styles.quickActionItem}
      activeOpacity={0.5}>
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
          // setTimeout(() => {
          navigation?.navigate('StackScreens', {
            screen: 'ContactVet',
          });
          // }, 200);
        }}
        style={styles.modalFlatlistMain}>
        <View style={styles.imgView}>
          <Image style={styles.modalImg} source={item.modalImg} />
        </View>

        <View style={styles.textView}>
          <Text style={styles.modalHeading}>{item.modalHeading}</Text>
          <Text style={styles.modalText}>{item.modalText}</Text>
        </View>
      </TouchableOpacity>
    );
  };
  const renderWellnessSummaryItem = ({item}) => (
    <View style={styles.wellnessSummaryItemView} activeOpacity={0.5}>
      <GText GrMedium text={item.title} style={styles.wellnessSummaryTitle} />
      <HalfCircleProgress subTitle={item.subTitle} status={item.status} />
      <View style={styles.statusView}>
        <GText GrMedium style={styles.subTitleText} text={item.subTitle} />
        <GText
          SatoshiRegular
          text={item.status}
          style={styles.graphStatusText}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        <GText GrMedium text="Your Companions" style={styles.petsText} />

        <View style={styles.petListContainer}>
          <View>
            <FlatList
              data={petList}
              horizontal
              contentContainerStyle={styles.petList}
              renderItem={renderPetItem}
            />
          </View>
        </View>
        <View style={styles.yearlySummaryMainView}>
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
            <Image
              style={{
                height: scaledValue(20),
                width: scaledValue(20),
                marginRight: scaledValue(20),
              }}
              source={Images.Edit}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.vaccinationStatusMainView}>
          <View style={styles.statusCardView1}>
            <View style={styles.syringeBoldImageView}>
              <Image
                source={Images.syringe_bold}
                style={styles.syringeBoldImage}
              />
            </View>
            <View style={{marginLeft: scaledValue(12), flex: 1}}>
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
                tintColor={colors.darkPurple}
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
        </View>
        <View style={styles.headerView}>
          <GText
            GrMedium
            text={`${t('upcoming_appointment_string')} `}
            style={styles.teamText}
          />
          <GText GrMedium text={'(2)'} style={styles.countText} />
        </View>

        <Swiper
          height={430}
          ref={swiperRef}
          loop={false}
          bounces={false}
          containerStyle={{
            height: scaledValue(234),
          }}
          onIndexChanged={index => setScrollIndex(index)}
          activeDotColor={colors.appRed}
          dotColor={colors.appRed}
          activeDotStyle={styles.activeDotStyle}
          dotStyle={styles.dotStyle}
          paginationStyle={{
            bottom: 0,
            marginBottom: 0,
          }}>
          {[1, 2].map((page, index) => (
            <View key={index}>
              <AppointmentCard
                key={index}
                imageSource={Images.DoctorImg}
                doctorName="Dr. Emily Johnson"
                department="Cardiology"
                qualifications="San Francisco Animal Medical Center"
                appointmentTime="Thursday, 5 Sept - 11:00 AM"
                navigation={navigation}
                swiperCardStyle={styles.swiperCardStyle}
                doctorNameTextStyle={{color: colors.jetBlack}}
                departmentTextStyle={{color: colors.jetBlack}}
                buttonStyle={{backgroundColor: colors.lightCream}}
                buttonTextStyle={{color: colors.jetBlack}}
                buttonIconStyle={{tintColor: colors.jetBlack, opacity: 1}}
              />
            </View>
          ))}
        </Swiper>
        <GText
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
        />

        <FlatList
          data={quickActions}
          numColumns={3}
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
        <Modal
          isVisible={visible}
          statusBarTranslucent={true}
          onBackdropPress={() => setVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalInnerContainer}>
              <View style={styles.imageContainer}>
                <Image style={styles.crossIcon} source={Images.crossIcon} />
                <Image style={styles.dogImage} source={Images.petImage} />
              </View>
              <View style={styles.modalContentContainer}>
                <Text style={styles.mainHeading}>
                  Is this an{' '}
                  <Text style={styles.emergencyText}>Emergency?</Text>
                </Text>
                {/* <GText
                  text=
                  style={styles.subHeading}
                /> */}
                <Text style={styles.Subheading}>
                  {
                    'Choose an option, and we’ll help you take the next steps for your pet.'
                  }
                </Text>
                <FlatList
                  data={modalData}
                  renderItem={renderItem}
                  contentContainerStyle={{gap: 12}}
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
