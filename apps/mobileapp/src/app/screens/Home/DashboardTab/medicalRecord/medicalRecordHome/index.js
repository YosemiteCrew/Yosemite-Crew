import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect} from 'react';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {useTranslation} from 'react-i18next';
import GButton from '../../../../../components/GButton';

const MedicalRecordHome = ({navigation}) => {
  const {t} = useTranslation();

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
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const filesArray = [
    {title: t('passport_string'), subtitle: '1 file', img: Images.Passport},
    {
      title: t('certificates_string'),
      subtitle: '8 files',
      img: Images.Certificates,
    },
    {title: t('vet_visits_string'), subtitle: '15 files', img: Images.VetVisit},
    {title: t('invoices_string'), subtitle: '24 files', img: Images.Invoice},
    {title: t('lab_tests_string'), subtitle: '4 files', img: Images.LabTest},
    {title: t('pedigree_string'), subtitle: '1 file', img: Images.Pedigree},
    {
      title: t('prescriptions_string'),
      subtitle: '7 files',
      img: Images.PrescriptionImg,
    },
    {title: t('insurance_string'), subtitle: '2 files', img: Images.Insurance},
    {title: t('others_string'), subtitle: '4 files', img: Images.Others},
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView>
        <SearchBar t={t} />
        <View style={styles.fileListContainer}>
          <FlatList
            data={filesArray}
            contentContainerStyle={styles.fileListContentContainer}
            renderItem={({item}) => <FileItem item={item} />}
          />
        </View>
        <GButton
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'AddNewDocument',
            });
          }}
          icon={Images.PlusIcon}
          iconStyle={styles.buttonIcon}
          title={t('add_new_record_string')}
          textStyle={styles.buttonText}
          style={styles.button}
        />
      </ScrollView>
    </View>
  );
};

const SearchBar = ({t}) => (
  <TouchableOpacity style={styles.searchBarContainer}>
    <GText
      SatoshiRegular
      text={t('search_through_records_string')}
      style={styles.searchBarText}
    />
    <Image source={Images.Search} style={styles.searchBarIcon} />
  </TouchableOpacity>
);

const FileItem = ({item}) => (
  <TouchableOpacity style={styles.fileItemContainer}>
    <Image source={item?.img} style={styles.fileItemImage} />
    <View style={styles.fileItemTextContainer}>
      <GText GrMedium text={item?.title} style={styles.fileItemTitle} />
      <GText
        SatoshiBold
        text={item?.subtitle}
        style={styles.fileItemSubtitle}
      />
    </View>
  </TouchableOpacity>
);
export default MedicalRecordHome;
