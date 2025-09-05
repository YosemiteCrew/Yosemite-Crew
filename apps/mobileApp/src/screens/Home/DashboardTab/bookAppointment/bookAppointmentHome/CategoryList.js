// CategoryList.js
import React, {useEffect, useState} from 'react';
import {
  FlatList,
  Image,
  Linking,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import {Images} from '../../../../../utils';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';
import GImage from '../../../../../components/GImage';
import {scaledValue} from '../../../../../utils/design.utils';
import Geolocation from '@react-native-community/geolocation';

const CategoryList = ({
  data,
  total_count,
  categoryTitle,
  nearYouText,
  onPress,
  navigation,
  type,
}) => {
  const {t} = useTranslation();

  const getDistanceFromLatLonInMiles = (lat1, lon1, lat2, lon2) => {
    const toRad = value => (value * Math.PI) / 180;

    const R = 3958.8; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setUserLocation({lat: latitude, lng: longitude});
      },
      error => console.log(error),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  }, []);

  return (
    <View>
      <View style={styles.titleView}>
        <GText GrMedium text={categoryTitle} style={styles.titleText} />
        <TouchableOpacity>
          {/* <GText
            SatoshiBold
            text={`${total_count} ${nearYouText}`}
            style={styles.nearText}
          /> */}
        </TouchableOpacity>
      </View>
      <View style={styles.flatListView}>
        <FlatList
          data={data?.slice(0, 5)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.containerStyle}
          // horizontal
          renderItem={({item}) => {
            const lat = item?.latitude;
            const lng = item?.longitude;
            const distance = getDistanceFromLatLonInMiles(
              userLocation?.lat,
              userLocation?.lng,
              item?.latitude,
              item?.longitude,
            ).toFixed(1);
            return (
              <>
                <TouchableOpacity
                  onPress={() => {
                    navigation?.navigate('StackScreens', {
                      screen: 'BookAppointmentDetail',
                      params: {
                        businessDetails: item,
                        type: type,
                        distance: distance,
                      },
                    });
                  }}
                  activeOpacity={0.9}
                  style={styles.flatListUnderView}>
                  <GImage image={item?.logo} style={styles.imgStyle} />
                  <GText
                    componentProps={{
                      numberOfLines: 1,
                    }}
                    GrMedium
                    text={item?.name}
                    style={styles.nameText}
                  />
                  {/* <GText SatoshiBold text={item.time} style={styles.timeText} /> */}
                  <GText
                    SatoshiRegular
                    componentProps={{
                      numberOfLines: 3,
                    }}
                    text={item?.selectedServices
                      ?.map(service => service.display)
                      .join(', ')}
                    style={styles.descriptionText}
                  />

                  <View style={styles.textView}>
                    <View style={styles.innerView}>
                      <Image
                        source={Images.Location}
                        style={styles.locationImg}
                      />
                      <GText
                        GrMedium
                        text={`${distance}mi`}
                        style={styles.distanceText}
                      />
                    </View>
                    <View style={styles.innerView}>
                      <Image source={Images.Star} style={styles.locationImg} />
                      <GText
                        GrMedium
                        text={item.rating}
                        style={styles.distanceText}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
                <GButton
                  icon={Images.Direction}
                  onPress={() => {
                    if (lat && lng) {
                      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                      Linking.openURL(url);
                    }
                  }}
                  iconStyle={styles.iconStyle}
                  title={t('get_directions_string')}
                  style={styles.buttonStyle}
                  textStyle={styles.buttonTextStyle}
                />
              </>
            );
          }}
        />
      </View>
    </View>
  );
};

export default CategoryList;
