import {
  Dimensions,
  FlatList,
  Image,
  ScrollView,
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
import GButton from '../../../../../components/GButton';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../../redux/store/storeUtils';
import {scaledValue} from '../../../../../utils/design.utils';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
import useDataFactory from '../../../../../components/UseDataFactory/useDataFactory';
import {transformDocuments} from '../../../../../helpers/transformDocuments';
import GImage from '../../../../../components/GImage';
import Spinner from 'react-native-loading-spinner-overlay';
import {opacity} from 'react-native-reanimated/lib/typescript/Colors';
import {
  delete_medical_record_api,
  get_medical_folders,
} from '../../../../../redux/slices/medicalRecordSlice';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';

const MedicalRecordHome = ({navigation}) => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const petList = useAppSelector(state => state.pets?.petLists);
  const [selectedPet, setSelectedPet] = useState(petList[0]);
  const folderList = useAppSelector(state => state.medicalRecord.folderList);
  const refRBSheet = useRef();

  const [selectedRecord, setSelectRecord] = useState({});
  const [activeTab, setActiveTab] = useState('Unread Records');

  useEffect(() => {
    dispatch(
      get_medical_folders({
        petId: petList[0]?.id,
      }),
    );
  }, [dispatch]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.Folder}
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

  const {
    loading,
    data,
    setData,
    extraData,
    refreshData,
    loadMore,
    Placeholder,
    Loader,
  } = useDataFactory(
    activeTab === 'Unread Records'
      ? 'get_unread_medical_reccords'
      : 'get_medical_reccords',
    false,
    {},
    'GET',
  );

  const deleteMedicalRecord = id => {
    dispatch(delete_medical_record_api({recordId: id})).then(res => {
      if (delete_medical_record_api.fulfilled.match(res)) {
        const filteredEntries = data?.entry?.filter(
          item => item?.resource?.id !== id,
        );
        setData(filteredEntries);

        setSelectRecord({});
      }
    });
  };

  useEffect(() => {
    dispatch(
      get_medical_folders({
        petId: petList[0]?.id,
      }),
    );
  }, [petList]);

  const RecordItem = ({item}) => {
    const containerWidth = scaledValue(311);
    const containerHeight = scaledValue(78);
    const minImageWidth = scaledValue(25);
    let imageWidth =
      containerWidth /
        (item?.attachments?.length > 1 ? item?.attachments?.length + 0.3 : 1) +
      15; // 15 adjusts overlap look

    if (imageWidth < minImageWidth) imageWidth = minImageWidth;

    const overlapAmount = imageWidth * 0.4; // 40% overlap
    const remainingWidth =
      containerWidth -
      (item?.attachments?.length - 1) * (imageWidth - overlapAmount);

    return (
      <TouchableOpacity
        onPress={() => {
          navigation?.navigate('ViewRecordFiles', {
            recordDetail: item,
          });
        }}
        style={styles.recordItemContainer}>
        {/* <View style={styles.recordHeader}>
          <Image source={Images.DoctorImg} style={styles.doctorImage} />
          <View style={styles.recordTextSection}>
            <GText GrMedium text={item?.name} style={styles.doctorName} />
            <GText SatoshiBold text={item?.department} style={styles.subText} />
            <GText
              SatoshiBold
              text={item?.qualification}
              style={styles.subText}
            />
            <GText
              SatoshiBold
              componentProps={{numberOfLines: 1}}
              text={item?.hospital}
              style={styles.subText}
            />
          </View>
          <Menu style={styles.menuView}>
            <MenuTrigger style={styles.menuTriggerView}>
              <View style={styles.dotView}>
                <Image source={Images.ThreeDots} style={styles.threeDot} />
              </View>
            </MenuTrigger>
            <MenuOptions
              customStyles={{
                optionsWrapper: styles.optionsWrapper,
                optionsContainer: styles.optionsContainer,
              }}>
              <MenuOption
                style={styles.menuOption}
                onSelect={() => {
                  navigation?.navigate('CreateFolder');
                }}>
                <Image source={Images.penBold} style={styles.editImg} />
                <GText
                  GrMedium
                  style={styles.editText}
                  text={t('create_new_folder_string')}
                />
              </MenuOption>
              <View style={styles.menuDivider} />
              <MenuOption style={styles.menuOption} onSelect={() => {}}>
                <Image source={Images.deleteBold} style={styles.editImg} />
                <GText
                  GrMedium
                  style={styles.editText}
                  text={t('place_folder_string')}
                />
              </MenuOption>
            </MenuOptions>
          </Menu>
        </View> */}
        {/* <View style={styles.dateContainer}>
          <Image source={Images.Calender} style={styles.dateIcon} />
          <GText GrMedium text={item?.day} style={styles.dateText} />
        </View> */}
        <Menu
          style={[
            styles.menuView,
            {position: 'absolute', right: 0, top: scaledValue(5)},
          ]}>
          <MenuTrigger style={styles.menuTriggerView}>
            <View style={styles.dotView}>
              <Image source={Images.ThreeDots} style={styles.threeDot} />
            </View>
          </MenuTrigger>
          <MenuOptions
            customStyles={{
              optionsWrapper: styles.optionsWrapper,
              optionsContainer: styles.optionsContainer,
            }}>
            <MenuOption
              style={styles.menuOption}
              onSelect={() => {
                navigation?.navigate('CreateFolder');
              }}>
              <Image source={Images.PlusBold} style={styles.editImg} />
              <GText
                GrMedium
                style={styles.editText}
                text={t('create_new_folder_string')}
              />
            </MenuOption>
            <View style={styles.menuDivider} />
            <MenuOption style={styles.menuOption} onSelect={() => {}}>
              <Image source={Images.deleteBold} style={styles.editImg} />
              <GText
                GrMedium
                style={styles.editText}
                text={t('place_folder_string')}
              />
            </MenuOption>
            <View style={styles.menuDivider} />
            <MenuOption style={styles.menuOption} onSelect={() => {}}>
              <Image source={Images.Edit} style={styles.editImg} />
              <GText
                GrMedium
                style={styles.editText}
                text={t('edit_folder_string')}
              />
            </MenuOption>
            <View style={styles.menuDivider} />
            <MenuOption
              style={styles.menuOption}
              onSelect={() => {
                deleteMedicalRecord(item?.id);
              }}>
              <Image source={Images.deleteBold} style={styles.editImg} />
              <GText
                GrMedium
                style={styles.editText}
                text={t('delete_folder_string')}
              />
            </MenuOption>
          </MenuOptions>
        </Menu>
        <View style={styles.recordFooter}>
          <GText GrMedium text={item?.description} style={styles.recordName} />
          <GImage image={item?.petImageUrl} style={styles.kiziIcon} />
        </View>

        <View
          style={[
            styles.container,
            {width: containerWidth, height: containerHeight},
          ]}>
          {item?.attachments?.map((i, index) => {
            const isLast = index === item?.attachments?.length - 1;
            const width = isLast ? remainingWidth : imageWidth;
            return (
              <GImage
                backgroundMode={true}
                image={i?.url}
                content={() => (
                  <>
                    <View
                      style={{
                        width: scaledValue(28),
                        height: scaledValue(28),
                        backgroundColor: colors.paletteBlue,
                        alignSelf: 'flex-end',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: scaledValue(1),
                        borderColor: colors.jetBlack50,
                        borderRadius: scaledValue(2),
                      }}>
                      <Image
                        source={Images.attachmentFill}
                        style={{
                          width: scaledValue(14),
                          height: scaledValue(14),
                        }}
                      />
                      <GText
                        SatoshiBold
                        text={item?.attachments?.length}
                        style={{fontSize: scaledValue(13), opacity: 0.7}}
                      />
                    </View>
                  </>
                )}
                fullImageStyle={[
                  styles.recordFrame,
                  {
                    width,
                    height: containerHeight,
                    left: index * (imageWidth - overlapAmount),
                  },
                ]}
              />
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.dashboardMainView}>
      <SearchBar t={t} />
      <View style={styles.tabContainer}>
        {['Unread Records', 'All Records'].map(tab => (
          <TouchableOpacity
            disabled={activeTab === tab}
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              refreshData({});
            }}
            style={styles.tabButton}>
            <GText GrMedium text={t(`${tab}`)} style={styles.tabText} />
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView>
        <View style={styles.fileListContainer}>
          <FlatList
            data={
              // activeTab === 'Unread Records'
              //   ? unRead
              //   :
              transformDocuments(data?.entry)
            }
            ListEmptyComponent={() => {
              return (
                <>
                  {activeTab === 'Unread Records' && (
                    <View style={styles.emptyContainer}>
                      <Image
                        source={Images.noRecords}
                        style={styles.emptyImage}
                      />
                      <GText
                        GrMedium
                        text="Meow-nothing here."
                        style={styles.emptyTitle}
                      />
                      <GText
                        text="Add insurance slips, invoices, or anything your vet might need later."
                        style={styles.emptySubtitle}
                      />
                    </View>
                  )}
                </>
              );
            }}
            contentContainerStyle={styles.fileListContentContainer}
            ListFooterComponent={() => {
              return (
                <>
                  {activeTab !== 'Unread Records' && (
                    <>
                      <View
                        style={{
                          // marginTop: scaledValue(10),
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: scaledValue(9),
                        }}>
                        <GText
                          GrMedium
                          style={{
                            fontSize: scaledValue(23),
                            letterSpacing: scaledValue(23 * -0.01),
                          }}
                          text={`${t('medical_record_of_string')}${
                            selectedPet?.name
                          }`}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            refRBSheet?.current?.open();
                          }}
                          activeOpacity={0.7}
                          style={styles.petButton}>
                          <GImage
                            image={selectedPet?.petImages}
                            style={styles.catImage}
                          />
                          <Image
                            source={Images.ArrowDown}
                            style={styles.arrowImage}
                          />
                        </TouchableOpacity>
                      </View>
                      <FlatList
                        data={folderList?.data}
                        style={{
                          gap: scaledValue(16),
                          marginTop: scaledValue(16),
                        }}
                        renderItem={FileItem}
                      />
                    </>
                  )}
                </>
              );
            }}
            renderItem={
              ({item}) => (
                // activeTab === 'Unread Records' ? (
                <RecordItem item={item} />
              )
              // ) : (
              //   <FileItem item={item} />
              // )
            }
          />
        </View>
        <GButton
          onPress={() =>
            navigation?.navigate('StackScreens', {screen: 'AddNewDocument'})
          }
          icon={Images.PlusIcon}
          iconStyle={styles.buttonIcon}
          title={t('add_new_record_string')}
          textStyle={styles.buttonText}
          style={styles.button}
        />
      </ScrollView>
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        options={petList}
        onChoose={val => {
          setSelectedPet(val);

          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
      <Spinner
        visible={loading}
        // indicatorStyle={{color: '#CF52C1'}}
      />
    </View>
  );
};

const SearchBar = ({t}) => (
  <TouchableOpacity style={styles.searchBarContainer}>
    <GText
      text={t('search_through_records_string')}
      style={styles.searchBarText}
    />
    <Image source={Images.Search} style={styles.searchBarIcon} />
  </TouchableOpacity>
);

const filesArray = [
  {title: 'passport', img: Images.Passport},
  {
    title: 'certificates',
    img: Images.Certificates,
  },
  {
    title: 'vet visits',
    img: Images.VetVisit,
  },
  {title: 'invoices', img: Images.Invoice},
  {title: 'lab tests', img: Images.LabTest},
  {
    title: 'prescriptions',
    img: Images.PrescriptionImg,
  },
  {
    title: 'insurance',
    img: Images.Insurance,
  },
  {title: 'others', img: Images.Others},
];

const getImageForFolder = folderName => {
  const match = filesArray?.find(
    f => f?.title?.toLowerCase() === folderName?.toLowerCase(),
  );
  return match?.img || Images.Others; // fallback to "Others"
};

const FileItem = ({item}) => {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.fileItemContainer}>
      <View
        style={{
          marginLeft: scaledValue(16),
        }}>
        <Image
          source={getImageForFolder(item?.folderName)}
          style={styles.fileItemImage}
        />
      </View>
      <View style={styles.fileItemTextContainer}>
        <GText GrMedium text={item?.folderName} style={styles.fileItemTitle} />
        <GText
          SatoshiBold
          text={`${item?.fileCount || 0} ${
            item?.fileCount > 1 ? 'files' : 'file'
          }`}
          style={styles.fileItemSubtitle}
        />
      </View>
    </TouchableOpacity>
  );
};

export default MedicalRecordHome;
