import {ScrollView, StyleSheet, Text, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../components/HeaderButton';
import {Images} from '../../../utils';
import {colors} from '../../../../assets/colors';
import {styles} from './styles';
import GImage from '../../../components/GImage';
import GText from '../../../components/GText/GText';
import {scaledValue} from '../../../utils/design.utils';
import moment from 'moment';
import GButton from '../../../components/GButton';

const PetBasicInfo = ({navigation, route}) => {
  const {t} = useTranslation();
  const {petData} = route?.params;
  console.log('petDatapetData', JSON.stringify(petData));

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, [navigation, t]);
  const convertDate = dateStr => {
    return moment(dateStr, 'YYYY-MM-DD').format('MM-DD-YYYY');
  };
  const petDetails = [
    {label: 'Name:', value: petData?.name},
    {label: 'Pet Breed:', value: petData?.breed},
    {label: 'Date of Birth:', value: convertDate(petData?.birthDate)},
    {label: 'Gender:', value: petData?.gender},
    {label: 'Current Weight:', value: `${petData?.petCurrentWeight} lbs`},
    {label: 'Color:', value: petData?.petColor},
    {label: 'Neutered Status:', value: petData?.isNeutered ? 'Yes' : 'No'},
    {label: 'Age when Neutered:', value: petData?.ageWhenNeutered || 'N/A'},
    {label: 'Microchip Number:', value: petData?.microchipNumber || 'N/A'},
    {label: 'Passport Number:', value: petData?.passportNumber || 'N/A'},
    {label: 'Insured:', value: petData?.isInsured ? 'Yes' : 'No' || 'N/A'},
    {
      label: 'Insurance Company:',
      value: petData?.insuranceCompany || 'N/A',
    },
    {
      label: 'Insurance Policy Number:',
      value: petData?.isInsured ? 'Yes' : 'No' || 'N/A',
    },
    {
      label: 'My pet comes from:',
      value: petData?.petFrom || 'N/A',
    },
  ];

  return (
    <ScrollView style={styles.mainContainer}>
      <GImage image={petData?.petImages} style={styles.petImg} />
      <GText GrMedium text={petData?.name} style={styles.petName} />
      <GText SatoshiMedium text={petData?.breed} style={styles.breed} />
      <View style={styles.card}>
        {petDetails.map((item, index) => {
          return (
            <>
              <View
                style={{
                  paddingVertical: scaledValue(8),
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <GText SatoshiBold text={item?.label} style={styles.label} />
                <GText
                  componentProps={{
                    numberOfLines: 1,
                    ellipsizeMode: 'tail',
                  }}
                  SatoshiBold
                  text={item?.value}
                  style={styles.value}
                />
              </View>
              {index !== petDetails.length - 1 && (
                <View
                  style={{
                    height: scaledValue(1),
                    backgroundColor: colors.jetBlack50,
                  }}
                />
              )}
            </>
          );
        })}
      </View>
      <GButton
        onPress={() => {
          navigation.navigate('StackScreens', {
            screen: 'EditPetDetails',
            params: {petDetails: petData},
          });
        }}
        icon={Images.penBold}
        iconStyle={{tintColor: colors.white}}
        style={{
          gap: scaledValue(6),
          marginTop: scaledValue(29),
          marginBottom: scaledValue(38),
          marginHorizontal: scaledValue(70),
        }}
        title={t('edit_profile_string')}
      />
    </ScrollView>
  );
};

export default PetBasicInfo;
