import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import {Divider} from 'react-native-paper';
import {fonts} from '../../utils/fonts';
import {
  getFontSize,
  scaledHeightValue,
  scaledValue,
} from '../../utils/design.utils';
import GText from '../GText/GText';
import {colors} from '../../../assets/colors';

const OptionMenuSheet = props => {
  const refRBSheet = props.refRBSheet;
  const options = props.options || [];
  const onChoose = props.onChoose || null;
  const titleKey = props.titleKey || 'title';
  const headerTitle = props?.headerTitle;
  const headerSubTitle = props?.headerSubTitle;
  let optionsLength = options.length;
  const headerHeight = props.headerHeight || 0;

  return (
    <RBSheet
      ref={refRBSheet}
      height={
        props.height
          ? props.height
          : (optionsLength + 1) * 61 + 19 + headerHeight
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
        {headerTitle && (
          <View
            style={{
              backgroundColor: '#fff',
              height: 86,
              justifyContent: 'center',
            }}>
            <GText
              GrMedium
              text={headerTitle}
              style={styles.menuTitle(colors.darkPurple, 18)}
            />
            <GText
              SatoshiRegular
              text={headerSubTitle}
              style={styles.subTitle}
            />
          </View>
        )}

        <Divider />
        <View style={{borderRadius: scaledValue(10)}}>
          {options.map((c, i) =>
            i !== optionsLength - 1 ? (
              <React.Fragment key={i}>
                <View style={styles.menuView(c?.height)}>
                  <TouchableOpacity onPress={() => onChoose(c)}>
                    <Text style={styles.menuTitle(c?.textColor, c?.fontSize)}>
                      {c[titleKey]}
                    </Text>
                  </TouchableOpacity>
                  {c?.subTitle && (
                    <Text style={[styles.subTitle, props.subTitleStyle]}>
                      {c?.subTitle}
                    </Text>
                  )}
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
                <TouchableOpacity onPress={() => onChoose(c)}>
                  <Text style={styles.menuTitle(c?.textColor, c?.fontSize)}>
                    {c[titleKey]}
                  </Text>
                </TouchableOpacity>
              </View>
            ),
          )}
        </View>
        <View
          style={[
            styles.menuView(56),
            {
              marginVertical: scaledValue(10),
              borderRadius: scaledValue(10),
            },
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
                styles.menuTitle('#007AFF', 17),
                {color: '#007AFF', fontFamily: fonts.SF_PRO_TEXT_SEMIBOLD},
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
  menuTitle: (textColor, fontSize) => ({
    fontSize: fontSize ? getFontSize(fontSize) : getFontSize(18),
    color: textColor || '#707070',
    fontFamily: fonts.SF_PRO_TEXT_REGULAR,
    textAlign: 'center',
    lineHeight: scaledValue(21.6),
  }),
  menuView: height => ({
    height: height ? height : 60,
    backgroundColor: '#FFFBFE',
    justifyContent: 'center',
  }),
  subTitle: {
    textAlign: 'center',
    fontSize: scaledValue(14),
    color: '#3D3D3D',
    fontFamily: fonts.SATOSHI_REGULAR,
    lineHeight: scaledHeightValue(16.8),
  },
});
