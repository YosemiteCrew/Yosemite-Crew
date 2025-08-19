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
import {parseOrganizations} from '../../../../../helpers/parseOrganizationData';

const BookAppointmentHome = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const [selectedOption, setSelectedOption] = useState(t('all_string'));
  const [businessType, setBusinessType] = useState('all');
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

  const [petSitterData, setPetSitterData] = useState({
    petSitterList: [],
    petSitterCount: '',
  });

  useEffect(() => {
    getHospitalsCentersList();
  }, [businessType]);

  const getHospitalsCentersList = () => {
    let api_credentials = {
      type: businessType,
      limit: 10,
      offset: 0,
    };
    dispatch(hospitals_centers_list(api_credentials)).then(res => {
      if (hospitals_centers_list.fulfilled.match(res)) {
        setHospitalData({
          hospitalList: parseOrganizations(
            res.payload?.data?.veterinaryBusiness?.entry,
          ),
          hospitalCount: res.payload?.data?.veterinaryBusiness?.total,
        });
        setBreederData({
          breederList: parseOrganizations(
            res.payload?.data?.breedingFacility?.entry,
          ),
          breederCount: res.payload?.data?.breedingFacility?.total,
        });
        setGroomerData({
          groomerList: parseOrganizations(
            res.payload?.data?.groomerShop?.entry,
          ),
          groomerCount: res.payload?.data?.groomerShop?.total,
        });
        setPetSitterData({
          petSitterList: parseOrganizations(res.payload.data?.petSitter?.entry),
          petSitterCount: res.payload.data?.petSitter?.total,
        });
      }
    });
  };

  const options = [
    {id: 1, title: t('all_string'), value: 'all'},
    {id: 2, title: t('hospitals_string'), value: 'Hospital'},
    {id: 3, title: t('breeders_string'), value: 'Breeding Facility'},
    {id: 4, title: t('groomers_string'), value: 'Groomer Shop'},
    {id: 5, title: t('pet_centers_string'), value: 'Clinic'},
    {id: 6, title: t('pet_sitter_string'), value: 'Pet Sitter'},
  ];

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
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
          tintColor={colors.jetBlack}
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
      onPress={() => {
        setSelectedOption(item.title);
        setBusinessType(item?.value);
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
        {hospitalData?.hospitalList?.length > 0 && (
          <CategoryList
            navigation={navigation}
            data={hospitalData?.hospitalList}
            type={'hospital'}
            total_count={hospitalData?.hospitalCount}
            categoryTitle={t('hospitals_string')}
            nearYouText={t('near_you_string')}
          />
        )}

        {breederData?.breederList?.length > 0 && (
          <CategoryList
            navigation={navigation}
            total_count={breederData?.breederCount}
            data={breederData?.breederList}
            categoryTitle={t('breeders_string')}
            nearYouText={t('near_you_string')}
          />
        )}
        {groomerData?.groomerList?.length > 0 && (
          <CategoryList
            navigation={navigation}
            total_count={groomerData?.groomerCount}
            data={groomerData?.groomerList}
            categoryTitle={t('groomers_string')}
            nearYouText={t('near_you_string')}
          />
        )}

        {petSitterData?.petSitterList?.length > 0 && (
          <CategoryList
            navigation={navigation}
            total_count={petSitterData?.petSitterCount}
            data={petSitterData?.petSitterList}
            categoryTitle={t('pet_sitter_string')}
            nearYouText={t('near_you_string')}
          />
        )}
      </ScrollView>
    </View>
  );
};

export default BookAppointmentHome;
