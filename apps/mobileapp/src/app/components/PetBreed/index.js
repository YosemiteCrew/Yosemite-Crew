import {
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import RBSheet from 'react-native-raw-bottom-sheet';
import {Images} from '../../utils';
import GText from '../GText/GText';
import {TextInput} from 'react-native-paper';
import GTextButton from '../GTextButton/GTextButton';
import GButton from '../GButton';
import {styles} from './styles';
import {useTranslation} from 'react-i18next';

const ChoosePetBreed = props => {
  const refRBSheet = props.refRBSheet;
  const petName = props.pet;
  const continuePress = props?.continuePress;
  const {t} = useTranslation();
  const [search, setSearch] = useState('');
  const [optionsCount, setOptionsCount] = useState(20);
  const onChoose = props.onChoose || null;
  const value = props.value || [];
  const options = props.options || [];
  const titleKey = props.titleKey || 'name';
  const [filteredOptions, setFilteredOptions] = useState(options);

  const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize}) => {
    const paddingToBottom = 20;
    return (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom
    );
  };

  useEffect(() => {
    setFilteredOptions(options.filter(o => o[titleKey].includes(search)));
  }, [search, options]);

  const Option = ({title, value}) => (
    <View style={styles.optionContainer}>
      <GTextButton
        disabled={true}
        titleStyle={[
          styles.optionText,
          value ? styles.optionTextSelected : styles.optionTextDefault,
        ]}
        title={title}
      />
    </View>
  );

  return (
    <RBSheet
      ref={refRBSheet}
      height={Dimensions.get('screen').height / 1.17}
      closeOnDragDown={true}
      closeOnPressMask={true}
      onClose={() => {
        setSearch('');
        onChoose(null);
      }}
      customStyles={{
        draggableIcon: {
          backgroundColor: '#ddd',
        },
        container: styles.rbsheetContainer,
      }}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={() => {
                onChoose(null);
                refRBSheet?.current?.close();
              }}
              style={styles.closeButton}>
              <Image source={Images.Close_Circle} style={styles.closeIcon} />
            </TouchableOpacity>
            <Image
              source={petName?.icon}
              resizeMode="contain"
              style={styles.dogImage}
            />
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
              placeholderTextColor={'#312943'}
              outlineStyle={styles.textInputOutline}
              style={styles.textInput}
              returnKeyType="search"
              onChangeText={text => setSearch(text)}
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
              {filteredOptions.slice(0, optionsCount).map((c, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    onChoose(c?.name);
                  }}>
                  <View style={styles.optionWrapper}>
                    <Option
                      title={c[titleKey]}
                      value={value.includes(c?.name)}
                    />
                    <Image
                      style={styles.optionImage}
                      source={
                        value === c?.name
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

          <GButton
            disabled={value?.length === 0}
            onPress={() => {
              continuePress();
            }}
            title={t('continue_string')}
            style={styles.continueButton}
            textStyle={styles.continueButtonText}
          />
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </RBSheet>
  );
};

export default ChoosePetBreed;
