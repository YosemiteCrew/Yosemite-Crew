import {FlatList, Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';
import Modal from 'react-native-modal';
import GButton from '../../../../../components/GButton';
import {scaledValue} from '../../../../../utils/design.utils';

const SharePetDutiesHome = ({navigation}) => {
  const refRBTaskStatusSheet = useRef();
  const {t} = useTranslation();
  const [visible, setVisible] = useState('false');

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.PlusBold}
          tintColor={colors.appRed}
          onPress={() => {}}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };
  const userList = [
    {
      id: 1,
      name: 'Sky',
      task: 3,
      img: Images.Sky,
    },
    {
      id: 2,
      name: 'Pika',
      task: 4,
      img: Images.Pika,
    },
  ];

  const taskList = [
    {
      id: 1,
      petImg: Images.Kizi,
      userImg: Images.Sky,
      title: 'Take Kizie for Walk',
      date: '20 Aug - 4:00PM',
      petName: 'Kizie',
      ownerName: 'Sky',
    },
    {
      id: 2,
      petImg: Images.Kizi,
      userImg: Images.Pika,
      title: 'Give Medicine',
      date: '21 Aug - 11:00AM',
      petName: 'Kizie',
      ownerName: 'Pika',
    },
    {
      id: 3,
      petImg: Images.CatImg,
      userImg: Images.Pika,
      title: 'Deworming',
      date: '25 Aug - 10:00AM',
      petName: 'Oscar',
      ownerName: 'Pika',
    },
    {
      id: 4,
      petImg: Images.CatImg,
      userImg: Images.Sky,
      title: 'Visit Vet',
      date: '27 Aug - 11:00AM',
      petName: 'Oscar',
      ownerName: 'Sky',
    },
  ];

  const taskStatusList = [
    {
      id: 1,
      title: 'Take Kizie for Walk',
      subTitle: 'Update Task Status',
      textColor: '#37223C',
      height: 69,
      fontSize: 18,
      action: () => {},
    },
    {
      id: 2,
      title: 'Completed',
      subTitle: '',
      textColor: '#007AFF',
      height: 56,
      fontSize: 17,
      action: () => {},
    },
    {
      id: 3,
      title: 'Skip',
      subTitle: '',
      textColor: '#007AFF',
      height: 56,
      fontSize: 17,
      action: () => {},
    },
    {
      id: 4,
      title: 'Edit Task',
      subTitle: '',
      textColor: '#007AFF',
      height: 56,
      fontSize: 17,
      action: () => {},
    },
  ];

  return (
    <>
      <View style={styles.dashboardMainView}>
        <View style={styles.userListContainer}>
          <View>
            <FlatList
              data={userList}
              horizontal
              contentContainerStyle={styles.userListContentContainer}
              renderItem={({item, index}) => {
                return (
                  <View style={styles.userItem}>
                    <Image source={item?.img} style={styles.userImage} />
                    <GText
                      SatoshiBold
                      text={item?.name}
                      style={styles.userNameText}
                    />
                    <GText
                      SatoshiBold
                      text={`${item?.task} Tasks`}
                      style={styles.userTaskText}
                    />
                  </View>
                );
              }}
            />
          </View>
          <View style={styles.addCoOwnerContainer}>
            <TouchableOpacity
              onPress={() => {
                navigation?.navigate('StackScreens', {
                  screen: 'AddNewTask',
                });
              }}>
              <Image source={Images.EmptyCircle} style={styles.userImage} />
            </TouchableOpacity>
            <GText
              SatoshiBold
              text={'Add\nCo-owner'}
              style={styles.addCoOwnerText}
            />
          </View>
        </View>
        <View style={styles.headerRow}>
          <GText GrMedium text={`24`} style={styles.ongoingText} />
          <GText
            GrMedium
            text={` ${t('upcoming_tasks_string')}`}
            style={styles.plansText}
          />
        </View>
        <FlatList
          data={taskList}
          contentContainerStyle={styles.userListContentContainer}
          renderItem={({item, index}) => {
            return (
              <TouchableOpacity
                onPress={() => setVisible(true)}
                style={styles.taskItemContainer}>
                <View style={styles.taskInnerView}>
                  <View style={styles.taskItemContent}>
                    <View style={{flexDirection: 'row'}}>
                      <Image
                        source={item?.petImg}
                        style={styles.taskPetImage}
                      />
                      <Image
                        source={item?.userImg}
                        style={styles.taskUserImage}
                      />
                    </View>
                    <View style={styles.taskItemDetails}>
                      <GText
                        GrMedium
                        text={item?.title}
                        style={styles.taskTitle}
                      />
                      <GText
                        SatoshiBold
                        text={item?.date}
                        style={styles.taskDate}
                      />
                      <View style={styles.taskInfoRow}>
                        <View style={styles.taskInfoItem}>
                          <GText
                            SatoshiBold
                            text={'Pet: '}
                            style={styles.taskInfoLabel}
                          />
                          <GText
                            SatoshiBold
                            text={item?.petName}
                            style={styles.taskInfoValue}
                          />
                        </View>
                        <View style={styles.taskDotSeparator} />
                        <View style={styles.taskInfoItem}>
                          <GText
                            SatoshiBold
                            text={'Assigned to: '}
                            style={styles.taskInfoLabel}
                          />
                          <GText
                            SatoshiBold
                            text={item?.ownerName}
                            style={styles.taskInfoValue}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => refRBTaskStatusSheet.current.open()}
                    hitSlop={styles.hitSlop}>
                    <Image
                      source={Images.ThreeDots}
                      style={styles.taskMenuIcon}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
        <Modal isVisible={visible} onBackdropPress={() => setVisible(false)}>
          <View style={styles.modalContainer}>
            <Image style={styles.petWalkImage} source={Images.petWalkImage} />
            <GText
              GrMedium
              text="Take Kizie for Walk"
              style={styles.modalHeading}
            />
            <GText
              SatoshiRegular
              style={styles.modalSubHeading}
              text={'Just a quick check—have you started this\nfor Kizie yet?'}
            />
            <View style={styles.buttonView}>
              <GButton
                title={t('not_yet_string')}
                textStyle={{color: colors.appRed}}
                style={{
                  paddingHorizontal: scaledValue(40.25),
                  height: '100%',
                  borderWidth: 1,
                  borderColor: colors.appRed,
                  borderRadius: scaledValue(28),
                }}
              />
              <GButton
                title={t("yes_done_string")}
                style={{
                  paddingHorizontal: scaledValue(40.25),
                  height: '100%',

                  borderRadius: scaledValue(28),
                  backgroundColor: colors.appRed,
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
      <OptionMenuSheet
        refRBSheet={refRBTaskStatusSheet}
        options={taskStatusList}
        height={taskStatusList.reduce((a, c) => a + c?.height + 1, 0) + 18 + 56}
        onChoose={val => {
          val.action();
          refRBTaskStatusSheet.current.close();
        }}
        onPressCancel={() => refRBTaskStatusSheet.current.close()}
      />
    </>
  );
};

export default SharePetDutiesHome;
