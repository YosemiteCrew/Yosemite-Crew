import {FlatList, Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import HeaderButton from '../../../../../components/HeaderButton';

const PainJournal = ({navigation}) => {
  const {t} = useTranslation();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
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
                        text={` ${t('journal_string')}`}
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
                <TouchableOpacity
                  onPress={() => {
                    navigation?.navigate('StackScreens', {
                      screen: 'NewPainAssessment',
                    });
                  }}
                  style={styles.addNewButton}>
                  <Image source={Images.PlusBold} style={styles.addNewImage} />
                  <GText
                    SatoshiBold
                    text={'Add New'}
                    style={styles.addNewText}
                  />
                </TouchableOpacity>
              </View>
              <Image source={item?.img} style={styles.mainImage} />
            </View>
          )}
        />
      </View>
    </View>
  );
};

export default PainJournal;
