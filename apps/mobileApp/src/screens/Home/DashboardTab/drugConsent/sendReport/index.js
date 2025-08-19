import {Text, View, Image} from 'react-native';
import React, {useEffect} from 'react';
import HeaderButton from '../../../../../components/HeaderButton';

import {colors} from '../../../../../../assets/colors';

import {Images} from '../../../../../utils';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
// import {SvgImages} from '../../../../../utils/svgImages';

const SendReport = ({navigation}) => {
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.jetBlack}
          onPress={() => {}}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };
  return (
    <View style={styles.container}>
      <Image style={styles.girlWithBird} source={Images.girlWithBird} />
      {/* <SvgImages.girlWithBird style={styles.girlWithBird} /> */}

      <GText
        text="Thank you for reaching out to us"
        GrMedium
        style={styles.titleText}
      />
      <GText
        text="By submitting a report, you agree to be contacted by the company if needed to obtain further details regarding your report. "
        SatoshiBold
        style={styles.desText}
      />
      <View style={styles.checkboxView}>
        <Image style={styles.checkboxImg} source={Images.checkedButton} />
        {/* <SvgImages.checkedButton style={styles.checkboxImg} /> */}
        <GText
          style={styles.checkboxText}
          SatoshiBold
          text="I agree to be contacted"
        />
      </View>
      <GButton style={styles.sendButtonPharma} title="Send Report to Pharma" />
      <GButton
        textStyle={styles.sendText}
        style={styles.sendButtonVet}
        title="Send Report to Vet"
      />
      <View style={styles.callView}>
        {/* <SvgImages.phoneSvg style={styles.checkboxImg} /> */}
        <GText GrMedium style={styles.callText} text="Call FDA" />
      </View>
    </View>
  );
};

export default SendReport;
