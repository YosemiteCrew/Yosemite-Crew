import {StyleSheet, View} from 'react-native';
import React from 'react';
import {scaledValue} from '../../../../../utils/design.utils';
import GText from '../../../../../components/GText/GText';
import {colors} from '../../../../../../assets/colors';
import Input from '../../../../../components/Input';

const OptionalEntriesCard = ({
  entriesName,
  showEntriesDetails,
  level,
  measure,
  onChangeText,
}) => {
  return (
    <View style={styles.entriesCardContainer}>
      <GText SatoshiBold text={entriesName} style={styles.entriesName} />
      {!showEntriesDetails && (
        <Input
          // value={formValue?.water_intake}
          rightText={
            <GText SatoshiBold text="mg/dL" style={styles.rightIconText} />
          }
          themeBackground="transparent"
          contentStyle={styles.contentStyle}
          iconStyle={styles.iconStyle}
          onChangeText={onChangeText}
          style={styles.input}
          outlineStyle={{borderRadius: scaledValue(8)}}
          keyboardType={'email-address'}
          rightTextStyle={{marginRight: -10, marginLeft: -10}}
        />
      )}
      {showEntriesDetails && (
        <View style={styles.viewPetMgDetail}>
          <GText SatoshiBold text={level} style={styles.rightMgAmountText} />
          <GText SatoshiBold text={measure} style={styles.rightIconText} />
        </View>
      )}
    </View>
  );
};

export default OptionalEntriesCard;

const styles = StyleSheet.create({
  input: {
    width: scaledValue(100),
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    padding: 0,
    height: scaledValue(32),
  },
  iconStyle: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  entriesCardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaledValue(8),
    paddingVertical: scaledValue(20.5),
  },
  entriesName: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(18 * -0.02),
    color: colors.darkPurple,
  },
  rightIconText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(14.4),
    color: colors.jetBlack,
    opacity: 0.5,
  },
  contentStyle: {
    paddingVertical: 0,
    paddingLeft: 8,
  },
  rightMgAmountText: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    color: colors.jetBlack,
    opacity: 0.7,
    marginRight: scaledValue(4),
  },
  viewPetMgDetail: {flexDirection: 'row', alignItems: 'center'},
});
