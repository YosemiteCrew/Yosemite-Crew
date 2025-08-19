import {
  Dimensions,
  FlatList,
  Image,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import HeaderButton from '../../../../../components/HeaderButton';
import GButton from '../../../../../components/GButton';
import {scaledValue} from '../../../../../utils/design.utils';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const PainJournal = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
    });
  };
  const list = [
    {
      id: 1,
      name: `Kizie’s`,
      img: Images.Journal1,
      petImg: Images.Kizi,
    },
    {
      id: 2,
      name: `Oscar’s`,
      img: Images.Journal2,
      petImg: Images.CatImg,
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <View style={styles.container}>
        <FlatList
          data={list}
          renderItem={({item, index}) => (
            <View style={styles.listItem}>
              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <Image source={item?.petImg} style={styles.petImage} />
                  <View style={styles.nameContainer}>
                    <View style={styles.row}>
                      <GText
                        GrMedium
                        text={item?.name}
                        style={styles.petNameText}
                      />
                      <GText
                        GrMedium
                        text={` ${t('pain_journal_string')}`}
                        style={styles.journalText}
                      />
                    </View>
                    <GText
                      SatoshiBold
                      text={'May - August'}
                      style={styles.dateText}
                    />
                  </View>
                </View>
              </View>
              <Image source={item?.img} style={styles.mainImage} />
            </View>
          )}
        />
      </View>
      <GButton
        title={t('go_to_dashboard_string')}
        icon={Images.Dashboard}
        iconStyle={{width: scaledValue(16), height: scaledValue(16)}}
        style={{
          width: Dimensions.get('window').width - scaledValue(40),
          alignSelf: 'center',
          position: 'absolute',
          bottom: insets.bottom,
          gap: scaledValue(8),
        }}
      />
    </View>
  );
};

export default PainJournal;
