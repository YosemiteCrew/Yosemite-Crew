import { StyleSheet, TextInput, View } from 'react-native';
import React from 'react';
import { scaledValue } from '../../../../../utils/design.utils';
import GText from '../../../../../components/GText/GText';
import { colors } from '../../../../../../assets/colors';
import Input from '../../../../../components/Input';

const OptionalEntriesCard = ({
  entriesName,
  showEntriesDetails,
  level,
  measure,
  rightText,
  onChangeText,
}) => {
  return (
    <View style={styles.entriesCardContainer}>
      <GText SatoshiBold text={entriesName} style={styles.entriesName} />
      {!showEntriesDetails && (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: scaledValue(92),
              justifyContent: 'space-between',
              borderWidth: scaledValue(1),
              borderRadius: scaledValue(8),
              borderColor: '#31294399',
            }}>
            <TextInput
              keyboardType="numeric"
              onChangeText={onChangeText}
              style={{
                height: scaledValue(36),
                paddingHorizontal: scaledValue(5),
                flex: 1,
              }}
            />
            <GText SatoshiBold text={rightText} style={styles.labelText} />
          </View>
        </>
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
    height: scaledValue(36),
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
    paddingVertical: scaledValue(12),
  },
  entriesName: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(18 * -0.02),

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
  viewPetMgDetail: { flexDirection: 'row', alignItems: 'center' },
  labelText: {
    color: colors.jetBlack,
    fontSize: scaledValue(12),
    opacity: 0.5,
    marginRight: scaledValue(8),
  },
});
