import {
  Dimensions,
  FlatList,
  Image,
  ScrollView,
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
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../../redux/store/storeUtils';
import {scaledValue} from '../../../../../utils/design.utils';
import debounce from 'lodash.debounce';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import GImage from '../../../../../components/GImage';
import Input from '../../../../../components/Input';
import {TextInput} from 'react-native-paper';
import GButton from '../../../../../components/GButton';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {create_medical_folders} from '../../../../../redux/slices/medicalRecordSlice';
import useDataFactory from '../../../../../components/UseDataFactory/useDataFactory';
import {formatDate} from '../../../../../utils/constants';
import {showToast} from '../../../../../components/Toast';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';

const CreateFolder = ({navigation}) => {
  const {t} = useTranslation();
  const petList = useAppSelector(state => state.pets?.petLists);
  const [searchFile, setSearchFile] = useState('');
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [folderName, setFolderName] = useState('');
  const [selectedPet, setSelectedPet] = useState(petList[0]);
  const [selectedMedicalRecord, setSelectedMedicalRecord] = useState([]);
  const refRBSheet = useRef();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, []);

  const create_folder = () => {
    const input = {
      caseFolderName: folderName,
      petId: selectedPet?.id,
      medicalRecords: selectedMedicalRecord?.map(item => item._id),
    };
    console.log('inputinput', JSON.stringify(input));

    dispatch(create_medical_folders(input));
  };

  const {
    loading: loading,
    data,
    setData,
    refreshData,
    loadMore,
    Placeholder,
    Loader,
  } = useDataFactory(
    'searchMedicalRecordByName',
    true,
    {
      name: searchFile || '',
    },
    'GET',
  );

  const debouncedSearch = debounce(text => {
    setSearchFile(text);
    refreshData({name: text});
  }, 600);

  return (
    <>
      <ScrollView style={styles.dashboardMainView}>
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
            <GImage image={selectedPet?.petImages} style={styles.catImage} />
            <Image source={Images.ArrowDown} style={styles.arrowImage} />
          </TouchableOpacity>
        </View>
        <Input
          label={t('folder_name_string')}
          value={folderName}
          onChangeText={text => {
            setFolderName(text);
          }}
          style={styles.inputStyle}
        />
        {selectedMedicalRecord?.length > 0 && (
          <View style={{marginTop: scaledValue(23), gap: scaledValue(15)}}>
            {selectedMedicalRecord?.map((i, d) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {}}
                style={{paddingHorizontal: scaledValue(16)}}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}>
                  <View>
                    <GText
                      GrMedium
                      text={i?.title}
                      style={{fontSize: scaledValue(16), color: '#000'}}
                    />
                    <GText
                      SatoshiBold
                      text={formatDate(i?.createdAt, 'long')}
                      style={{
                        fontSize: scaledValue(11),
                        color: colors.jetBlack300,
                      }}
                    />
                  </View>
                  <GImage
                    image={i?.medicalDocs[0]?.url}
                    style={{
                      width: scaledValue(32),
                      height: scaledValue(32),
                      right: scaledValue(4),
                    }}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
            value={searchFile}
            onChangeText={text => {
              setSearchFile(text);
              debouncedSearch(text);
            }}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholder="Search File Name"
            selectionColor={colors.inputPlaceholder}
            style={{backgroundColor: 'transparent', height: scaledValue(24)}}
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
          {data?.length > 0 && (
            <View
              style={{
                borderWidth: scaledValue(0.8),
                borderColor: colors.jetBlack50,
                marginBottom: scaledValue(11),
              }}
            />
          )}

          <FlatList
            data={data}
            renderItem={({item, index}) => {
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    const exists = selectedMedicalRecord.some(
                      record => record?._id === item?._id,
                    );
                    if (exists) {
                      showToast(0, 'This record already exists!');
                    } else {
                      setSelectedMedicalRecord(prev => [...prev, item]);
                      refreshData({
                        name: '',
                      });
                    }
                  }}
                  style={{paddingHorizontal: scaledValue(16)}}>
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
                        text={formatDate(item?.createdAt, 'long')}
                        style={{
                          fontSize: scaledValue(11),
                          color: colors.jetBlack300,
                        }}
                      />
                    </View>
                    <GImage
                      image={item?.medicalDocs[0]?.url}
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
                        index !== data?.length - 1 && scaledValue(0.8),
                      borderColor: colors.jetBlack50,
                      marginVertical: scaledValue(10),
                    }}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <OptionMenuSheet
          refRBSheet={refRBSheet}
          options={petList}
          onChoose={val => {
            setSelectedPet(val);

            refRBSheet.current.close();
          }}
          onPressCancel={() => refRBSheet.current.close()}
        />
      </ScrollView>
      <GButton
        onPress={() => {
          create_folder();
        }}
        title={'Create Folder'}
        icon={Images.tickImage}
        iconStyle={{width: scaledValue(20), height: scaledValue(20)}}
        style={{
          gap: scaledValue(8),
          position: 'absolute',
          bottom: insets.bottom + 30,
          width: Dimensions.get('window').width - scaledValue(40),
          alignSelf: 'center',
        }}
      />
    </>
  );
};

export default CreateFolder;
