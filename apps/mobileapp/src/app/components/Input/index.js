import {
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useRef, useState} from 'react';

import {HelperText, TextInput, useTheme} from 'react-native-paper';
import {
  getFontSize,
  scaledHeightValue,
  scaledValue,
} from '../../utils/design.utils';
import {colors} from '../../../assets/colors';
import {fonts} from '../../utils/fonts';
import GText from '../GText/GText';
import {Images} from '../../utils';
import {CountryPicker} from 'react-native-country-codes-picker';

const Input = props => {
  const theme = useTheme();
  const inputRef = useRef(null); // Create a ref for the TextInput
  const [isFocused, setIsFocused] = useState(false); // State to manage focus
  const {isShowPhone, setCountryCode, countryCode, formValue} = props;
  const [showCountry, setShowCountry] = useState(false);
  const [countryDialCode, setCountryDialCode] = useState(countryCode);
  const [countryFlag, setCountryFlag] = useState('🇺🇸');
  const [focus, setFocus] = useState(false);
  const handleFocus = () => {
    setIsFocused(true);
    if (props.onFocus) props.onFocus();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (props.onBlur) props.onBlur();
  };
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        {isShowPhone && (
          <TouchableOpacity
            onPress={() => {
              setShowCountry(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth:
                focus || props.value ? scaledValue(1) : scaledValue(0.5),
              height: scaledValue(49),
              // marginTop: scaledValue(20),
              width: scaledValue(117),
              borderRadius: scaledValue(24),
              justifyContent: 'center',
              borderColor: focus || props.value ? '#DF9C51' : '#312943',
              marginTop: scaledValue(5),
            }}>
            <GText
              text={countryFlag}
              style={{
                color: '#312943',
                fontSize: scaledValue(16),
                lineHeight: scaledHeightValue(21.79),
                letterSpacing: scaledValue(16 * 0.01),
              }}
            />
            <GText
              SatoshiBold
              text={countryDialCode}
              style={{
                color: '#312943',
                fontSize: scaledValue(16),
                lineHeight: scaledHeightValue(19.2),
                letterSpacing: scaledValue(16 * -0.02),
                marginLeft: scaledValue(8),
                marginRight: scaledValue(8),
              }}
            />
            <Image
              source={Images.ArrowDown}
              style={{
                width: scaledValue(20),
                height: scaledValue(20),
                // marginLeft: scaledValue(14),
              }}
            />
            {/* <Image source={Images.Line} style={styles.lineImage} /> */}
          </TouchableOpacity>
        )}
        <TextInput
          placeholder={props.placeholder}
          ref={inputRef}
          onPress={props?.onPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={props?.onSubmitEditing}
          returnKeyType={props?.returnKeyType}
          disabled={props.disabled}
          numberOfLines={props.numberOfLines}
          multiline={props.multiline}
          editable={props.editable}
          mode={props.mode ? props.mode : 'outlined'}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize}
          label={
            <GText
              text={props?.label}
              style={{
                fontSize:
                  isFocused || props.value ? scaledValue(14) : scaledValue(16),
                fontFamily:
                  isFocused || props.value
                    ? fonts?.SATOSHI_BOLD
                    : fonts?.SATOSHI_REGULAR,
                lineHeight: scaledHeightValue(16),
                letterSpacing: scaledValue(16 * -0.03),
                color: isFocused || props.value ? '#DF9C51' : '#312943',
              }}
            />
          }
          value={props.value}
          outlineStyle={
            props.outlineStyle
              ? props.outlineStyle
              : {
                  borderWidth:
                    isFocused || props.value
                      ? scaledValue(1)
                      : scaledValue(0.5),
                }
          }
          onChangeText={props.onChangeText}
          style={[styles.inputField, props.style]}
          contentStyle={props.contentStyle}
          underlineColor={props.underlineColor}
          secureTextEntry={props.secureTextEntry}
          outlineColor={
            props?.outlineColor || props.value || isFocused
              ? colors.primary
              : '#312943'
          }
          // onLayout={handleLayout1}
          theme={{
            roundness: scaledValue(24),
            colors: {
              background: props.themeBackground
                ? props.themeBackground
                : colors.themeColor,
              onSurfaceVariant: '#312943',
              primary: props.visible
                ? '#FF3B30'
                : props.validPassVisible
                ? '#34C759'
                : props.matchPassVisible
                ? '#FF3B30'
                : props.successPassVisible
                ? '#34C759'
                : props.errorEmail
                ? '#FF3B30'
                : colors.primary,
            },
            fonts: {
              medium: {
                fontSize: scaledValue(12),
              },
            },
          }}
          // right={
          //   props?.rightIcon && (
          //     <TextInput.Icon
          //       icon={props.rightIcon}
          //       size={scaledValue(24)}
          //       onPress={props.onPress}
          //       iconColor="#212121"
          //       // onLayout={handleLayout}
          //       style={{top: 3}} // top is hard coded for textinput height less than 48 but not conatin any check
          //     />
          //   )
          // }
          left={
            props?.leftIcon ? (
              <TextInput.Icon
                icon={() => (
                  <Image
                    source={props?.leftIcon}
                    style={props?.iconLeftStyle}
                    on
                  />
                )}
              />
            ) : (
              props?.leftIcon && (
                <TextInput.Affix
                  text={props?.leftText}
                  textStyle={[styles.textLeftStyle, props?.leftTextStyle]}
                />
              )
            )
          }
          right={
            props?.rightIcon ? (
              <TextInput.Icon
                icon={() => (
                  <TouchableOpacity onPress={props?.rightIconPress}>
                    <Image source={props?.rightIcon} style={props?.iconStyle} />
                  </TouchableOpacity>
                )}
              />
            ) : (
              props?.rightText && (
                <TextInput.Affix
                  text={props?.rightText}
                  textStyle={[styles.textRightStyle, props?.rightTextStyle]}
                />
              )
            )
          }
        />
      </View>
      {props.visible && (
        <HelperText
          type="error"
          visible={props.visible}
          style={[
            styles.helperTextStyle,
            {
              color: '#FF3B30',
            },
            {
              width: props?.helperTextWidth
                ? scaledValue(props?.helperTextWidth)
                : '',
            },
          ]}>
          {
            'Password must contain 8-24 Alphanumeric characters, a capital, a symbol'
          }
        </HelperText>
      )}
      {props.validPassVisible && (
        <HelperText
          type="error"
          visible={props.validPassVisible}
          style={[
            styles.helperTextStyle,
            {
              color: '#34C759',
            },
            {
              width: props?.helperTextWidth
                ? scaledValue(props?.helperTextWidth)
                : '',
            },
          ]}>
          Now, that’s a secure password
        </HelperText>
      )}

      {props.matchPassVisible && (
        <HelperText
          type="error"
          visible={props.matchPassVisible}
          style={[
            styles.helperTextStyle,
            {
              color: '#FF3B30',
            },
            {
              width: props?.helperTextWidth
                ? scaledValue(props?.helperTextWidth)
                : '',
            },
          ]}>
          Wrong Password
        </HelperText>
      )}
      {props.successPassVisible && (
        <HelperText
          visible={props.successPassVisible}
          style={[
            styles.helperTextStyle,
            {
              color: '#34C759',
            },
            {
              width: props?.helperTextWidth
                ? scaledValue(props?.helperTextWidth)
                : '',
            },
          ]}>
          Yay both passwords match!
        </HelperText>
      )}

      {props.errorEmail && (
        <HelperText
          visible={props.errorEmail}
          style={[
            styles.helperTextStyle,
            {
              color: '#FF3B30',
            },
            {
              width: props?.helperTextWidth
                ? scaledValue(props?.helperTextWidth)
                : '',
            },
          ]}>
          Please use a valid email address
        </HelperText>
      )}
      <CountryPicker
        show={showCountry}
        onBackdropPress={() => setShowCountry(false)}
        style={{
          modal: {
            height: 500,
            backgroundColor: '#eee',
          },
          textInput: {
            color: colors.black,
          },
          dialCode: {
            color: colors.black,
          },
          countryName: {
            color: colors.black,
          },
        }}
        pickerButtonOnPress={item => {
          setCountryFlag(item?.flag);
          setFocus(true);
          setCountryDialCode(item.dial_code);
          setCountryCode({...formValue, countryCode: item?.dial_code});
          setShowCountry(false);
        }}
      />
    </>
  );
};

export default Input;

const styles = StyleSheet.create({
  inputField: {
    backgroundColor: 'white',
    height: scaledValue(48),
    fontFamily: fonts?.SATOSHI_MEDIUM,
  },
  helperTextStyle: {
    // marginTop: scaledValue(-24),
    // marginBottom: scaledValue(22),
    // fontFamily: fonts.SF_PRO_TEXT_REGULAR,
    fontSize: getFontSize(12),
    lineHeight: scaledValue(16),
    // backgroundColor: 'green',
  },
});
