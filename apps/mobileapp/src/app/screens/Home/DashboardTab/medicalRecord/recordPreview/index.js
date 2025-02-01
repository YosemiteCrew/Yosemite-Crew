import {Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import Swiper from 'react-native-swiper';

const RecordPreview = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [scrollIndex, setScrollIndex] = useState(0);

  const swiperRef = useRef();

  const onPressNextButton = () => {
    if (scrollIndex < [1, 2, 3].length - 1) {
      swiperRef.current.scrollBy(1);
    } else {
    }
  };

  const onPressBackButton = () => {
    swiperRef.current.scrollBy(-1);
  };

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.PlusBold}
          tintColor={colors.appRed}
          onPress={() => {}}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const buttonList = [
    {
      id: 1,
      img: Images.Share,
      title: t('share_string'),
    },
    {
      id: 2,
      img: Images.Edit,
      title: t('edit_string'),
    },
    {
      id: 3,
      img: Images.Trash,
      title: t('delete_string'),
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <View style={styles.topRow}>
        <GText
          GrMedium
          text={'Invoice for consultation'}
          style={styles.titleText}
        />
        {scrollIndex < 2 && (
          <View style={styles.iconRow}>
            <TouchableOpacity>
              <Image
                source={Images.Share}
                tintColor={colors.appRed}
                style={styles.icon}
              />
            </TouchableOpacity>
            <TouchableOpacity>
              <Image source={Images.Edit} style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity>
              <Image source={Images.Trash} style={styles.icon} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={styles.issuedRow}>
        <GText
          SatoshiBold
          text={`${t('issued_string')}: `}
          style={styles.issuedText}
        />
        <GText SatoshiBold text={'28 July 2024'} style={styles.dateText} />
      </View>
      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          loop={false}
          bounces={false}
          scrollEnabled={false}
          onIndexChanged={index => setScrollIndex(index)}
          activeDotColor="rgba(3, 165, 190, 1)"
          dotColor="#E9E9E9"
          showsButtons={false}
          activeDotStyle={styles.activeDotStyle}
          dotStyle={styles.dotStyle}
          showsPagination={false}
          paginationStyle={styles.paginationStyle}>
          {[1, 2, 3].map((page, index) => (
            <View key={index} style={styles.swiperSlide}>
              <Image source={Images.InvoicePdf} style={styles.invoiceImage} />
            </View>
          ))}
        </Swiper>
      </View>
      <View style={styles.navigationRow}>
        <TouchableOpacity onPress={() => onPressBackButton()}>
          <Image source={Images.arrowLeftOutline} style={styles.navIcon} />
        </TouchableOpacity>
        <View style={styles.pageIndicator}>
          <GText
            GrMedium
            text={`${t('page_string')} 1`}
            style={styles.pageText}
          />
          <GText
            GrMedium
            text={` ${t('of_string')} 3`}
            style={styles.pageText}
          />
        </View>
        <TouchableOpacity onPress={() => onPressNextButton()}>
          <Image
            source={Images.arrowLeftOutline}
            tintColor={colors.appRed}
            style={styles.navIconRotated}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.buttonGroup}>
        {scrollIndex > 1 &&
          buttonList?.map((i, d) => (
            <View key={d} style={styles.buttonWrapper}>
              <TouchableOpacity style={styles.button}>
                <Image
                  source={i?.img}
                  tintColor={colors.appRed}
                  style={styles.buttonIcon}
                />
              </TouchableOpacity>
              <GText SatoshiBold text={i?.title} style={styles.buttonText} />
            </View>
          ))}
      </View>
    </View>
  );
};

export default RecordPreview;
