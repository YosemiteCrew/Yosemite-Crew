import React, {useEffect, useState} from 'react';
import {ScrollView, View, Image, TouchableOpacity} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import HeaderButton from '../../../../../components/HeaderButton';
import GText from '../../../../../components/GText/GText';
import {styles} from './styles';
import CategoryList from './CategoryList';
import {scaledValue} from '../../../../../utils/design.utils';
import {useAppDispatch} from '../../../../../redux/store/storeUtils';
import {hospitals_centers_list} from '../../../../../redux/slices/appointmentSlice';
import {BusinessListShimmer} from '../../../../../components/Shimmers/Shimmers';

const BookAppointmentHome = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const [selectedOption, setSelectedOption] = useState(t('all_string'));
  const [hospitalData, setHospitalData] = useState({
    hospitalList: [],
    hospitalCount: '',
  });
  const [breederData, setBreederData] = useState({
    breederList: [],
    breederCount: '',
  });

  const [groomerData, setGroomerData] = useState({
    groomerList: [],
    groomerCount: '',
  });

  const [petCenterData, setPetCenterData] = useState({
    petCenterList: [],
    petCenterCount: '',
  });

  useEffect(() => {
    getHospitalsCentersList();
  }, []);

  const getHospitalsCentersList = () => {
    let api_credentials = {
      offset: 0,
      limit: 5,
    };
    dispatch(hospitals_centers_list(api_credentials)).then(res => {
      if (hospitals_centers_list.fulfilled.match(res)) {
        setHospitalData({
          hospitalList: res.payload?.hospital?.data,
          hospitalCount: res.payload?.hospital?.count,
        });
        setBreederData({
          breederList: res.payload?.breederShop?.data,
          breederCount: res.payload?.breederShop?.count,
        });
        setPetCenterData({
          petCenterList: res.payload?.clinic?.data,
          petCenterCount: res.payload?.clinic?.count,
        });
        setGroomerData({
          groomerList: res.payload?.groomerShop?.data,
          groomerCount: res.payload?.groomerShop?.count,
        });
      }
    });
  };

  const options = [
    {id: 1, title: t('all_string')},
    {id: 2, title: t('hospitals_string')},
    {id: 3, title: t('breeders_string')},
    {id: 4, title: t('groomers_string')},
    {id: 5, title: t('pet_centers_string')},
  ];

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
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

  const SearchBar = () => {
    return (
      <TouchableOpacity style={styles.searchBar}>
        <View style={styles.searchTextContainer}>
          <GText
            SatoshiRegular
            text={t('search_for_string')}
            style={styles.searchText}
          />
          <GText
            SatoshiBold
            text={` ${t('hospitals_string')}`}
            style={styles.hospitalText}
          />
        </View>
        <Image source={Images.Search} style={styles.searchIcon} />
      </TouchableOpacity>
    );
  };

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

  // const hospitalList = [
  //   {
  //     id: 1,
  //     img: Images.Hospital1,
  //     name: 'San Francisco Animal Medical Center',
  //     time: 'Open 24 Hours',
  //     description:
  //       '24/7 Emergency Care, Surgery and Operating Rooms, Veterinary ICU, Diagnostic Imaging, Laboratory, Dental Care Services,',
  //     distance: '2.5mi',
  //     rating: '4.1',
  //   },
  //   {
  //     id: 2,
  //     img: Images.Hospital2,
  //     name: 'OakVet Animal Specialty Hospital',
  //     time: 'Open 24 Hours',
  //     description:
  //       'Vaccination and Preventive Care, Pain Management, Physical Rehabilitation and Therapy, Isolation Wards for Contagious Pets, Oncology Treatment,',
  //     distance: '2.8mi',
  //     rating: '4.5',
  //   },
  // ];

  const breederList = [
    {
      id: 1,
      img: Images.Breeder1,
      name: 'Bay Area Corgis',
      time: 'Open 24 Hours',
      description:
        'Health Screening, Puppy Socialization, Birthing Assistance, Registration and Documentation, Temperature-Controlled Housing, Post-Adoption Support',
      distance: '2.5mi',
      rating: '4.1',
    },
    {
      id: 2,
      img: Images.Breeder2,
      name: 'Bay Area Puppies',
      time: '9AM - 5PM (Mon-Sat)',
      description:
        'Genetic Testing, Vaccination and Deworming, Early Training Programs, Puppy Care Packages, Breed-Specific Care, Grooming Services',
      distance: '2.8mi',
      rating: '4.5',
    },
  ];

  const groomerList = [
    {
      id: 1,
      img: Images.Groomer1,
      name: 'Tender Loving Care Pet Grooming',
      time: '8AM - 7PM (Mon - Fri)',
      description:
        'Bathing, Hair Trimming, Ear Cleaning, Skin Conditioning, Paw Pad Care, Specialty Shampoos, Eye Cleaning',
      distance: '2.5mi',
      rating: '4.1',
    },
    {
      id: 2,
      img: Images.Groomer2,
      name: 'Posh Paws Pet Salon',
      time: '9AM - 5PM (Mon-Sat)',
      description:
        'Nail Clipping, Teeth Brushing, Flea and Tick Treatment, Coat Styling, De-shedding, Anal Gland Expression',
      distance: '2.8mi',
      rating: '4.5',
    },
  ];

  const petCenterList = [
    {
      id: 1,
      img: Images.PetCenter1,
      name: 'Pet Club Cupertino',
      time: '8AM - 7PM (Mon - Fri)',
      description:
        'Pet Food and Treats, Grooming Supplies, Leashes and Collars, Boarding Services, Veterinary Care, Obedience Training, Playgroups',
      distance: '2.5mi',
      rating: '4.1',
    },
    {
      id: 2,
      img: Images.PetCenter2,
      name: 'Red Hill Pet Center',
      time: '11AM - 6PM (Mon-Sat)',
      description:
        'Toys and Accessories, Pet Clothing, Bedding and Crates, Grooming Salon, Daycare, Training Equipment',
      distance: '2.8mi',
      rating: '4.5',
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom,
        }}>
        <SearchBar />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}>
          <View style={styles.optionContainer}>
            {options.map(renderOption)}
          </View>
        </ScrollView>
        {/* Render different category lists */}
        {/* <BusinessListShimmer /> */}
        <CategoryList
          navigation={navigation}
          data={hospitalData?.hospitalList}
          total_count={hospitalData?.hospitalCount}
          categoryTitle={t('hospitals_string')}
          nearYouText={t('near_you_string')}
        />
        <CategoryList
          navigation={navigation}
          total_count={breederData?.breederCount}
          data={breederData?.breederList}
          categoryTitle={t('breeders_string')}
          nearYouText={t('near_you_string')}
        />
        <CategoryList
          navigation={navigation}
          total_count={groomerData?.groomerCount}
          data={groomerData?.groomerList}
          categoryTitle={t('groomers_string')}
          nearYouText={t('near_you_string')}
        />
        <CategoryList
          navigation={navigation}
          total_count={petCenterData?.petCenterCount}
          data={petCenterData?.petCenterList}
          categoryTitle={t('pet_centers_string')}
          nearYouText={t('near_you_string')}
        />
      </ScrollView>
    </View>
  );
};

export default BookAppointmentHome;
