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
import {useAppSelector} from '../../../redux/store/storeUtils';

const ParentInfo = ({navigation, route}) => {
  const {t} = useTranslation();
  const userData = useAppSelector(state => state.auth.user);
  console.log('userDatauserData', JSON.stringify(userData));

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

  const fullAddress = [
    userData?.address,
    userData?.area,
    userData?.city,
    userData?.state,
    userData?.zipcode,
  ]
    .filter(Boolean) // removes empty or null values
    .join(', ');
  const parentDetails = [
    {label: 'First Name:', value: userData?.firstName},
    {label: 'Last Name:', value: userData?.lastName},
    {label: 'Phone number:', value: userData?.mobilePhone},
    {label: 'Email Address:', value: userData?.email},
    {label: 'Date of Birth:', value: convertDate(userData?.dateOfBirth)},
    {label: 'City:', value: userData?.city},
    {label: 'Address:', value: fullAddress},
  ];

  const renderRow = (label, value, showDivider) => (
    <View style={styles.row(showDivider)}>
      <GText SatoshiBold text={label} style={styles.label} />
      <GText
        componentProps={
          label !== 'Address:' && {
            numberOfLines: 1,
            ellipsizeMode: 'tail',
          }
        }
        SatoshiBold
        text={value}
        style={[
          styles.value,
          {
            textAlign: label !== 'Address:' ? 'right' : 'left',
          },
        ]}
      />
    </View>
  );
  return (
    <ScrollView style={styles.mainContainer}>
      <GImage image={userData?.profileImage[0]?.url} style={styles.petImg} />
      <View style={styles.card}>
        {parentDetails.map((item, index) => {
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
                    numberOfLines: item?.label !== 'Address:' && 1,
                    ellipsizeMode:
                      item?.label === 'Address:' ? 'middle' : 'tail',
                  }}
                  SatoshiBold
                  text={item?.value}
                  style={styles.value}
                />
              </View>
              {index !== parentDetails?.length - 1 && (
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
            params: {petDetails: userData},
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

export default ParentInfo;
