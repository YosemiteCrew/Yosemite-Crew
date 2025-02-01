import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import {Divider} from 'react-native-paper';
import {fonts} from '../../utils/fonts';
import {getFontSize, scaledValue} from '../../utils/design.utils';

const MenuBottomSheet = props => {
  const refRBSheet = props.refRBSheet;
  const options = props.options || [];
  const onChoose = props.onChoose || null;
  const titleKey = props.titleKey || 'title';
  let optionsLength = options.length;

  return (
    <RBSheet
      ref={refRBSheet}
      height={props.height ? props.height : (optionsLength + 1) * 61 + 18}
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
        <View style={{borderRadius: scaledValue(10)}}>
          {options.map((c, i) =>
            i !== optionsLength - 1 ? (
              <React.Fragment key={i}>
                <View style={styles.menuView(c?.height)}>
                  <TouchableOpacity
                    onPress={() => onChoose(c)}
                    style={{
                      justifyContent: 'space-between',
                      alignItem: 'center',
                      flexDirection: 'row',
                    }}>
                    <Text style={styles.menuTitle(c?.textColor, c?.fontSize)}>
                      {c[titleKey]}
                    </Text>
                    <Image
                      source={c?.image}
                      style={{
                        width: scaledValue(24),
                        height: scaledValue(24),
                        // marginLeft: scaledValue(14),
                      }}
                    />
                  </TouchableOpacity>
                </View>
                <Divider />
              </React.Fragment>
            ) : (
              <View
                style={[
                  styles.menuView(c?.height),
                  {
                    borderBottomLeftRadius: scaledValue(10),
                    borderBottomRightRadius: scaledValue(10),
                  },
                ]}
                key={i}>
                <TouchableOpacity
                  onPress={() => onChoose(c)}
                  style={{
                    justifyContent: 'space-between',
                    alignItem: 'center',
                    flexDirection: 'row',
                  }}>
                  <Text style={styles.menuTitle(c?.textColor, c?.fontSize)}>
                    {c[titleKey]}
                  </Text>
                  <Image
                    source={c?.image}
                    style={{
                      width: scaledValue(24),
                      height: scaledValue(24),
                    }}
                  />
                </TouchableOpacity>
              </View>
            ),
          )}
        </View>
      </View>
    </RBSheet>
  );
};
export default MenuBottomSheet;

const styles = StyleSheet.create({
  menuTitle: (textColor, fontSize) => ({
    fontSize: fontSize ? getFontSize(fontSize) : getFontSize(18),
    color: textColor || '#707070',
    fontFamily: fonts.SATOSHI_BOLD,
    textAlign: 'center',
    lineHeight: scaledValue(19.2),
  }),
  menuView: height => ({
    height: height ? height : 60,
    backgroundColor: '#FFFBFE',
    paddingHorizontal: scaledValue(16),
    paddingVertical: scaledValue(13),
    justifyContent: 'center',
  }),
});
