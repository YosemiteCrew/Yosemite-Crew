import {Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {styles} from './styles';
import {Images} from '../../../utils';
import {colors} from '../../../../assets/colors';
import GText from '../../../components/GText/GText';
import GImage from '../../../components/GImage';
import HeaderButton from '../../../components/HeaderButton';
import {useAppDispatch} from '../../../redux/store/storeUtils';
import {get_pet_summary} from '../../../redux/slices/petSlice';
import GButton from '../../../components/GButton';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const PetSummary = ({navigation, route}) => {
  const {petDetails} = route?.params;
  const [summaryData, setSummaryData] = useState([]);
  const insets = useSafeAreaInsets();
  console.log('summaryDatasummaryData', JSON.stringify(summaryData));

  const {t} = useTranslation();
  const dispatch = useAppDispatch(
    useEffect(() => {
      dispatch(get_pet_summary({petId: petDetails?.id})).then(res => {
        if (get_pet_summary.fulfilled.match(res)) {
          if (res.payload?.section) {
            setSummaryData(res.payload?.section);
          }
        }
      });
    }, [petDetails?.id]),
  );

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
    {
      id: 1,
      summary: t('basic_info_string'),
      status: t('complete_string'),
      route: 'PetBasicInfo',
    },
    {
      id: 2,
      summary: 'Parent Information',
      status: t('complete_string'),
      route: 'ParentInfo',
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
      // route: 'VeterinaryDetails',
    },
    {
      id: 5,
      summary: t('breeder_details_string'),
      status: t('pending_string'),
      route: 'AddBreederDetails',
    },
    {
      id: 6,
      summary: `Groomer's Details`,
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
        <GImage
          image={petDetails?.petImages}
          style={styles.petImg}
          noImageSource={Images.Kizi}
        />
        {/* <TouchableOpacity style={styles.cameraView}>
          <Image source={Images.ProfileCamera} style={styles.cameraImg} />
        </TouchableOpacity> */}
      </View>
      <GText GrMedium text={petDetails?.name} style={styles.petName} />
      <GText SatoshiMedium text={petDetails?.breed} style={styles.breed} />

      <View style={styles.flatListView}>
        {summaryData.map((item, index) => {
          const summaryItem = summaryList?.find(
            summaryItem => summaryItem.summary === item?.title,
          );
          return (
            <>
              {summaryItem?.route && (
                <React.Fragment key={item.id}>
                  <TouchableOpacity
                    // disabled={item.status !== 'Complete'}
                    onPress={() => {
                      summaryItem?.route &&
                        navigation.navigate(summaryItem?.route, {
                          petData: petDetails,
                          setSummaryData,
                          item,
                        });
                    }}
                    style={styles.tileView}>
                    <GText
                      SatoshiBold
                      text={item.title}
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
                      <Image
                        source={Images.RightArrow}
                        style={styles.arrowImg}
                      />
                    </View>
                  </TouchableOpacity>
                  {index !== summaryData.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </React.Fragment>
              )}
            </>
          );
        })}
      </View>

      <View style={styles.btnView(insets.bottom)}>
        <GButton
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{name: 'TabBar'}],
            })
          }
          title={'Go To Dashboard'}
          icon={Images?.Dashboard}
          iconStyle={styles.iconStyle}
          style={styles.buttonStyle}
        />
      </View>
    </View>
  );
};

export default PetSummary;
