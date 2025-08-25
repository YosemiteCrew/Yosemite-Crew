import {FlatList, Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';

const PainManagementHome = ({navigation}) => {
  const {t} = useTranslation();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => {
            navigation?.goBack();
          }}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.jetBlack}
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'Notifications',
            });
          }}
        />
      ),
    });
  };

  const quickAction = [
    {
      id: 1,
      title: t('exercise_plans_string'),
      subTitle: 'Plans for 5 days',
      img: Images.DogExercise,
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'NewExercisePlan',
        });
      },
    },
    {
      id: 3,
      title: t('knowledge_library_string'),
      img: Images.Library,
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'KnowledgeLibrary',
        });
      },
    },
    {
      id: 2,
      title: t('pain_journal_string'),
      img: Images.DogPain,
      subTitle: 'Total 5 Steps',
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'PainJournal',
        });
      },
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiBold
        text={t('plans_designed_string')}
        style={styles.quickActionsText}
      />
      <FlatList
        data={quickAction}
        contentContainerStyle={styles.quickActionsList}
        renderItem={({item, index}) => {
          return (
            <TouchableOpacity
              onPress={item?.onAction}
              activeOpacity={0.5}
              key={item?.id}
              style={styles.quickActionItem}>
              <View>
                <GText
                  GrMedium
                  text={item?.title}
                  style={styles.quickActionText}
                />
                <GText
                  SatoshiMedium
                  text={item?.subTitle}
                  style={styles.quickActionSubText}
                />
              </View>
              <Image
                source={item?.img}
                style={styles.quickActionImage}
                tintColor={colors.jetBlack}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

export default PainManagementHome;
