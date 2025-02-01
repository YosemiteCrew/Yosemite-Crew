import {Image, TouchableOpacity, View} from 'react-native';
import React from 'react';
import {styles} from './styles';
import GText from '../../../components/GText/GText';
import {scaledValue} from '../../../utils/design.utils';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Images} from '../../../utils';

const PetSummary = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top;
  const {t} = useTranslation();

  const summaryList = [
    {
      id: 1,
      summary: t('basic_info_string'),
      status: t('complete_string'),
      onAction: () => {},
    },
    {
      id: 2,
      summary: t('emergency_contacts_string'),
      status: t('complete_string'),
      onAction: () => {},
    },
    {
      id: 3,
      summary: t('veterinary_details_string'),
      status: t('pending_string'),
      onAction: () => {
        navigation?.navigate('VeterinaryDetails');
      },
    },
    {
      id: 4,
      summary: t('medical_record_string'),
      status: t('pending_string'),
      onAction: () => {
        navigation?.navigate('VeterinaryDetails');
      },
    },
    {
      id: 5,
      summary: t('breeder_details_string'),
      status: t('pending_string'),
      onAction: () => {
        navigation?.navigate('AddBreederDetails');
      },
    },
    {
      id: 6,
      summary: t('groomer_details_string'),
      status: t('pending_string'),
      onAction: () => {
        navigation?.navigate('GroomerDetails');
      },
    },
    {
      id: 7,
      summary: t('pet_boarding_string'),
      status: t('pending_string'),
      onAction: () => {
        navigation?.navigate('PetBoardingDetails');
      },
    },
  ];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerContainer,
          {marginTop: statusBarHeight + scaledValue(20)},
        ]}>
        <TouchableOpacity
          onPress={() => {
            navigation?.goBack();
          }}
          style={styles.backButton}>
          <Image
            source={Images.Left_Circle_Arrow}
            style={styles.backButtonImage}
          />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <GText
            GrMedium
            text={t('your_pets_string')}
            style={styles.headerText}
          />
        </View>
      </View>
      <View style={styles.petProfileContainer}>
        <Image source={Images.Kizi} style={styles.petImg} />
        <TouchableOpacity style={styles.cameraView}>
          <Image source={Images.ProfileCamera} style={styles.cameraImg} />
        </TouchableOpacity>
      </View>
      <GText GrMedium text={'Kizie'} style={styles.petName} />
      <GText SatoshiMedium text={'Beagle'} style={styles.breed} />
      <View style={styles.flatListView}>
        {summaryList?.map((item, index) => (
          <>
            <TouchableOpacity
              disabled={item?.status != t('pending_string')}
              onPress={item?.onAction}
              key={item?.id}
              style={styles.tileView}>
              <GText
                SatoshiBold
                text={item?.summary}
                style={styles.summaryText}
              />
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View
                  style={[
                    styles.statusView,
                    {
                      backgroundColor:
                        item?.status == t('pending_string')
                          ? '#FDBD74'
                          : '#8AC1B1',
                      paddingHorizontal:
                        item?.status == t('pending_string')
                          ? scaledValue(13)
                          : scaledValue(9),
                    },
                  ]}>
                  <GText
                    SatoshiBold
                    text={item?.status}
                    style={styles.statusText}
                  />
                </View>
                <Image source={Images.RightArrow} style={styles.arrowImg} />
              </View>
            </TouchableOpacity>
            {item.id !== summaryList[summaryList.length - 1].id && (
              <View style={styles.divider} />
            )}
          </>
        ))}
      </View>
    </View>
  );
};

export default PetSummary;
