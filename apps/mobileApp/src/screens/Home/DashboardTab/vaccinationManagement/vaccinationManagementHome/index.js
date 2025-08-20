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
import {scaledValue} from '../../../../../utils/design.utils';
import GButton from '../../../../../components/GButton';

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
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          onPress={() =>
            navigation.navigate('StackScreens', {screen: 'Notifications'})
          }
        />
      ),
    });
  }, [navigation]);

  const RenderPetItem = ({item}) => {
    return (
      <TouchableOpacity
        onPress={() => {
          navigation.navigate('StackScreens', {screen: 'VaccineRecords'});
        }}
        style={styles.petItem}>
        <View
          style={{
            borderWidth: scaledValue(1),
            borderRadius: scaledValue(40),
            borderColor: colors.primaryBlue,
          }}>
          <GImage
            image={item?.petImages}
            style={styles.petImage}
            noImageSource={Images.Kizi}
          />
        </View>

        <GText SatoshiBold text={item?.name} style={styles.petNameText} />
        {item?.status === 'Up-to-date' ? (
          <View style={styles.healthyStatus}>
            <Image
              tintColor={colors.white}
              source={Images.CircleCheck}
              style={styles.statusIcon}
            />
            <GText SatoshiBold text={'Up-to-date'} style={styles.statusText} />
          </View>
        ) : (
          <View style={styles.riskStatus}>
            <Image source={Images.Risk} style={styles.statusIcon} />
            <GText SatoshiBold text={'Upcoming'} style={styles.statusText} />
          </View>
        )}
      </TouchableOpacity>
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
            <GImage image={item?.petImage} style={styles.imgStyle} />
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

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id.toString()}
          />
        </View>

        {recentVaccinationList.length > 0 && (
          <GText
            SatoshiBold
            text={t('quick_actions_string')}
            style={styles.quickActionsText}
          />
        )}

        <View style={styles.recentVaccinationsContainer}>
          <FlatList
            data={recentVaccinationList}
            ListEmptyComponent={() => {
              return (
                <View>
                  <Image
                    source={Images.noVaccination}
                    style={styles.noDataImage}
                  />
                  <GText
                    GrMedium
                    text={t('no_vaccination_record_string')}
                    style={styles.noDataText}
                  />
                  <GText
                    text={t('no_vaccination_record_des_string')}
                    style={styles.addVaccinationText}
                  />
                  <GButton
                    onPress={() =>
                      navigation.navigate('StackScreens', {
                        screen: 'AddVaccineRecord',
                      })
                    }
                    icon={Images.addImage}
                    iconStyle={styles.addImage}
                    title={t('add_vaccination_record_string')}
                    style={{marginTop: scaledValue(40), gap: scaledValue(8)}}
                  />
                </View>
              );
            }}
            renderItem={({item}) => <RenderRecentVaccinationItem item={item} />}
            keyExtractor={item => item?.id.toString()}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default VaccineManagementHome;
