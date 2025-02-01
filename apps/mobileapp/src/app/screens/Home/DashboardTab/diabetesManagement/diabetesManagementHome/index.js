import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import HeaderButton from '../../../../../components/HeaderButton';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import {scaledValue} from '../../../../../utils/design.utils';
import {LineChart} from 'react-native-gifted-charts';
import PetRecordCard from '../../../../../components/PetRecordCard';
import {Divider} from 'react-native-paper';
import GButton from '../../../../../components/GButton';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';

const DiabetesManagement = ({navigation}) => {
  const {t} = useTranslation();
  const refRBSheet = useRef();
  const [selectedPetRecord, setSelectedPetRecord] = useState('Blood Glucose');
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
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
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };
  const lineData = [
    {value: 80, label: ''},
    {value: 50, label: ''},
    {value: 105, label: ''},
    {value: 117, label: ''},
    {value: 80, label: ''},
  ];

  const petList = [
    {
      id: 1,
      name: 'Kizie',
      img: Images.Kizi,
      status: 'Stable',
    },
    {
      id: 2,
      name: 'Oscar',
      img: Images.CatImg,
      status: 'At Risk',
    },
  ];

  const vaccineRecordList = [
    {
      id: 1,
      title: '112 mg/dL',
      subTitle: '2 Oct 2024 - 5:14 PM',
      img: Images.Kizi,
      labelName: 'Optimal',
      labelColor: colors.cambridgeBlue,
    },
    {
      id: 2,
      title: '134 mg/dL',
      subTitle: '1 Oct 2024 - 12:39 PM',
      img: Images.CatImg,
      labelName: 'High',
      labelColor: colors.appRed,
    },
    {
      id: 3,
      title: '197 mg/dL',
      subTitle: '1 Oct 2024 - 11:18 PM',
      img: Images.Kizi,
      labelName: 'High',
      labelColor: colors.appRed,
    },
    {
      id: 4,
      title: '108mg/dL',
      subTitle: '29 Sep 2024 - 8:47 AM',
      img: Images.CatImg,
      labelName: 'Optimal',
      labelColor: colors.cambridgeBlue,
    },
    {
      id: 5,
      title: '71 mg/dL',
      subTitle: '29 Sep 2024 - 8:23 AM',
      img: Images.Kizi,
      labelName: 'Low',
      labelColor: colors.fawn,
    },
  ];

  return (
    <View style={styles.dashboardMainView}>
      <ScrollView
        style={styles.containerView}
        showsVerticalScrollIndicator={false}>
        <GText
          GrMedium
          text={t('status_overview_string')}
          style={styles.headerTitle}
        />
        <View style={styles.petListContainer}>
          <FlatList
            data={petList}
            horizontal
            contentContainerStyle={styles.petList}
            renderItem={({item, index}) => {
              return (
                <View style={styles.petItem}>
                  <Image source={item.img} style={styles.petImage} />
                  <GText
                    SatoshiBold
                    text={item?.name}
                    style={styles.petNameText}
                  />
                  {item?.status === 'Stable' ? (
                    <View style={styles.healthyStatus}>
                      <Image source={Images.Heart} style={styles.statusIcon} />
                      <GText
                        SatoshiBold
                        text={item?.status}
                        style={styles.statusText}
                      />
                    </View>
                  ) : (
                    <View style={styles.riskStatus}>
                      <Image source={Images.Risk} style={styles.statusIcon} />
                      <GText
                        SatoshiBold
                        text={item?.status}
                        style={styles.statusText}
                      />
                    </View>
                  )}
                </View>
              );
            }}
          />
        </View>
        <View style={styles.bloodGulcoseButtonView}>
          <View style={styles.headerImageContainer}>
            <Image source={Images.CatImg} style={styles.catImage} />
            <Image source={Images.ArrowDown} style={styles.arrowDownImage} />
          </View>
          <TouchableOpacity
            onPress={() => refRBSheet.current.open()}
            style={styles.bloodGulcoseButton}>
            <GText
              SatoshiBold
              text={selectedPetRecord}
              style={styles.bloodGulcoseText}
            />
            <Image source={Images.ArrowDown} style={styles.arrowIcon} />
          </TouchableOpacity>
        </View>
        <View style={styles.graphMainView}>
          <GText
            SatoshiBold
            text={'Blood Glucose'}
            style={{marginBottom: scaledValue(28)}}
          />

          <View style={{height: scaledValue(243)}}>
            <LineChart
              areaChart
              data={lineData}
              thickness={3}
              yAxisLabelWidth={60} // Reduce space between y-axis text
              color="#FFAA4C" // Orange line color
              curved
              showDataPoints
              dataPointsRadius={8} // Larger data points
              dataPointsColor="#fff" // White data points
              hideRules={false} // To show grid lines
              xAxisColor="transparent" // Hide the x-axis line
              yAxisColor="transparent" // Hide the y-axis line
              initialSpacing={20}
              showScrollIndicator={false}
              isAnimated
              animateOnDataChange
              startFillColor="#fadab6" // Gradient fill under the line
              endFillColor="#faf1e8" // Fades out
              gradientDirection="vertical" // Top to bottom gradient
              rulesColor="rgba(0,0,0,0.1)" // Light grid lines
              yAxisLabelTexts={['Low', 'Optimal', 'High']} // Custom y-axis labels
              noOfSections={2} // Divides the y-axis into 3 sections
              yAxisTextStyle={styles.yAxisTextStyle}
              spacing={60} // Space between points
              showStripOnPress
              stripHeight={200} // Controls tooltip strip height
              stripColor="rgba(0,0,0,0.1)"
            />
          </View>
        </View>
        <GText
          SatoshiBold
          text={t('diabetes_log_string')}
          style={styles.diabeteslogText}
        />
        <FlatList
          data={vaccineRecordList}
          contentContainerStyle={{
            marginBottom: scaledValue(61),
          }}
          renderItem={({item}) => {
            return (
              <>
                <PetRecordCard
                  image={item?.img}
                  title={item?.title}
                  subTitle={item?.subTitle}
                  labelName={item?.labelName}
                  labelColor={item?.labelColor}
                />
                <Divider />
              </>
            );
          }}
        />

        <GButton
          onPress={() => {
            navigation?.navigate('StackScreens', {
              screen: 'AddNewRecord',
            });
          }}
          icon={Images.PlusIcon}
          iconStyle={styles.buttonIcon}
          title={t('add_new_record_string')}
          textStyle={styles.buttonText}
          style={styles.button}
        />
      </ScrollView>
      <OptionMenuSheet
        refRBSheet={refRBSheet}
        options={petRecordList}
        height={(petRecordList + 1) * 56 + 18}
        onChoose={val => {
          setSelectedPetRecord(val.title);

          refRBSheet.current.close();
        }}
        onPressCancel={() => refRBSheet.current.close()}
      />
    </View>
  );
};

const petRecordList = [
  {
    id: 1,
    title: 'Blood Glucose',
    textColor: colors.blue,
  },
  {
    id: 2,
    title: 'Urine Glucose',
    textColor: colors.blue,
  },
  {
    id: 3,
    title: 'Urine Ketones',
    textColor: colors.blue,
  },
  {
    id: 4,
    title: 'Weight',
    textColor: colors.blue,
  },
];

export default DiabetesManagement;
