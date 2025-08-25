import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import GImage from '../../../../../components/GImage';
import {useAppDispatch} from '../../../../../redux/store/storeUtils';
import {
  delete_medical_record_api,
  get_medical_record_by_id,
} from '../../../../../redux/slices/medicalRecordSlice';

const ViewRecordFiles = ({navigation, route}) => {
  const {recordDetail} = route?.params;
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedRecord, setSelectRecord] = useState({});
  const dispatch = useAppDispatch();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const handleLongPress = id => {
    if (selectedItems.length === 0) {
      // First selection
      setSelectedItems([id]);
    } else if (!selectedItems.includes(id)) {
      // Add new selection without removing the first one
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handlePress = id => {
    if (selectedItems.length > 0) {
      if (selectedItems.includes(id)) {
        // Deselect if already selected
        setSelectedItems(selectedItems.filter(item => item !== id));
      } else {
        // Select if not selected
        setSelectedItems([...selectedItems, id]);
      }
    }
  };

  useEffect(() => {
    dispatch(
      get_medical_record_by_id({
        id: recordDetail?.id,
      }),
    );
  }, []);

  const deleteMedicalRecord = () => {
    dispatch(delete_medical_record_api({recordId: selectedPet?.id})).then(
      res => {
        if (delete_medical_record_api.fulfilled.match(res)) {
          // const filteredEntries = petList.entry.filter(
          //   item => item.resource.id !== selectedPet?.id,
          // );
          // dispatch(
          //   updatePetList({
          //     ...petList,
          //     entry: filteredEntries,
          //     total: filteredEntries.length,
          //   }),
          // );
          setSelectedPet({});
        }
      },
    );
  };

  return (
    <View style={styles.dashboardMainView}>
      <GText
        GrMedium
        text={'Surgeries'}
        style={{
          fontSize: scaledValue(18),
          letterSpacing: scaledValue(18 * -0.01),
          marginTop: scaledValue(20),
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: scaledValue(4),
        }}>
        <GText
          SatoshiBold
          text={'Created:'}
          style={{
            fontSize: scaledValue(14),
            letterSpacing: scaledValue(14 * -0.02),

            color: '#37223C80',
          }}
        />
        <GText
          SatoshiBold
          text={` ${recordDetail?.createdDate}`}
          style={{
            fontSize: scaledValue(14),
            letterSpacing: scaledValue(14 * -0.02),
          }}
        />
      </View>
      <View style={{marginTop: scaledValue(38), gap: scaledValue(16)}}>
        {recordDetail?.attachments?.map((i, d) => {
          const isSelected = selectedItems?.includes(i?.url);
          return (
            <>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  {
                    backgroundColor: '#fff',
                  },
                ]}
                onLongPress={() => handleLongPress(i?.url)} // Select
                onPress={() => handlePress(i?.url)} // Deselect
                delayLongPress={300}>
                <View style={isSelected && {opacity: 0.4}}>
                  <GImage
                    backgroundMode={true}
                    image={i?.url}
                    fullImageStyle={{
                      width: scaledValue(334),
                      height: scaledValue(223),
                      borderRadius: scaledValue(1.6),
                      borderWidth: scaledValue(0.4),
                      borderColor: '#D1D1D6',
                    }}
                    content={() => (
                      <>
                        {/* {isSelected && (
                        <Image
                          source={Images.Check_fill}
                          style={{
                            width: scaledValue(24),
                            height: scaledValue(24),
                            marginLeft: scaledValue(2),
                            marginTop: scaledValue(5),
                            position: 'absolute',
                            left: 0,
                          }}
                        />
                      )} */}
                      </>
                    )}
                  />
                </View>
                {isSelected && (
                  <Image
                    source={Images.Check_fill}
                    style={{
                      width: scaledValue(24),
                      height: scaledValue(24),
                      marginLeft: scaledValue(2),
                      marginTop: scaledValue(5),
                      position: 'absolute',
                      left: 0,
                    }}
                  />
                )}
              </TouchableOpacity>
            </>
          );
        })}
      </View>
      <View style={styles.buttonsView}>
        <TouchableOpacity
          style={styles.buttonView}
          onPress={() => {
            // Handle share action
          }}>
          <View style={styles.greyBg}>
            <Image source={Images.Share} style={styles.shareIcon} />
          </View>
          <GText SatoshiBold style={styles.buttonsText} text="Share" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonView}
          onPress={() => {
            // Handle share action
          }}>
          <View style={styles.greyBg}>
            <Image source={Images.Edit} style={styles.editIcon} />
          </View>
          <GText SatoshiBold style={styles.buttonsText} text="Edit" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buttonView}
          onPress={() => {
            // Handle share action
          }}>
          <View style={styles.greyBg}>
            <Image source={Images.Trash} style={styles.trashIcon} />
          </View>
          <GText SatoshiBold style={styles.buttonsText} text="Delete" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ViewRecordFiles;
