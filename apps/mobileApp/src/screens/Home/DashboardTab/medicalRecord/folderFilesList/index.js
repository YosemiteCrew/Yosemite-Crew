import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect} from 'react';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import {styles} from './styles';
import useDataFactory from '../../../../../components/UseDataFactory/useDataFactory';
import {transformDocuments} from '../../../../../helpers/transformDocuments';
import {
  Menu,
  MenuOption,
  MenuOptions,
  MenuTrigger,
} from 'react-native-popup-menu';
import GImage from '../../../../../components/GImage';
import {useTranslation} from 'react-i18next';
import {useAppDispatch} from '../../../../../redux/store/storeUtils';

const FolderFilesList = ({navigation, route}) => {
  const {recordList, folderName} = route?.params;
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
      headerTitle: () => (
        <GText
          GrMedium
          text={folderName}
          style={{
            fontSize: scaledValue(20),
            letterSpacing: scaledValue(20 * -0.01),
            textTransform: 'capitalize',
          }}
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
    'get_medical_recordBy_folder_id',
    false,
    {
      folderId: recordList?._id,
    },
    'GET',
  );

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
            screen: 'FolderFilesList',
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
                // deleteMedicalRecord(item?.id);
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
  console.log('abcbcbc', JSON.stringify(transformDocuments(data?.entry)));

  return (
    <View style={styles.dashboardMainView}>
      <FlatList
        data={transformDocuments(data?.entry)}
        ListEmptyComponent={() => {
          return (
            <>
              <View style={styles.emptyContainer}>
                <Image source={Images.noRecords} style={styles.emptyImage} />
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
            </>
          );
        }}
        contentContainerStyle={styles.fileListContentContainer}
        renderItem={({item}) => <RecordItem item={item} />}
      />
    </View>
  );
};

export default FolderFilesList;
