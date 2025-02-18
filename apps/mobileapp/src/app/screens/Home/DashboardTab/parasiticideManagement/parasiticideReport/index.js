import {Image, ImageBackground, View} from 'react-native';
import React, {useEffect} from 'react';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {useTranslation} from 'react-i18next';
import LinearProgressBar from '../../../../../components/LinearProgressBar';
import GButton from '../../../../../components/GButton';
import GTextButton from '../../../../../components/GTextButton/GTextButton';
import HeaderButton from '../../../../../components/HeaderButton';

const ParasiticideReport = ({navigation}) => {
  const {t} = useTranslation();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={navigation.goBack}
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

  const riskList = [
    {id: 1, name: t('fleas_string'), percentage: 65},
    {id: 2, name: t('ticks_string'), percentage: 85},
    {id: 3, name: t('lungworm_string'), percentage: 62},
    {id: 4, name: t('roundworm_string'), percentage: 52},
    {id: 5, name: t('tapeworm_string'), percentage: 15},
  ];

  const renderItem = item => (
    <View key={item.id} style={styles.riskListItem}>
      <GText SatoshiBold text={item.name} style={styles.riskItemText} />
      <LinearProgressBar progress={item.percentage} />
    </View>
  );

  return (
    <View style={styles.dashboardMainView}>
      <GText
        SatoshiBold
        text={'08 August, 2024'}
        style={styles.questionsText}
      />
      <ImageBackground source={Images.Color} style={styles.imageBackground}>
        <Image source={Images.Kizi} style={styles.kiziImage} />
      </ImageBackground>

      <View style={styles.riskHeaderContainer}>
        <GText
          GrMedium
          text={'Kizie risk for key dog parasites'}
          style={styles.riskText}
        />
        <View style={styles.riskBadge}>
          <Image source={Images.Risk} style={styles.riskIcon} />
          <GText SatoshiBold text={'High Risk'} style={styles.highRiskText} />
        </View>
      </View>

      <GText
        SatoshiBold
        text={t('parasite_risk_profile_string')}
        style={styles.parasiteRiskProfileText}
      />
      <View style={styles.divider} />

      {riskList.map(item => renderItem(item))}

      <GButton
        title={t('send_to_my_vet_string')}
        textStyle={styles.sendToVetText}
        style={styles.sendToVetButton}
      />
      <GTextButton
        title={t('download_pdf_string')}
        titleStyle={styles.downloadPdfText}
      />
    </View>
  );
};

export default ParasiticideReport;
