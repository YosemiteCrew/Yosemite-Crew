import {FlatList, ScrollView, TouchableOpacity, View} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import Swiper from 'react-native-swiper';
import AppointmentCard from '../../../../../components/AppointmentCard';

const AppointmentHistory = ({navigation}) => {
  const {t} = useTranslation();
  const [scrollIndex, setScrollIndex] = useState(0);

  const swiperRef = useRef();
  const [selectedOption, setSelectedOption] = useState(t('all_string'));
  useEffect(() => {
    configureHeader();
  }, []);

  const options = [
    {id: 1, title: t('all_string')},
    {id: 2, title: t('upcoming_string')},
    {id: 3, title: t('confirm_string')},
    {id: 4, title: t('past_string')},
  ];

  const configureHeader = () => {
    navigation.setOptions({
   
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
          style={{marginHorizontal: scaledValue(16)}}
        />
        
      ),
    });
  };

  const renderOption = item => (
    <TouchableOpacity
      key={item.id}
      onPress={() => setSelectedOption(item.title)}
      style={[
        styles.optionButton,
        {
          borderWidth: selectedOption === item.title ? 0 : scaledValue(1),
          backgroundColor:
            selectedOption === item.title ? colors.appRed : 'transparent',
        },
      ]}>
      <GText
        GrMedium
        text={item.title}
        style={[
          styles.optionText,
          {
            color: selectedOption === item.title ? colors.white : colors.appRed,
          },
        ]}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}>
          <View style={styles.optionContainer}>
            {options.map(renderOption)}
          </View>
        </ScrollView>
        <View style={styles.headerView}>
          <GText
            GrMedium
            text={`${t('upcoming_string')} `}
            style={styles.teamText}
          />
          <GText GrMedium text={'(5)'} style={styles.countText} />
        </View>

        <Swiper
          height={430}
          ref={swiperRef}
          loop={false}
          bounces={false}
          onIndexChanged={index => setScrollIndex(index)}
          activeDotColor={colors.appRed}
          dotColor={colors.appRed}
          activeDotStyle={styles.activeDotStyle}
          dotStyle={styles.dotStyle}
          paginationStyle={styles.paginationStyle}>
          {[1, 2].map((page, index) => (
            <View key={index}>
              <AppointmentCard
                key={index}
                imageSource={Images.DoctorImg}
                doctorName="Dr. John Doe"
                department="Orthopedics"
                qualifications="MD, MBBS"
                hospitalName="New York Medical Center"
                appointmentTime="Tuesday, 15 Sept - 02:00 PM"
                navigation={navigation}
                showCancel
                buttonText={t('get_directions_string')}
                showButton
                appointmentTitle={t('cancel_appointment_string')}
              />
            </View>
          ))}
        </Swiper>
        <View style={[styles.headerView, {marginTop: scaledValue(0)}]}>
          <GText
            GrMedium
            text={`${t('confirm_string')} `}
            style={styles.teamText}
          />
          <GText GrMedium text={'(1)'} style={styles.countText} />
        </View>
        <FlatList
          data={[1]} // Add real data here for confirmed appointments
          contentContainerStyle={{gap: scaledValue(20)}}
          renderItem={({item, index}) => (
            <AppointmentCard
              key={index}
              imageSource={Images.DoctorImg}
              doctorName="Dr. John Doe"
              department="Orthopedics"
              qualifications="MD, MBBS"
              hospitalName="New York Medical Center"
              appointmentTime="Tuesday, 15 Sept - 02:00 PM"
              navigation={navigation}
              confirmed
              buttonImg={Images.CrossFill}
              buttonText={t('cancel_string')}
              showButton
            />
          )}
        />

        <View style={[styles.headerView, {marginTop: scaledValue(37)}]}>
          <GText GrMedium text={'August 2024 '} style={styles.teamText} />
          <GText GrMedium text={'(2)'} style={styles.countText} />
        </View>
        <View style={{paddingBottom: scaledValue(151)}}>
          <FlatList
            data={[1, 2]} // Add real data here for past appointments
            contentContainerStyle={{gap: scaledValue(20)}}
            renderItem={({item, index}) => (
              <AppointmentCard
                key={index}
                imageSource={Images.DoctorImg}
                doctorName="Dr. Emily Johnson"
                department="Cardiology"
                qualifications="DVM, DACVIM"
                hospitalName="San Francisco Animal Medical Center"
                appointmentTime="See Prescription"
                navigation={navigation}
                appointmentTitle={t('book_another_appointment_string')}
                monthly
                showCancel
                onPress={() => {
                  navigation?.navigate('StackScreens', {
                    screen: 'SeePrescription',
                  });
                }}
              />
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default AppointmentHistory;
