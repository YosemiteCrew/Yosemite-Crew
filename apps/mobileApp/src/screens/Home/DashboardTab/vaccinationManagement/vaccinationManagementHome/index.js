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
import {useAppSelector} from '../../../../../redux/store/storeUtils';
import GImage from '../../../../../components/GImage';
import useDataFactory from '../../../../../components/UseDataFactory/useDataFactory';
import {formatCompleteDateDMY} from '../../../../../utils/constants';
import {transformImmunizations} from '../../../../../helpers/transformImmunizations';

const VaccineManagementHome = ({navigation}) => {
  const {t} = useTranslation();
  const petList = useAppSelector(state => state.pets?.petLists);

  const {
    loading,
    data,
    setData,
    extraData,
    refreshData,
    loadMore,
    Placeholder,
    Loader,
  } = useDataFactory(
    'getRecentVaccinationRecord',
    true,
    {
      limit: 10,
    },
    'GET',
  );

  const recentVaccinationList = transformImmunizations(data, {
    useFhirId: true,
  });

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

  const RenderPetItem = ({item}) => {
    const petDetails = item?.resource?.extension?.reduce((acc, item) => {
      acc[item.title] = item.valueString;
      return acc;
    }, {});

    return (
      <View style={styles.petItem}>
        <GImage
          image={petDetails?.petImage?.url}
          style={styles.petImage}
          noImageSource={Images.Kizi}
        />

        <GText
          SatoshiBold
          text={item?.resource?.name[0]?.text}
          style={styles.petNameText}
        />
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
  };

  const RenderRecentVaccinationItem = ({item}) => {
    return (
      <>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('StackScreens', {
              screen: 'EditVaccineRecord',
              params: {
                itemRecordDetails: item,
                setData,
              },
            })
          }
          style={styles.optionView}>
          <View style={styles.imgTitleView}>
            <Image source={item?.img} style={styles.imgStyle} />
            <View>
              <GText
                GrMedium
                text={item?.manufacturer}
                style={styles.titleStyle}
              />
              <GText
                SatoshiBold
                text={formatCompleteDateDMY(item?.date)}
                style={styles.dateStyle}
              />
            </View>
          </View>
          <Image source={Images.RightArrow} style={styles.arrowImg} />
        </TouchableOpacity>
        {item.id !==
        recentVaccinationList[recentVaccinationList?.length - 1].id ? (
          <View style={styles.divider} />
        ) : (
          <View style={styles.dividerSpacing} />
        )}
      </>
    );
  };

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
            data={petList?.entry}
            horizontal
            contentContainerStyle={styles.petList}
            renderItem={({item}) => <RenderPetItem item={item} />}
            showsHorizontalScrollIndicator={false}
            // keyExtractor={(item) => item.id.toString()}
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
            keyExtractor={item => item?.id.toString()}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default VaccineManagementHome;
