import React, {useEffect, useState} from 'react';
import {
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import {TextInput} from 'react-native-paper';
import {Images} from '../../utils';
import GText from '../GText/GText';
import GButton from '../GButton';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';

const ChoosePetBreed = props => {
  const refRBSheet = props.refRBSheet;
  const petName = props.pet;
  const continuePress = props?.continuePress;
  const onChoose = props.onChoose || null;
  const value = props.value || [];
  const options = props.options || [];
  const titleKey = props.titleKey || 'name';
  const {t} = useTranslation();
  const [search, setSearch] = useState('');
  const [optionsCount, setOptionsCount] = useState(20);
  const [isFocused, setIsFocused] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(options);

  useEffect(() => {
    setFilteredOptions(options.filter(o => o[titleKey].includes(search)));
  }, [search, options]);

  const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize}) =>
    layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;

  const Option = ({title, selected}) => (
    <View style={styles.optionContainer}>
      <GText
        text={title}
        style={[
          styles.optionText,
          selected ? styles.optionTextSelected : styles.optionTextDefault,
        ]}
      />
    </View>
  );

  return (
    <RBSheet
      ref={refRBSheet}
      height={Dimensions.get('screen').height / 1.17}
      closeOnDragDown
      closeOnPressMask
      onClose={() => {
        setSearch('');
        onChoose(null);
      }}
      customStyles={{
        draggableIcon: {backgroundColor: '#ddd'},
        container: styles.rbsheetContainer,
      }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={() => {
                onChoose(null);
                refRBSheet?.current?.close();
              }}
              style={styles.closeButton}>
              <Image source={Images.Close_Circle} style={styles.closeIcon} />
            </TouchableOpacity>

            <GText
              GrMedium
              text={`${t('select_string')} ${petName?.title} ${t(
                'breed_string',
              )}`}
              style={styles.titleText}
            />

            <TextInput
              placeholder={t('search_breed_string')}
              mode="outlined"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              outlineStyle={styles.textInputOutline(isFocused)}
              style={styles.textInput(search)}
              returnKeyType="search"
              onChangeText={setSearch}
              right={
                <TextInput.Icon
                  icon={() => (
                    <Image source={Images.Search} style={styles.searchIcon} />
                  )}
                />
              }
            />
          </View>

          <ScrollView
            onScroll={({nativeEvent}) => {
              if (isCloseToBottom(nativeEvent)) {
                setOptionsCount(optionsCount + 20);
              }
            }}
            scrollEventThrottle={400}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.optionsContainer}>
              {filteredOptions.slice(0, optionsCount).map((item, i) => (
                <TouchableOpacity key={i} onPress={() => onChoose(item?.name)}>
                  <View style={styles.optionWrapper}>
                    <Option
                      title={item[titleKey]}
                      selected={value.includes(item?.name)}
                    />
                    <Image
                      style={styles.optionImage}
                      source={
                        value === item?.name
                          ? Images.Circle_Radio
                          : Images.Circle_Button
                      }
                    />
                  </View>
                  <View style={styles.separator} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.btnView}>
            <GButton
              disabled={value.length === 0}
              onPress={continuePress}
              title={t('confirm_button_string')}
              style={styles.continueButton}
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </RBSheet>
  );
};

export default ChoosePetBreed;
