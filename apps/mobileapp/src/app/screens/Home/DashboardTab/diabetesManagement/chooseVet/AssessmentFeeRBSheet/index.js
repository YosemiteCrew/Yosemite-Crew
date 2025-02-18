import React from 'react';
import {View, Image, TouchableOpacity, Dimensions} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import {scaledValue} from '../../../../../../utils/design.utils';
import {CircleClose, widgetBold} from '../../../../../../utils/Images';
import GText from '../../../../../../components/GText/GText';
import {Images} from '../../../../../../utils';
import {Divider} from 'react-native-paper';
import GButton from '../../../../../../components/GButton';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {styles} from './styles';

const AssessmentFeeRBSheet = props => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <RBSheet
      ref={props?.refRBSheet}
      height={Dimensions.get('screen').height / 2 + insets.bottom}
      closeOnDragDown={false}
      closeOnPressMask={false}
      customStyles={{
        draggableIcon: {
          backgroundColor: '#ddd',
        },
        container: {
          backgroundColor: '#FFFBFE',
          borderTopRightRadius: scaledValue(24),
          borderTopLeftRadius: scaledValue(24),
        },
      }}>
      <View style={styles.mainContainer}>
        <TouchableOpacity onPress={() => props?.refRBSheet?.current?.close()}>
          <Image source={CircleClose} style={styles.circleClose} />
        </TouchableOpacity>
        <View style={{marginHorizontal: scaledValue(24)}}>
          <GText
            GrMedium
            text={'Assessment Fee'}
            style={styles.assessmentFeeText}
          />
          <View style={styles.petDetailView}>
            <Image source={Images.Kizi} style={styles.petImage} />
            <View style={{marginLeft: scaledValue(8)}}>
              <GText
                GrMedium
                text={'Diabetes Assessment'}
                style={styles.diabetesText}
              />
              <GText
                SatoshiBold
                text={'29 Sep 2024 - 8:47 AM'}
                style={styles.dateTimeText}
              />
            </View>
          </View>
          <View style={styles.feeBreakdownTextView}>
            <Image source={widgetBold} style={styles.widgetBold} />
            <GText
              GrMedium
              text={'Fee Breakdown'}
              style={styles.feeBreakdownText}
            />
          </View>
          <View style={styles.feeListView}>
            <GText
              SatoshiBold
              text={'Evaluation Charges'}
              style={styles.listItemText}
            />
            <View style={{flexDirection: 'row'}}>
              <GText SatoshiBold text={'50'} style={styles.feeText} />
              <GText SatoshiBold text={'USD'} style={styles.usdText} />
            </View>
          </View>
          <Divider />
          <View style={styles.feeListView}>
            <GText
              SatoshiBold
              text={'Platform Fee (2%)'}
              style={styles.listItemText}
            />
            <View style={{flexDirection: 'row'}}>
              <GText SatoshiBold text={'1'} style={styles.feeText} />
              <GText SatoshiBold text={'USD'} style={styles.usdText} />
            </View>
          </View>
          <Divider />
          <View style={styles.feeListView}>
            <GText SatoshiBold text={'Total'} style={styles.totalText} />
            <View style={{flexDirection: 'row'}}>
              <GText SatoshiBold text={'51'} style={styles.totalAmountText} />
              <GText
                SatoshiBold
                text={'USD'}
                style={styles.totalAmoundUsdText}
              />
            </View>
          </View>
          <View style={styles.buttonView(insets)}>
            <GButton
              onPress={() => {
                //   navigation?.navigate('StackScreens', {
                //     screen: 'AddNewRecord1',
                //   });
              }}
              title={t('pay_now_string')}
              textStyle={styles.buttonText}
              style={styles.buttonStyle}
            />
          </View>
        </View>
      </View>
    </RBSheet>
    // </View>
  );
};

export default AssessmentFeeRBSheet;
