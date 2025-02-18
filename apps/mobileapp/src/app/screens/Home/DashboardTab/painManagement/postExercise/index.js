import {FlatList, Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import HeaderButton from '../../../../../components/HeaderButton';

const PostOpExercises = ({navigation}) => {
  const {t} = useTranslation();

  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
    });
  };

  const exerciseVideoList = [
    {
      id: 1,
      title: 'Step-up',
      status: 'Basic',
      like: 64,
    },
    {
      id: 2,
      title: 'Stand and Count',
      status: 'Advanced',
      like: 15,
    },
    {
      id: 3,
      title: 'Cookie Stretch',
      status: 'Intermediate',
      like: 34,
    },
    {
      id: 4,
      title: 'Treadmill',
      status: 'Basic',
      like: '',
    },
    {
      id: 5,
      title: 'Sit to stand',
      status: 'Intermediate',
      like: '',
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <View style={styles.innerView}>
        <GText SatoshiBold text={'5 Exercises'} style={styles.text} />
        <View>
          <FlatList
            data={exerciseVideoList}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.exerciseContainer}
                onPress={() => {
                  navigation?.navigate('StackScreens', {
                    screen: 'TreadMill',
                  });
                }}>
                <Image source={Images.Video} style={styles.videoThumbnail} />

                <View style={styles.exerciseDetails}>
                  <GText
                    GrMedium
                    text={item?.title}
                    style={styles.exerciseTitle}
                  />
                  <GText
                    SatoshiBold
                    text={item?.status}
                    style={styles.exerciseStatus}
                  />
                  {item?.like && (
                    <View style={styles.likeContainer}>
                      <Image
                        source={Images.Heart}
                        tintColor="red"
                        style={styles.heartIcon}
                      />
                      <GText
                        SatoshiBold
                        text={` ${item?.like} found it helpful`}
                        style={styles.likeText}
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </View>
  );
};

export default PostOpExercises;
