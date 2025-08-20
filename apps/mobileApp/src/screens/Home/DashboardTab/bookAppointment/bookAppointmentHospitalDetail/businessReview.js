import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { Images } from '../../../../../utils';
import HeaderButton from '../../../../../components/HeaderButton';
import { colors } from '../../../../../../assets/colors';
import { styles } from './styles';
import GImage from '../../../../../components/GImage';
import { scaledValue } from '../../../../../utils/design.utils';
import GText from '../../../../../components/GText/GText';
import CustomRating from '../../../../../components/CustomRating';
import { useTranslation } from 'react-i18next';
import GButton from '../../../../../components/GButton';

const BusinessReview = ({ navigation, route }) => {
  const { businessDetails } = route?.params;
  const [rating, setRating] = useState(businessDetails?.rating);
  const [review, setReview] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.jetBlack}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
    });
  };

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView>
        <View
          style={{
            flexDirection: 'row',
            marginTop: scaledValue(20),
            paddingHorizontal: scaledValue(20),
          }}>
          <GImage
            resizeMode="contain"
            image={businessDetails?.logo}
            style={{
              width: scaledValue(120),
              height: scaledValue(80.2),
              borderRadius: scaledValue(12),
              backgroundColor: colors.black,
            }}
          />
          <View style={{ marginLeft: scaledValue(8), width: '65%' }}>
            <GText
              componentProps={{ numberOfLines: 2 }}
              GrMedium
              text={businessDetails?.name}
              style={{
                fontSize: scaledValue(18),
                letterSpacing: scaledValue(18 * -0.01),
                color: colors.jetBlack,
              }}
            />
            <GText
              SatoshiMedium
              text={businessDetails?.address}
              style={{
                fontSize: scaledValue(12),
                color: colors.jetLightBlack,
                marginTop: scaledValue(4),
              }}
            />
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: scaledValue(20),
            marginTop: scaledValue(28),
          }}>
          <GText
            GrMedium
            text={'Add Rating'}
            style={{
              fontSize: scaledValue(18),
              letterSpacing: scaledValue(18 * -0.01),

            }}
          />
          <CustomRating
            maxRating={5}
            value={rating}
            filledStar={Images.Star}
            unfilledStar={Images.StarUnFill}
            containerStyle={{
              justifyContent: 'flex-start',
              marginTop: scaledValue(8),
            }}
            onRatingChange={rating => setRating(rating)}
            imageStyle={styles.starImage}
            starContainerStyle={{
              marginHorizontal: scaledValue(4),
            }}
          />
          <GText
            GrMedium
            text={t('review_string')}
            style={{
              fontSize: scaledValue(18),
              letterSpacing: scaledValue(18 * -0.01),

              marginTop: scaledValue(32),
            }}
          />
          <TextInput
            value={review}
            onChangeText={setReview}
            placeholder={t('your_review_string')}
            multiline={true}
            placeholderTextColor={colors.darkPurple2}
            style={styles.inputStyle}
          />
        </View>
      </ScrollView>
      <GButton
        onPress={() => { }}
        title={t('submit_review_string')}
        style={styles.buttonStyle1}
      />
    </View>
  );
};

export default BusinessReview;
