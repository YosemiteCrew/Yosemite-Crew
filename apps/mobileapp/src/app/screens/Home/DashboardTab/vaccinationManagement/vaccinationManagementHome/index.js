import React, {useEffect} from 'react';
import {
  View,
  ScrollView,
  Image,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import HeaderButton from '../../../../../components/HeaderButton';

const VaccineManagementHome = ({navigation}) => {
  const {t} = useTranslation();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() =>
            navigation.navigate('StackScreens', {screen: 'Notifications'})
          }
        />
      ),
    });
  }, [navigation]);

  const petList = [
    {id: 1, name: 'Kizie', img: Images.Kizi, status: 'Up-to-date'},
    {id: 2, name: 'Oscar', img: Images.CatImg, status: 'Upcoming'},
  ];

  const quickAction = [
    {
      id: 1,
      title: t('add_new_record_string'),
      img: Images.Parasite,
      onAction: () => {
        navigation.navigate('StackScreens', {screen: 'AddVaccineRecord'});
      },
    },
    {
      id: 2,
      title: t('vaccine_records_string'),
      img: Images.Inj,
      onAction: () => {
        navigation.navigate('StackScreens', {screen: 'VaccineRecords'});
      },
    },
  ];

  const recentVaccinationList = [
    {
      id: 1,
      title: 'Bordetella Bronchiseptica',
      date: '2 August, 2024',
      img: Images.Kizi,
    },
    {id: 2, title: 'Calicivirus', date: '10 July, 2024', img: Images.CatImg},
    {
      id: 3,
      title: 'Parainfluenza virus',
      date: '15 June, 2024',
      img: Images.Kizi,
    },
    {id: 4, title: 'Chlamydia', date: '28 May, 2024', img: Images.CatImg},
  ];

  const RenderPetItem = ({item}) => (
    <View style={styles.petItem}>
      <Image source={item.img} style={styles.petImage} />
      <GText SatoshiBold text={item?.name} style={styles.petNameText} />
      {item?.status === 'Up-to-date' ? (
        <View style={styles.healthyStatus}>
          <Image
            tintColor={colors.white}
            source={Images.CircleCheck}
            style={styles.statusIcon}
          />
          <GText SatoshiBold text={item?.status} style={styles.statusText} />
        </View>
      ) : (
        <View style={styles.riskStatus}>
          <Image source={Images.Risk} style={styles.statusIcon} />
          <GText SatoshiBold text={item?.status} style={styles.statusText} />
        </View>
      )}
    </View>
  );

  const RenderRecentVaccinationItem = ({item}) => (
    <>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('StackScreens', {screen: 'EditVaccineRecord'})
        }
        style={styles.optionView}>
        <View style={styles.imgTitleView}>
          <Image source={item?.img} style={styles.imgStyle} />
          <View>
            <GText GrMedium text={item?.title} style={styles.titleStyle} />
            <GText SatoshiBold text={item?.date} style={styles.dateStyle} />
          </View>
        </View>
        <Image source={Images.RightArrow} style={styles.arrowImg} />
      </TouchableOpacity>
      {item.id !==
      recentVaccinationList[recentVaccinationList.length - 1].id ? (
        <View style={styles.divider} />
      ) : (
        <View style={styles.dividerSpacing} />
      )}
    </>
  );

  const quickActions = item => (
    <TouchableOpacity
      key={item.id}
      onPress={item.onAction}
      style={styles.quickActionItem}
      activeOpacity={0.5}>
      <Image source={item.img} style={styles.quickActionImage} />
      <GText GrMedium text={item.title} style={styles.quickActionText} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <Image source={Images.Shield} style={styles.shieldImage} />
          <View style={styles.upcomingVaccinationContainer}>
            <GText
              GrMedium
              text={t('upcoming_vaccination_string')}
              style={styles.upcomingVaccinationText}
            />
            <GText
              SatoshiBold
              text={t('due_on_string')}
              style={styles.dueOnText}
            />
          </View>
        </View>
        <GText
          GrMedium
          text={t('vaccination_status_string')}
          style={styles.vaccinationStatusText}
        />
        <View style={styles.petListContainer}>
          <FlatList
            data={petList}
            horizontal
            contentContainerStyle={styles.petList}
            renderItem={({item}) => <RenderPetItem item={item} />}
            keyExtractor={item => item.id.toString()}
          />
        </View>
        <GText
          SatoshiBold
          text={t('quick_actions_string')}
          style={styles.quickActionsText}
        />
        <View style={styles.quickActionsContainer}>
          {quickAction.map(item => quickActions(item))}
        </View>
        <GText
          SatoshiBold
          text={t('recent_vaccinations_string')}
          style={styles.quickActionsText}
        />
        <View style={styles.recentVaccinationsContainer}>
          <FlatList
            data={recentVaccinationList}
            renderItem={({item}) => <RenderRecentVaccinationItem item={item} />}
            keyExtractor={item => item.id.toString()}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default VaccineManagementHome;
