import {View, Text, ScrollView, Image, TouchableOpacity} from 'react-native';
import React, {useEffect, useRef} from 'react';
import {styles} from './styles';
import {colors} from '../../../../../../assets/colors';
import {Images} from '../../../../../utils';
import HeaderButton from '../../../../../components/HeaderButton';
import GText from '../../../../../components/GText/GText';
import Input from '../../../../../components/Input';
import {useTranslation} from 'react-i18next';
import GButton from '../../../../../components/GButton';
import {TextInput} from 'react-native-paper';
// import {SvgImages} from '../../../../../utils/svgImages';

const ProductInfo = ({navigation}) => {
  const {t} = useTranslation();
  const refRBSheet = useRef();
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
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <GText SatoshiBold text="Step 5 of 5" style={styles.stepHeader} />
        <GText GrMedium text={t('product_info_string')} style={styles.header} />
        <View style={styles.inputContainer}>
          <Input label={t('product_name_string')} style={styles.input} />
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text={t('brand_name_string')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text={t('manufacturing_phase_string')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>

          <Input label={t('batch_number_string')} style={styles.input} />

          {/* <Input label={t('product_name_string')} style={styles.input} /> */}
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text="Number Of times Product Used"
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.arrowUpwards style={styles.arrow} />
              <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>
          <Input label={t('quantity_used_string')} style={styles.input} />
          <View style={styles.checkBoxesView}>
            <View style={styles.checkBox}>
              {/* <SvgImages.CheckButton style={styles.uncheckBox} /> */}
              <GText style={styles.poundText} text="Tablet - Piece" />
            </View>
            <View style={styles.checkBox}>
              {/* <SvgImages.CheckButton style={styles.uncheckBox} /> */}
              <GText style={styles.poundText} text="Liquid - ML" />
            </View>
          </View>
          {/* <Input
            label={t('how_was_the_product_administered_string')}
            style={styles.input}
            rightIcon={Images.ArrowDown}
            iconStyle={styles.scanIcon}
          /> */}
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text={t('how_was_the_product_administered_string')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>
          <Input
            label={t('reason_to_use_the_product_string')}
            style={styles.desBox}
          />
          <Input
            label={t('pet_condition_before_drug_string')}
            style={styles.desBox}
          />
          <Input
            label={t('pet_condition_after_drug_string')}
            style={styles.desBox}
          />
          <GText
            style={styles.uploadTitle}
            SatoshiBold
            text="Please add image of the product used."
          />
          <View style={styles.uploadView}>
            {/* <Image style={styles.uploadImg} source={Images.Upload} /> */}
            {/* <SvgImages.Upload style={styles.uploadImg} /> */}
            <GText style={styles.uploadText} SatoshiBold text="Upload Image" />
          </View>
          <View style={styles.calendarView}>
            <Text style={styles.expenseDateText}>{t('event_date_string')}</Text>

            <TouchableOpacity onPress={() => refRBSheet.current.open()}>
              {/* <SvgImages.CalendarSvg style={styles.uncheckBox} /> */}
            </TouchableOpacity>
          </View>
        </View>
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'SendReport',
            })
          }
          title="Next"
          style={styles.nextButton}
        />
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'PersonalInfo',
            })
          }
          title="Back"
          style={styles.backButton}
          textStyle={styles.backButtonText}
        />
      </ScrollView>
    </View>
  );
};

export default ProductInfo;
