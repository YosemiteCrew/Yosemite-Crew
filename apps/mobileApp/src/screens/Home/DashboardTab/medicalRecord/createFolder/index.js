import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {useTranslation} from 'react-i18next';
import {useAppSelector} from '../../../../../redux/store/storeUtils';
import {scaledValue} from '../../../../../utils/design.utils';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import GImage from '../../../../../components/GImage';
import Input from '../../../../../components/Input';
import {TextInput} from 'react-native-paper';
import GButton from '../../../../../components/GButton';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const CreateFolder = ({navigation}) => {
  const {t} = useTranslation();
  const petList = useAppSelector(state => state.pets?.petLists);
  const insets = useSafeAreaInsets();
  const [selectedPet, setSelectedPet] = useState(petList[0]);
  const refRBSheet = useRef();

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.jetBlack}
          onPress={() =>
            navigation?.navigate('StackScreens', {screen: 'Notifications'})
          }
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, []);

  const fileArray = [
    {
      title: 'Daily Check Up',
      date: '1 June 2024',
    },
    {
      title: 'Blood Report',
      date: '14 June 2024',
    },
    {
      title: 'Surgeries',
      date: '30 June 2024',
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <View
        style={{
          marginTop: scaledValue(30),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <GText
          GrMedium
          style={{
            fontSize: scaledValue(23),
            letterSpacing: scaledValue(23 * -0.01),
          }}
          text={`${t('medical_record_of_string')}${selectedPet?.name}`}
        />
        <TouchableOpacity
          onPress={() => {
            refRBSheet?.current?.open();
          }}
          activeOpacity={0.7}
          style={styles.button}>
          <GImage image={selectedPet?.petImage} style={styles.catImage} />
          <Image source={Images.ArrowDown} style={styles.arrowImage} />
        </TouchableOpacity>
      </View>
      <Input label={t('folder_name_string')} style={styles.inputStyle} />
      <View
        style={{
          borderWidth: scaledValue(1),
          marginTop: scaledValue(23),
          borderRadius: scaledValue(28),
          borderColor: colors.jetBlack50,
          paddingVertical: scaledValue(12),
        }}>
        <TextInput
          mode="flat"
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          placeholder="Search File Name"
          selectionColor={colors.inputPlaceholder}
          style={{backgroundColor: 'transparent'}}
          right={
            <TextInput.Icon
              icon={() => (
                <Image
                  source={Images.file_attach} // your local image
                  style={{width: scaledValue(24), height: scaledValue(24)}}
                  resizeMode="contain"
                />
              )}
            />
          }
        />
        <View
          style={{
            borderWidth: scaledValue(0.8),
            borderColor: colors.jetBlack50,
            marginBottom: scaledValue(11),
          }}
        />
        <FlatList
          data={fileArray}
          renderItem={({item, index}) => {
            return (
              <View style={{paddingHorizontal: scaledValue(16)}}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}>
                  <View>
                    <GText
                      GrMedium
                      text={item?.title}
                      style={{fontSize: scaledValue(16), color: '#000'}}
                    />
                    <GText
                      SatoshiBold
                      text={item?.date}
                      style={{
                        fontSize: scaledValue(11),
                        color: colors.jetBlack300,
                      }}
                    />
                  </View>
                  <Image
                    source={Images.recordFrame}
                    style={{
                      width: scaledValue(32),
                      height: scaledValue(32),
                      right: scaledValue(4),
                    }}
                  />
                </View>
                <View
                  style={{
                    borderWidth:
                      index !== fileArray?.length - 1 && scaledValue(0.8),
                    borderColor: colors.jetBlack50,
                    marginVertical: scaledValue(10),
                  }}
                />
              </View>
            );
          }}
        />
      </View>
      <GButton
        title={'Create Folder'}
        icon={Images.tickImage}
        iconStyle={{width: scaledValue(20), height: scaledValue(20)}}
        style={{
          gap: scaledValue(8),
          position: 'absolute',
          bottom: insets.bottom,
          width: '100%',
          alignSelf: 'center',
        }}
      />
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        options={petList}
        onChoose={val => {
          setSelectedPet(val);

          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </View>
  );
};

export default CreateFolder;
