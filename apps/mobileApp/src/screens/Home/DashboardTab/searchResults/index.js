import {
  FlatList,
  Image,
  ImageBackground,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../components/HeaderButton';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';

import {styles} from './styles';
import GText from '../../../../components/GText/GText';
import GButton from '../../../../components/GButton';
// import {SvgImages} from '../../../../utils/svgImages';

const SearchResults = ({navigation}) => {
  const {t} = useTranslation();
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={navigation.goBack}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.jetBlack}
          onPress={() =>
            navigation.navigate('StackScreens', {screen: 'Notifications'})
          }
        />
      ),
    });
  }, [navigation]);
  //   const renderItem = ({item}) => {
  //     return (
  //       <View>
  //         <Image style={styles.hospitalImg} source={Images.Hospital1} />
  //         <GText
  //           style={styles.titleText}
  //           GrMedium
  //           text="San Francisco Animal Medical Center"
  //         />
  //         <GText style={styles.timeText} SatoshiBold text="Open 24 Hours" />
  //         <GText
  //           style={styles.des}
  //           text="24/7 Emergency Care, Surgery and Operating Rooms, Veterinary ICU, Diagnostic Imaging, Laboratory, Dental Care Services,"
  //         />
  //         <View style={styles.bottomView}>
  //           <View style={styles.distanceView}>
  //             <Image style={styles.locationImg} source={Images.Location} />
  //             <GText style={styles.locationText} GrMedium text="2.5mi" />
  //           </View>
  //           <View style={styles.ratingView}>
  //             <Image style={styles.starImg} source={Images.Star} />
  //             <GText GrMedium style={styles.ratingText} text="4.1" />
  //           </View>
  //         </View>
  //         <GButton
  //           iconStyle={styles.iconStyle}
  //           icon={Images.Calender}
  //           title="Book Appointment"
  //           style={styles.bookingButton}
  //           textStyle={styles.bookingText}
  //         />
  //         <GButton
  //           iconStyle={styles.directionIcon}
  //           icon={Images.Direction}
  //           title="Get Directions"
  //           style={styles.getDirections}
  //           textStyle={styles.directionsText}
  //         />
  //       </View>
  //     );
  //   };
  const renderItem = () => {
    return (
      <View style={styles.doctorFlatlist}>
        <View>
          <View style={styles.contentView}>
            <View style={styles.ImgView}>
              {/* <SvgImages.drEmilySvg style={styles.doctorImg} /> */}
            </View>
            <View style={styles.textView}>
              <GText GrMedium style={styles.name} text="Dr. Emily Johnson" />
              <GText SatoshiBold style={styles.department} text="Cardiology" />

              <GText
                SatoshiBold
                style={styles.qualification}
                text="DVM, DACVIM"
              />
              <Text style={styles.exp}>
                Experience:<Text style={styles.expYears}>13 Years</Text>
              </Text>
              <View>
                <Text style={styles.consultation}>
                  Consultation Fee:<Text style={styles.fees}>$220</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.ratingView}>
          {/* <SvgImages.starSvg style={styles.starImg} /> */}
          <GText GrMedium style={styles.ratingText} text="4.1" />
        </View>
        <GButton title="Book Appointment" style={styles.bookAppointment} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.searchTouchable}
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'SearchResults',
            })
          }>
          <GText
            text={t('search_hos_doc_pms_string')}
            style={styles.searchText}
          />

          {/* <SvgImages.SearchSvg style={styles.solarWalledImage} /> */}
        </TouchableOpacity>
        <GText
          style={styles.headerTitle}
          SatoshiBold
          text={t('list_of_results_that_match_with_search_string')}
        />
        <FlatList
          data={[1]}
          contentContainerStyle={{margin: 20}}
          renderItem={renderItem}
        />
      </View>
    </View>
  );
};

export default SearchResults;
