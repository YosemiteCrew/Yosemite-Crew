// CategoryList.js
import React from 'react';
import {FlatList, Image, TouchableOpacity, View} from 'react-native';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import {Images} from '../../../../../utils';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';

const CategoryList = ({data, categoryTitle, nearYouText, onPress}) => {
  const {t} = useTranslation();
  return (
    <View>
      <View style={styles.titleView}>
        <GText GrMedium text={categoryTitle} style={styles.titleText} />
        <TouchableOpacity>
          <GText
            SatoshiBold
            text={`${data.length} ${nearYouText}`}
            style={styles.nearText}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.flatListView}>
        <FlatList
          data={data}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.containerStyle}
          horizontal
          renderItem={({item}) => (
            <View activeOpacity={0.5} style={styles.flatListUnderView}>
              <Image source={item.img} style={styles.imgStyle} />
              <GText
                componentProps={{
                  numberOfLines: 1,
                }}
                GrMedium
                text={item.name}
                style={styles.nameText}
              />
              <GText SatoshiBold text={item.time} style={styles.timeText} />
              <GText
                SatoshiRegular
                componentProps={{
                  numberOfLines: 3,
                }}
                text={item.description}
                style={styles.descriptionText}
              />
              <View style={styles.textView}>
                <View style={styles.innerView}>
                  <Image source={Images.Location} style={styles.locationImg} />
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
              <GButton
                icon={Images.Direction}
                onPress={onPress}
                iconStyle={styles.iconStyle}
                title={t('get_directions_string')}
                style={styles.buttonStyle}
                textStyle={styles.buttonTextStyle}
              />
            </View>
          )}
        />
      </View>
    </View>
  );
};

export default CategoryList;
