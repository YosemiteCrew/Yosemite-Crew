import React, {useEffect} from 'react';
import {Image, View} from 'react-native';
import HeaderButton from '../../../../components/HeaderButton';
import {Images} from '../../../../utils';
import {colors} from '../../../../../assets/colors';
import GImage from '../../../../components/GImage';
import {styles} from './styles';
import GText from '../../../../components/GText/GText';
import {scaledValue} from '../../../../utils/design.utils';
import moment from 'moment';

const PetProfile = ({navigation, route}) => {
  const {petData} = route?.params;

  useEffect(() => {
    navigation.setOptions({
      // headerRight: () => (
      //   <HeaderButton icon={Images.bellBold} tintColor={colors.jetBlack} />
      // ),
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, []);
  const convertDate = dateStr => {
    return moment(dateStr, 'YYYY-MM-DD').format('MM-DD-YYYY');
  };
  const petDetails = [
    {label: 'Parent:', value: petData?.name},
    // {label: 'Co-Parent:', value: petData?.name},
    {label: 'Age:', value: `${petData?.petAge} Years`},
    {label: 'Sex:', value: petData?.gender},
    {label: 'Color:', value: petData?.petColor},
    {
      label: 'Neutering:',
      value: petData?.isNeutered ? 'Neutered' : 'Not Neutered',
    },
    {label: 'Pet ID:', value: petData?.id},
    {label: 'DOB:', value: convertDate(petData?.birthDate)},
    {label: 'Weight:', value: `${petData?.petCurrentWeight} Lbs`},
    // {label: 'Blood Group:', value: petData?.petBloodGroup},
    // {label: 'Vaccination Status:', value: 'Up-to-date'},
    {label: 'Microchip Number:', value: petData?.microchipNumber || 'N/A'},
  ];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.petInfo}>
            <GImage
              image={petData?.petImages}
              style={styles.petImage}
              noImageSource={Images.Kizi}
            />

            <View>
              <GText GrMedium text={petData?.name} style={styles.petName} />
              <GText
                SatoshiBold
                text={petData?.breed}
                style={styles.petBreed}
              />
            </View>
          </View>
        </View>
        <View style={{marginTop: scaledValue(22)}}>
          {petDetails?.map((item, index) => {
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
                      ellipsizeMode:
                        item?.label === 'Pet ID:' ? 'middle' : 'tail',
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
          {/* {petDetails?.map((item, index) =>
            renderRow(
              item.label,
              item?.value,
              index !== petDetails?.length - 1,
            ),
          )} */}
        </View>
      </View>
    </View>
  );
};

export default PetProfile;
