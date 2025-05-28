// CategoryList.js
import React from 'react';
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
import { Images } from '../../../../../utils';
import { styles } from './styles';
import { useTranslation } from 'react-i18next';
import GImage from '../../../../../components/GImage';
import { scaledValue } from '../../../../../utils/design.utils';

const CategoryList = ({
  data,
  total_count,
  categoryTitle,
  nearYouText,
  onPress,
  navigation,
  type,
}) => {
  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.titleView}>
        <GText GrMedium text={categoryTitle} style={styles.titleText} />
        <TouchableOpacity>
          <GText
            SatoshiBold
            text={`${total_count} ${nearYouText}`}
            style={styles.nearText}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.flatListView}>
        <FlatList
          data={data?.slice(0, 2)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.containerStyle}
          horizontal
          renderItem={({ item }) => {
            const lat = item?.profileData?.address?.latitude;
            const lng = item?.profileData?.address?.longitude;
            console.log('item?.logo', item);

            return (
              <>
                <TouchableOpacity
                  onPress={() => {
                    navigation?.navigate('StackScreens', {
                      screen: 'BookAppointmentDetail',
                      params: {
                        businessDetails: item,
                        type: type,
                      },
                    });
                  }}
                  activeOpacity={0.9}
                  style={styles.flatListUnderView}
                >
                  <GImage image={item?.logo} style={styles.imgStyle} />
                  <GText
                    componentProps={{
                      numberOfLines: 1,
                    }}
                    GrMedium
                    text={item?.name}
                    style={styles.nameText}
                  />
                  <GText SatoshiBold text={item.time} style={styles.timeText} />
                  <GText
                    SatoshiRegular
                    componentProps={{
                      numberOfLines: 3,
                    }}
                    text={item?.selectedServices
                      ?.map((service) => service.display)
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
                        text={item.distance}
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
