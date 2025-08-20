import React, {useEffect} from 'react';
import {Image, View} from 'react-native';
import HeaderButton from '../../../../components/HeaderButton';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import GImage from '../../../../components/GImage';
import {styles} from './styles';
import GText from '../../../../components/GText/GText';
import {scaledValue} from '../../../../utils/design.utils';

const PetProfile = ({navigation, route}) => {
  const {petData} = route?.params;

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton icon={Images.bellBold} tintColor={colors.jetBlack} />
      ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, []);

  const petDetails = [
    {label: 'Parent:', value: petData?.name},
    {label: 'Co-Parent:', value: petData?.name},
    {label: 'Age:', value: `${petData?.petAge} Years`},
    {label: 'Sex:', value: petData?.gender},
    {label: 'Color:', value: petData?.petColor},
    {label: 'Neutering:', value: petData?.petColor},
    {label: 'Pet ID:', value: petData?.id},
    {label: 'DOB:', value: petData?.dob},
    {label: 'Weight:', value: `${petData?.petCurrentWeight} Lbs`},
    {label: 'Blood Group:', value: petData?.petBloodGroup},
    {label: 'Vaccination Status:', value: 'Up-to-date'},
    {label: 'Microchip Number:', value: petData?.microChipNumber},
  ];

  const renderRow = (label, value, showDivider) => (
    <View style={styles.row(showDivider)}>
      <GText SatoshiBold text={label} style={styles.label} />
      <GText
        componentProps={{
          numberOfLines: 1,
          ellipsizeMode: 'tail',
        }}
        SatoshiBold
        text={value}
        style={styles.value}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.petInfo}>
            <View style={styles.petImageBorder}>
              <GImage
                image={petData?.petImage}
                style={styles.petImage}
                noImageSource={Images.Kizi}
              />
            </View>
            <View>
              <GText GrMedium text={petData?.name} style={styles.petName} />
              <GText
                SatoshiBold
                text={petData?.breed}
                style={styles.petBreed}
              />
            </View>
          </View>
          <Image source={Images.qrCode} style={styles.qrCode} />
        </View>
        <View style={{marginTop: scaledValue(22)}}>
          {petDetails.map((item, index) =>
            renderRow(item.label, item.value, index !== petDetails.length - 1),
          )}
        </View>
      </View>
    </View>
  );
};

export default PetProfile;
