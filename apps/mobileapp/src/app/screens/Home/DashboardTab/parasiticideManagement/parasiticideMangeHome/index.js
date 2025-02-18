import {Image, ScrollView, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {useTranslation} from 'react-i18next';
import GText from '../../../../../components/GText/GText';
import {fonts} from '../../../../../utils/fonts';
import {styles} from './styles';
import HeaderButton from '../../../../../components/HeaderButton';

const ParasiticideManagementHome = ({navigation}) => {
  const {t} = useTranslation();
  const [selectedTab, setSelectedTab] = useState(t('flea_risk_string'));

  const pets = [
    {id: 1, name: 'Kizie', img: Images.Kizi, status: 'Healthy'},
    {id: 2, name: 'Oscar', img: Images.CatImg, status: 'At Risk'},
  ];

  const tabs = [
    {id: 1, title: t('flea_risk_string')},
    {id: 2, title: t('tick_risk_string')},
  ];

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
      headerRight: () => (
        <HeaderButton
          icon={Images.bellBold}
          tintColor={colors.appRed}
          onPress={() =>
            navigation.navigate('StackScreens', {screen: 'Notifications'})
          }
        />
      ),
    });
  }, [navigation]);

  const tabOptions = tab => (
    <TouchableOpacity
      key={tab.id}
      activeOpacity={0.5}
      onPress={() => setSelectedTab(tab.title)}
      style={[
        styles.tabButton,
        selectedTab === tab.title && styles.selectedTabButton,
      ]}>
      <GText
        text={tab.title}
        style={[
          styles.tabText,
          {
            color: selectedTab === tab.title ? '#FEF8F4' : '#302F2E',
            fontFamily:
              selectedTab === tab.title
                ? fonts.CLASH_GRO_MEDIUM
                : fonts.CLASH_DISPLAY_REGULAR,
          },
        ]}
      />
    </TouchableOpacity>
  );

  const petList = pet => (
    <TouchableOpacity
      key={pet.id}
      onPress={() =>
        navigation.navigate('StackScreens', {
          screen: 'ParasiticideRiskQuestion',
        })
      }>
      <Image source={pet.img} style={styles.petImage} />
      <GText SatoshiBold text={pet.name} style={styles.petName} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}>
        <View style={styles.tabContainer}>
          {tabs.map(tab => tabOptions(tab))}
        </View>

        <View style={styles.highRiskContainer}>
          <View style={styles.highRiskRow}>
            <Image source={Images.Bug} style={styles.bugIcon} />
            <GText
              GrMedium
              text={t('hight_flea_risk')}
              style={styles.highRiskText}
            />
          </View>
          <View style={styles.locationRow}>
            <Image source={Images.ArrowUp} style={styles.arrowIcon} />
            <GText
              SatoshiRegular
              text="Norwalk, LA"
              style={styles.locationText}
            />
          </View>
        </View>

        <GText
          SatoshiRegular
          text={t('maximum_vigilance_string')}
          style={styles.vigilanceText}
        />
        <Image source={Images.Map} style={styles.mapImage} />

        <View style={styles.parasiteRiskButton}>
          <Image source={Images.Parasite} style={styles.parasiteIcon} />
          <GText
            GrMedium
            text={t('parasite_risk_string')}
            style={styles.parasiteRiskText}
          />
          <GText
            SatoshiRegular
            text={t('evaluate_your_pet_string')}
            style={styles.evaluateText}
          />

          <View style={styles.petList}>{pets.map(pet => petList(pet))}</View>
        </View>
      </ScrollView>
    </View>
  );
};

export default ParasiticideManagementHome;
