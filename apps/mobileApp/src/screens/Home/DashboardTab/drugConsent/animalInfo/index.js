import {View, Text, ScrollView, Image} from 'react-native';
import React, {useEffect} from 'react';
import {styles} from './styles';
import {colors} from '../../../../../../assets/colors';
import {Images} from '../../../../../utils';
import HeaderButton from '../../../../../components/HeaderButton';
import GText from '../../../../../components/GText/GText';
import Input from '../../../../../components/Input';
import {useTranslation} from 'react-i18next';
import GButton from '../../../../../components/GButton';
// import {SvgImages} from '../../../../../utils/svgImages';

const AnimalInfo = ({navigation}) => {
  const {t} = useTranslation();
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
        <GText SatoshiBold text="Step 4 of 5" style={styles.stepHeader} />
        <GText GrMedium text="Animal Information" style={styles.header} />
        <View style={styles.inputContainer}>
          <Input label={t('patient_name_string')} style={styles.input} />

          {/* <Input
            label={t('age_string')}
            style={styles.input}
            rightIcon={Images.Calender}
            iconStyle={styles.scanIcon}
          /> */}
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text={t('age_string')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.CalendarSvg style={styles.arrow} /> */}
            </View>
          </View>
          <View style={styles.checkboxView}>
            <View style={styles.checkImgView}>
              {/* <SvgImages.CheckButton style={styles.arrow} /> */}
            </View>
            <View style={styles.checkTextView}>
              <GText
                SatoshiRegular
                style={styles.checkText}
                text="Check this box if the date of birth is approximate"
              />
            </View>
          </View>
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text={t('breed_string')}
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
                text={t('gender_string')}
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
                text={t('reproductive_status_string')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>

          <Input
            // value={formValue.pimsCode}
            label={t('weight_string')}
            // onChangeText={value =>
            //   setFormValue({...formValue, pimsCode: value})
            // }
            style={styles.input}
          />
          <View style={styles.checkBoxesView}>
            <View style={styles.checkBox}>
              {/* <Image style={styles.uncheckBox} source={Images.uncheckButton} /> */}
              {/* <SvgImages.CheckButton style={styles.arrow} /> */}
              <GText style={styles.poundText} text="Pounds" />
            </View>
            <View style={styles.checkBox}>
              {/* <SvgImages.CheckButton style={styles.arrow} /> */}
              <GText style={styles.poundText} text="Kilograms" />
            </View>
          </View>
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text={t('batch_number_string')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>

          <Input label={t('current_medication_string')} style={styles.desBox} />
          <Input label={t('diet_plans_string')} style={styles.desBox} />
        </View>
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'ProductInfo',
            })
          }
          title="Next"
          style={styles.nextButton}
        />
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'ProductInfo',
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

export default AnimalInfo;
