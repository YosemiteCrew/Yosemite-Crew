import {Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import {Images} from '../../../utils';
import {colors} from '../../../../assets/colors';
import GText from '../../../components/GText/GText';
import GImage from '../../../components/GImage';
import HeaderButton from '../../../components/HeaderButton';

const PetSummary = ({navigation, route}) => {
  const {petDetails} = route?.params;
  const {t} = useTranslation();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, [navigation, t]);

  const summaryList = [
    {id: 1, summary: t('basic_info_string'), status: t('complete_string')},
    {
      id: 2,
      summary: t('emergency_contacts_string'),
      status: t('complete_string'),
    },
    {
      id: 3,
      summary: t('veterinary_details_string'),
      status: t('pending_string'),
      route: 'VeterinaryDetails',
    },
    {
      id: 4,
      summary: t('medical_record_string'),
      status: t('pending_string'),
      route: 'VeterinaryDetails',
    },
    {
      id: 5,
      summary: t('breeder_details_string'),
      status: t('pending_string'),
      route: 'AddBreederDetails',
    },
    {
      id: 6,
      summary: t('groomer_details_string'),
      status: t('pending_string'),
      route: 'GroomerDetails',
    },
    {
      id: 7,
      summary: t('pet_boarding_string'),
      status: t('pending_string'),
      route: 'PetBoardingDetails',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.petProfileContainer}>
        <View style={styles.petImageWrapper}>
          <GImage
            image={petDetails?.petImage?.url}
            style={styles.petImg}
            noImageSource={Images.Kizi}
          />
        </View>
        <TouchableOpacity style={styles.cameraView}>
          <Image source={Images.ProfileCamera} style={styles.cameraImg} />
        </TouchableOpacity>
      </View>
      <GText GrMedium text={'Kizie'} style={styles.petName} />
      <GText SatoshiMedium text={'Beagle'} style={styles.breed} />

      <View style={styles.flatListView}>
        {summaryList.map((item, index) => (
          <React.Fragment key={item.id}>
            <TouchableOpacity
              disabled={item.status !== t('pending_string')}
              onPress={() =>
                item.route &&
                navigation.navigate(item.route, {
                  petDetails: petDetails,
                })
              }
              style={styles.tileView}>
              <GText
                SatoshiBold
                text={item.summary}
                style={styles.summaryText}
              />
              <View style={styles.statusMainView}>
                <View style={styles.statusView(item.status)}>
                  <GText
                    SatoshiBold
                    text={item.status}
                    style={styles.statusText(item.status)}
                  />
                </View>
                <Image source={Images.RightArrow} style={styles.arrowImg} />
              </View>
            </TouchableOpacity>
            {index !== summaryList.length - 1 && (
              <View style={styles.divider} />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

export default PetSummary;
