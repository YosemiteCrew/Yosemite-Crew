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

const OrganizationalInfo = ({navigation}) => {
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
        <GText SatoshiBold text="Step 3 of 5" style={styles.stepHeader} />
        <GText GrMedium text="Hospital Information" style={styles.header} />
        <View style={styles.inputContainer}>
          <Input label={t('organization_name_string')} style={styles.input} />
          <Input
            label={t('email_address_string')}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <View style={styles.productUsageView}>
            <View style={styles.productUsageInputView}>
              <GText
                SatoshiRegular
                text={t('country_region_string')}
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
                text={t('website_string')}
                style={styles.noOfLinesText}
              />
            </View>
            <View style={styles.productUsageImageView}>
              {/* <SvgImages.arrowDownSvg style={styles.arrow} /> */}
            </View>
          </View>

          <Input
            label={t('vet_name_string')}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <Input
            label={t('vet_email_address_string')}
            style={styles.input}
            keyboardType={'email-address'}
          />
          <Input
            label={t('vet_phone_number_string')}
            style={styles.input}
            keyboardType={'email-address'}
          />
        </View>
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'AnimalInfo',
            })
          }
          title="Next"
          style={styles.nextButton}
        />
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'AnimalInfo',
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

export default OrganizationalInfo;
