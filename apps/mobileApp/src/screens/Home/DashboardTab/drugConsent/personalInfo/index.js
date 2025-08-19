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
// import CalendarIcon from '../../../../../../assets/svgImages/calendar.svg';
// import {SvgImages} from '../../../../../utils/svgImages';

const PersonalInfo = ({navigation}) => {
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
        <GText SatoshiBold text="Step 2 of 5" style={styles.stepHeader} />
        <GText GrMedium text="Parent Information" style={styles.header} />
        {/* <CalendarIcon /> */}
        <View style={styles.inputContainer}>
          <Input label={t('your_full_name_string')} style={styles.input} />
          <Input
            label={t('email_id_string')}
            style={styles.input}
            keyboardType={'email-address'}
          />
          {/* <Input
            label={t('country_string')}
            style={styles.input}
            rightIcon={Images.ArrowDown}
            iconStyle={styles.scanIcon}
          /> */}
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text={t('country_string')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>

          <Input
            label={t('phone_number_string')}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text="Pet Species"
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <Image style={styles.arrow} source={Images.ArrowDown} /> */}
              {/* <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>

          {/* <Input label={t('provide_a_des_string')} style={styles.desBox} /> */}

          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text="Relationship with pet"
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
                text={t('Date of event')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.CalendarSvg style={styles.arrow} /> */}
            </View>
          </View>
        </View>
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'OrganizationalInfo',
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

export default PersonalInfo;
