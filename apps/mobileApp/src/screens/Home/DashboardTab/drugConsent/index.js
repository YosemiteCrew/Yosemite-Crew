import {View, Text, Image, ScrollView} from 'react-native';
import React, {useEffect} from 'react';
import {styles} from './styles';
import GButton from '../../../../components/GButton';
import HeaderButton from '../../../../components/HeaderButton';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import GText from '../../../../components/GText/GText';
// import {SvgImages} from '../../../../utils/svgImages';

const DrugConsent = ({navigation}) => {
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

  const data = [
    {
      id: 1,
      parent: 'The Pet Parent',
    },
    {
      id: 2,
      parent: 'The guardian',
    },
  ];

  const instructionArray = [
    {
      id: 1,
      inst: 'Please review and accept our Terms & Conditions.',
    },
    {
      id: 2,
      inst: 'By submitting this form, you agree to share your personal and pet-related data with us ',
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView>
        <GText SatoshiBold text="Step 1 of 5" style={styles.stepHeader} />
        {/* <SvgImages.WomenWorking style={styles.women_working} /> */}

        {/* <Image source={Images.women_working} style={styles.women_working} /> */}
        <GText
          style={styles.titleText}
          GrMedium
          text="Veterinary Product Adverse Events"
        />
        <GText
          GrMedium
          style={styles.sunHeaderText}
          text="Notify the manufacturer about any issues or concerns you experienced with a pharmaceutical product used for your pet."
        />
        <GText
          SatoshiMedium
          style={styles.desText}
          text="To report a potential side effect, unexpected reaction, or any other concern following the use of a YosemiteCrew Animal Health product, please fill out the following form as completely and accurately as possible. "
        />
        <GText
          GrMedium
          style={styles.linkText}
          text="Know More at: http//blog/adverseevents."
        />
        <GText
          text="Who is reporting the concern?"
          GrMedium
          style={styles.ques}
        />
        {data.map(item => (
          <View style={styles.optionsView}>
            {/* <SvgImages.RadioCircleSvg style={styles.circleButton} /> */}
            <Text key={item.id} style={styles.parentText}>
              {item.parent}
            </Text>
          </View>
        ))}
        <GText SatoshiBold style={styles.instTitle} text="Before you proceed" />

        <View style={styles.instructionView}>
          {/* <SvgImages.CheckButton style={styles.circleButton} /> */}

          <Text style={styles.instText}>
            Please review and accept our{' '}
            <Text style={styles.terms}> Terms & Conditions.</Text>
          </Text>
        </View>
        <View style={styles.instructionView}>
          {/* <SvgImages.CheckButton style={styles.circleButton} /> */}
          <Text style={styles.instText}>
            By submitting this form, you agree to share your personal and
            pet-related data with us
          </Text>
        </View>

        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {
              screen: 'PersonalInfo',
            })
          }
          title="Next"
          style={styles.nextButton}
        />
      </ScrollView>
    </View>
  );
};

export default DrugConsent;
