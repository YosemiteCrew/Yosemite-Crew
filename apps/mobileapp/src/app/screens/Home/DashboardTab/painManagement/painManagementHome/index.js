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

  const quickAction = [
    {
      id: 1,
      title: t('exercise_plans_string'),
      img: Images.DogExercise,
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'ExercisePlans',
        });
      },
    },
    {
      id: 2,
      title: t('pain_journal_string'),
      img: Images.DogPain,
      onAction: () => {
        navigation?.navigate('StackScreens', {
          screen: 'PainJournal',
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
  ];

  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiBold
        text={t('quick_actions_string')}
        style={styles.quickActionsText}
      />
      <FlatList
        data={quickAction}
        numColumns={2}
        columnWrapperStyle={styles.quickActionsWrapper}
        contentContainerStyle={styles.quickActionsList}
        renderItem={({item, index}) => {
          return (
            <TouchableOpacity
              onPress={item?.onAction}
              activeOpacity={0.5}
              key={item?.id}
              style={styles.quickActionItem}>
              <Image source={item?.img} style={styles.quickActionImage} />
              <GText
                GrMedium
                text={item?.title}
                style={styles.quickActionText}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

export default PainManagementHome;
