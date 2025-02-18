import React, {useState, useEffect} from 'react';
import {
  Text,
  ScrollView,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import GText from '../GText/GText';
import GTextButton from '../GTextButton/GTextButton';
import {Images} from '../../utils';
import {scaledHeightValue, scaledValue} from '../../utils/design.utils';
import {fonts} from '../../utils/fonts';
import {colors} from '../../../assets/colors';

const styles = {
  container: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#FFFBFE',
    width: '95%',
    alignSelf: 'center',
    borderRadius: scaledValue(20),
  },
  headerText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
  },
  subHeaderText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    marginTop: scaledValue(4),
    color: colors.darkPurple,
  },
  searchInput: {
    padding: 10,
    marginVertical: 5,
    fontSize: 13,
    color: '#171717',
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  noOptionsText: {
    textAlign: 'center',
    marginTop: 100,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(55, 34, 60, 0.1)',
    width: scaledValue(375),
    alignSelf: 'center',
  },
  footer: {
    marginVertical: 10,
    borderRadius: scaledValue(10),
    justifyContent: 'center',
    height: scaledValue(56),
    backgroundColor: '#FFFBFE',
    flexDirection: 'row',
    alignItems: 'center',
    width: '95%',
    alignSelf: 'center',
  },
  cancelText: {
    color: '#007AFF',
    fontFamily: fonts.CLASH_DISPLAY_SEMIBOLD,
    textAlign: 'center',
    fontSize: scaledValue(17),
    letterSpacing: scaledValue(-0.043),
    lineHeight: scaledValue(22),
  },
  optionText: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
  },
  optionTextSelected: {
    color: '#D04122',
    fontFamily: fonts?.SATOSHI_BOLD,
  },
  optionTextUnselected: {
    color: '#37223C',
    fontFamily: fonts?.SATOSHI_REGULAR,
  },
  checkIcon: {
    height: scaledValue(20),
    width: scaledValue(20),
  },
};

const GMultipleOptions = props => {
  const refRBSheet = props.refRBSheet;
  const title = props.title || 'Choose';
  const options = props.options || [];
  const onChoose = props.onChoose || null;
  const value = props.value || [];
  const titleKey = props.titleKey || 'name';
  const idKey = props.idKey || '_id';
  const searchVisible = props.search ? true : false;
  const [optionsCount, setOptionsCount] = useState(20);
  const [search, setSearch] = useState('');
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
    <View style={{height: 60, flexDirection: 'row', alignItems: 'center'}}>
      <GTextButton
        disabled={true}
        titleStyle={[
          styles.optionText,
          value ? styles.optionTextSelected : styles.optionTextUnselected,
        ]}
        title={title}
      />
    </View>
  );

  return (
    <RBSheet
      ref={refRBSheet}
      height={500}
      closeOnDragDown={true}
      closeOnPressMask={true}
      onClose={() => setSearch('')}
      customStyles={{
        draggableIcon: {
          backgroundColor: '#ddd',
        },
        container: {
          backgroundColor: 'transparent',
        },
      }}>
      <ScrollView
        onScroll={({nativeEvent}) => {
          if (isCloseToBottom(nativeEvent)) {
            setOptionsCount(optionsCount + 20);
          }
        }}
        scrollEventThrottle={400}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={{alignItems: 'center', marginBottom: 20}}>
            <GText GrMedium text={title} style={styles.headerText} />
            <GText
              SatoshiRegular
              text={'Select all that apply'}
              style={styles.subHeaderText}
            />
          </View>
          {searchVisible && (
            <TextInput
              placeholder="Search.."
              placeholderTextColor="rgba(106, 113, 135, 1)"
              style={styles.searchInput}
              onChangeText={text => setSearch(text)}
            />
          )}
          {filteredOptions.length === 0 && (
            <GText
              style={styles.noOptionsText}
              text={'No city available for selected country.'}
            />
          )}
          <View style={styles.divider} />
          {filteredOptions.slice(0, optionsCount).map((c, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                if (value.includes(c?.name)) {
                  onChoose(value.filter(d => d !== c?.name));
                } else {
                  onChoose([...value, c?.name]);
                }
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <Option title={c[titleKey]} value={value.includes(c?.name)} />
                {props.multiSelect && (
                  <Image
                    style={styles.checkIcon}
                    source={
                      value.includes(c?.name)
                        ? Images.Check_fill
                        : Images.UnCheck
                    }
                  />
                )}
              </View>
              <View style={styles.divider} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => {
              if (props.onPressCancel) {
                props.onPressCancel();
              } else {
                refRBSheet.current.close();
              }
            }}>
            <Text style={styles.cancelText}>{'Cancel'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </RBSheet>
  );
};

export default GMultipleOptions;
