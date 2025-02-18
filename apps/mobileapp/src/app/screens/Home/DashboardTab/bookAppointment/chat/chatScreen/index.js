import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import HeaderButton from '../../../../../../components/HeaderButton';
import {Images} from '../../../../../../utils';
import {colors} from '../../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../../components/GText/GText';
import {scaledValue} from '../../../../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const ChatScreen = ({navigation}) => {
  const [message, setMessage] = useState('');
  const insets = useSafeAreaInsets();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          icon={Images.Search}
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
      title: 'Dr. David Brown',
    });
  };

  const messageList = [
    {
      subId: '1',
      img: Images.ChatImg,
      id: '101',
      title: `Hi Dr. Brown, Kizie’s been limping slightly on her right leg for a few days now. She doesn’t seem to be in a lot of pain, but it worries me.`,
    },
    {
      subId: '2',
      id: '100',
      title: `Thanks for letting me know. Has she had any recent injuries or been more active than usual?`,
    },
    {
      subId: '4',
      id: '101',
      title: `No injuries, but we did go on a couple of long hikes last week. She’s been more tired than usual too.`,
    },
    {
      subId: '2',
      id: '100',
      title: `Thanks for letting me know. Has she had any recent injuries or been more active than usual?`,
    },
    {
      subId: '4',
      id: '101',
      title: `No injuries, but we did go on a couple of long hikes last week. She’s been more tired than usual too.`,
    },
  ];

  const renderItem = ({item, index}) => {
    const ownerId = '101';
    const showUserImage = index === 0 || messageList[index - 1].id !== item.id;

    return (
      <>
        {ownerId === item.id ? (
          <View key={item?.subId} style={styles.ownerChatBubble}>
            <GText SatoshiBold text={'You'} style={styles.youText} />
            {item?.img && (
              <Image
                source={item?.img}
                style={{
                  width: scaledValue(236),
                  height: scaledValue(150),
                  marginBottom: scaledValue(8),
                  borderRadius: scaledValue(6),
                }}
              />
            )}
            <GText
              SatoshiRegular
              text={item.title}
              style={styles.ownerContent}
            />
            <GText SatoshiBold text={'16:46'} style={styles.timeText} />
          </View>
        ) : (
          <View
            key={item.subId}
            style={[
              styles.chatRow,
              {
                marginTop: scaledValue(16),
              },
            ]}>
            <View style={styles.anotherUser}>
              <GText
                SatoshiBold
                text={'Dr. David Brown'}
                style={styles.youText}
              />
              <GText text={item.title} style={styles.anotherContent} />
              <GText SatoshiBold text={'16:46'} style={styles.timeText} />
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.dashboardMainView}>
      <KeyboardAvoidingView
        style={styles.flexContainer}
        behavior={Platform.OS == 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS == 'ios' ? scaledValue(90) : 0}>
        <>
          <FlatList
            showsVerticalScrollIndicator={false}
            data={messageList}
            renderItem={renderItem}
          />
          <View style={styles.inputView}>
            <TouchableOpacity>
              <Image source={Images.AddPlus} style={styles.plusImgStyle} />
            </TouchableOpacity>
            <TextInput
              value={message}
              placeholder="Write your message"
              placeholderTextColor="#aaa"
              onChangeText={val => setMessage(val)}
              style={styles.input}
            />
            <TouchableOpacity style={{left: scaledValue(4)}}>
              <Image source={Images.RightArrowSend} style={styles.arrowStyle} />
            </TouchableOpacity>
          </View>
        </>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ChatScreen;
