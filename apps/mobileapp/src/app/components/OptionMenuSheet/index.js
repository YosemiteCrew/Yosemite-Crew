import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import {getFontSize, scaledValue} from '../../utils/design.utils';
import {Divider} from 'react-native-paper';
import fonts from '../../utils/fonts';
import {colors} from '../../../assets/colors';

const OptionMenuSheet = props => {
  const refRBSheet = props.refRBSheet;
  const options = props.options || [];
  const onChoose = props.onChoose || null;
  const titleKey = props.titleKey || 'title';
  let optionsLength = options.length;
  const title = props?.title;

  return (
    <RBSheet
      ref={refRBSheet}
      height={
        title ? (optionsLength + 2) * 61 + 18 : (optionsLength + 1) * 61 + 18
      }
      closeOnDragDown={true}
      closeOnPressMask={true}
      customStyles={{
        container: {
          borderTopLeftRadius: scaledValue(10),
          borderTopRightRadius: scaledValue(10),
          backgroundColor: 'transparent',
        },
        wrapper: {
          backgroundColor: 'rgba(0,0,0,.6)',
          paddingHorizontal: scaledValue(10),
        },
        draggableIcon: {
          display: 'none',
        },
      }}>
      <View style={styles.bottomSheetView}>
        {title && (
          <View
            style={{
              backgroundColor: '#FFF4EC',
            }}>
            <Text
              style={{
                color: '#aaa',
                textAlign: 'center',
                paddingVertical: scaledValue(15),
                fontWeight: '400',
                fontSize: scaledValue(14),
              }}>
              {title}
            </Text>
            <Divider />
          </View>
        )}
        <View style={{borderRadius: scaledValue(10)}}>
          {options.map((c, i) =>
            i !== optionsLength - 1 ? (
              <React.Fragment key={i}>
                <View style={[styles.menuView]}>
                  <TouchableOpacity onPress={() => onChoose(c)}>
                    <Text style={styles.menuTitle(c?.textColor)}>
                      {c[titleKey]}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Divider />
              </React.Fragment>
            ) : (
              <View
                style={[
                  styles.menuView,
                  {
                    borderBottomLeftRadius: scaledValue(10),
                    borderBottomRightRadius: scaledValue(10),
                  },
                ]}
                key={i}>
                <TouchableOpacity onPress={() => onChoose(c)}>
                  <Text style={styles.menuTitle(c?.textColor)}>
                    {c[titleKey]}
                  </Text>
                </TouchableOpacity>
              </View>
            ),
          )}
        </View>
        <View
          style={[
            styles.menuView,
            {marginVertical: 10, borderRadius: scaledValue(10)},
          ]}>
          <TouchableOpacity
            onPress={() => {
              if (props.onPressCancel) {
                props.onPressCancel();
              } else {
                refRBSheet.current.close();
              }
            }}>
            <Text
              style={[
                styles.menuTitle(colors.blue),
                {color: colors.blue, fontFamily: fonts?.SUSE_SEMIBOLD},
              ]}>
              {props?.cancelTitle || 'Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </RBSheet>
  );
};
export default OptionMenuSheet;

const styles = StyleSheet.create({
  menuTitle: textColor => ({
    fontSize: getFontSize(18),
    color: textColor ? textColor : colors.blue,
    fontFamily: fonts?.SUSE_MEDIUM,
    textAlign: 'center',
    lineHeight: scaledValue(21.48),
  }),
  menuView: {
    height: 60,
    backgroundColor: '#FFF4EC',
    justifyContent: 'center',
  },
});
