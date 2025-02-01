import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {colors} from '../../../../../../assets/colors';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import GText from '../../../../../components/GText/GText';

import {fonts} from '../../../../../utils/fonts';
import {styles} from './styles';
import VetCard from './VetCard';
import {scaledValue} from '../../../../../utils/design.utils';
import GButton from '../../../../../components/GButton';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import AssessmentFeeRBSheet from './AssessmentFeeRBSheet';

const ChooseVet = ({navigation}) => {
  const {t} = useTranslation();
  const refRBSheet = useRef();
  const [selectedVetOption, setSelectedVetOption] = useState('previous');
  const [selectedVet, setSelectedVet] = useState('');
  const insets = useSafeAreaInsets();
  useEffect(() => {
    configureHeader();
  }, []);

  const filterVets = () => {
    const filterVetDetails = vetDetailsList?.filter(
      item => item.status === selectedVetOption,
    );
    return filterVetDetails;
  };

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
  return (
    <>
      <View style={styles.dashboardMainView}>
        <View style={styles.headerSubTitleView}>
          <GText
            SatoshiRegular
            text={
              'Select a doctor to send your assessment report for evaluation.'
            }
            style={styles.headerTitle}
          />
        </View>
        <View style={styles.vetOptionButtonView}>
          <TouchableOpacity
            style={[
              styles.vetOptionButton,
              {
                backgroundColor:
                  selectedVetOption == 'previous'
                    ? colors.appRed
                    : 'transparent',
              },
            ]}
            onPress={() => {
              setSelectedVetOption('previous');
              setSelectedVet('');
            }}>
            <GText
              text={'Previous Vet'}
              style={[
                styles.vetOptionButtonText,
                {
                  color:
                    selectedVetOption == 'previous'
                      ? colors.pearlWhite
                      : colors.jetBlack,
                  fontFamily:
                    selectedVetOption == 'previous'
                      ? fonts.CLASH_GRO_MEDIUM
                      : fonts.CLASH_DISPLAY_REGULAR,
                },
              ]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.vetOptionButton,
              {
                backgroundColor:
                  selectedVetOption == 'new' ? colors.appRed : 'transparent',
              },
            ]}
            onPress={() => {
              setSelectedVetOption('new');
              setSelectedVet('');
            }}>
            <GText
              text={'New Vet'}
              style={[
                styles.vetOptionButtonText,
                {
                  color:
                    selectedVetOption == 'new'
                      ? colors.pearlWhite
                      : colors.jetBlack,
                  fontFamily:
                    selectedVetOption == 'new'
                      ? fonts.CLASH_GRO_MEDIUM
                      : fonts.CLASH_DISPLAY_REGULAR,
                },
              ]}
            />
          </TouchableOpacity>
        </View>
        <ScrollView>
          <FlatList
            data={filterVets()}
            scrollEnabled={false}
            contentContainerStyle={styles.contentContainerStyle}
            renderItem={({item}) => {
              return (
                <VetCard
                  image={item.image}
                  name={item.name}
                  professions={item.professions}
                  qualification={item.qualification}
                  onPress={() => setSelectedVet(item.id)}
                  nameTextColor={
                    selectedVet == item?.id
                      ? colors.pearlWhite
                      : colors.richBlack
                  }
                  textColor={
                    selectedVet == item?.id
                      ? colors.pearlWhite
                      : colors.darkPurple
                  }
                  rightIcon={
                    selectedVet == item?.id ? (
                      <Image
                        source={Images.Check_fill}
                        tintColor={colors.pearlWhite}
                        style={styles.checkFill}
                      />
                    ) : null
                  }
                  vetContainerStyle={{
                    backgroundColor:
                      selectedVet == item?.id
                        ? colors.appRed
                        : colors.pearlWhite,
                  }}
                />
              );
            }}
          />
        </ScrollView>

        <View
          style={{
            marginTop: scaledValue(36),
            marginHorizontal: scaledValue(20),
          }}>
          <GText
            SatoshiBold
            text={'Almost there! '}
            style={styles.almostThereText}
          />
          <GText
            SatoshiRegular
            text={'Review and complete your payment to send the assessment.'}
            style={styles.reviewCompletePaymentText}
          />
        </View>
        <View style={styles.buttonView(insets)}>
          <GButton
            onPress={() => {
              refRBSheet?.current?.open();
            }}
            title={t('review_assessment_fee_string')}
            textStyle={styles.buttonText}
            style={styles.buttonStyle}
          />
        </View>
        <AssessmentFeeRBSheet refRBSheet={refRBSheet} />
      </View>
    </>
  );
};

const vetDetailsList = [
  {
    id: 1,
    image: Images.DoctorImg,
    name: 'Dr. Emily Johnson',
    professions: 'Cardiology',
    qualification: 'DVM, DACVIM',
    status: 'new',
  },
  {
    id: 2,
    image: Images.DoctorImg,
    name: 'Dr. David Brown',
    professions: 'Gastroenterology',
    qualification: 'DVM, DACVIM',
    status: 'new',
  },
  {
    id: 3,
    image: Images.DoctorImg,
    name: 'Dr. Megan Clark',
    professions: 'Endocrinology',
    qualification: 'DVM, DACVIM',
    status: 'previous',
  },
  {
    id: 4,
    image: Images.DoctorImg,
    name: 'Dr. Jason Miller',
    professions: 'Nephrology/Urology',
    qualification: 'DVM, DACVIM',
    status: 'previous',
  },
];

export default ChooseVet;
