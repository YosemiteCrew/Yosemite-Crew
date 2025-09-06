import React, {useState, useEffect} from 'react';
import {ScrollView, View, TouchableOpacity, TextInput} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import GText from '../GText/GText';

const GOptions = props => {
  const refRBSheet = props.refRBSheet;
  const title = props.title || 'Choose';
  const options = props.options || [];
  const onChoose = props.onChoose || null;
  const titleKey = props.titleKey || 'name';
  const idKey = props.idKey || '_id';
  const [optionsCount, setOptionsCount] = useState(20);

  const searchVisible = props.search ? true : false;

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
    setFilteredOptions(
      options.filter(o =>
        o[titleKey].toLowerCase().includes(search.trim().toLowerCase()),
      ),
    );
    // setFilteredOptions(
    //   options.filter(o => o[titleKey].includes(search.trim())),
    // );
  }, [search, props]);

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
          borderTopLeftRadius: 15,
          borderTopRightRadius: 15,
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
        <View style={{paddingVertical: 20, paddingHorizontal: 20}}>
          <GText
            medium
            text={title}
            style={{
              marginBottom: 20,
            }}
          />

          {searchVisible && (
            <TextInput
              placeholder="Search.."
              placeholderTextColor="rgba(106, 113, 135, 1)"
              style={{
                padding: 10,
                marginVertical: 5,
                fontSize: 13,
                color: '#171717',
                // fontFamily: 'OpenSans-Regular',
                borderRadius: 10,
                backgroundColor: '#eee',
              }}
              onChangeText={text => setSearch(text)}
            />
          )}
          {filteredOptions.length === 0 && (
            <GText
              style={{
                textAlign: 'center',
                marginTop: 100,
              }}
              text={'Country selection is currently unavailable.'}
            />
          )}
          {filteredOptions.slice(0, optionsCount).map((c, i) => (
            <TouchableOpacity key={i} onPress={() => onChoose(c)}>
              <Option title={c[titleKey]} emoji={c.emoji || '❓'} />
              <View
                style={{
                  height: 1,
                  backgroundColor: '#ddd',
                  marginVertical: 5,
                  // marginLeft: 10,
                }}></View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </RBSheet>
  );
};

export default GOptions;

const Option = ({title, emoji}) => {
  return (
    <View
      style={{
        height: 60,
        alignContent: 'center',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <GText manSemiBold text={emoji + `  ${title}`} />
    </View>
  );
};
