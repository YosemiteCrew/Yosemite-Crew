import {FlatList, Image, TouchableOpacity, View} from 'react-native';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {styles} from './styles';
import GText from '../../../../../components/GText/GText';
import GButton from '../../../../../components/GButton';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {scaledValue} from '../../../../../utils/design.utils';

const DocumentListScreen = ({navigation}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.darkPurple}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const invoicesList = [
    {
      id: 1,
      title: 'Invoice for consultation',
      date: '28 July 2024',
      invoices: 3,
      img: Images.Invoice3,
    },
    {
      id: 2,
      title: 'Invoice for Vaccination',
      date: '20 July 2024',
      invoices: 1,
      img: Images.Invoice1,
    },
    {
      id: 3,
      title: 'Medicine Invoice',
      date: '12 June 2024',
      invoices: 2,
      img: Images.Invoice2,
    },
  ];

  const InvoiceItem = ({item, navigation}) => {
    return (
      <TouchableOpacity
        onPress={() => {
          navigation?.navigate('StackScreens', {
            screen: 'RecordPreview',
          });
        }}
        style={styles.invoiceContainer}>
        <View>
          <GText GrMedium text={item?.title} style={styles.titleText} />
          <GText SatoshiBold text={item?.date} style={styles.dateText} />
        </View>
        <View style={{alignItems: 'center'}}>
          <Image source={item?.img} style={styles.image} />
          <View style={styles.attachmentContainer}>
            <Image
              source={Images.Attachment} // Update with actual path
              style={styles.attachmentImage}
            />
            <GText GrMedium text={item?.invoices} style={styles.titleText} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.dashboardMainView}>
      <View style={styles.headerRow}>
        <GText GrMedium text={`24`} style={styles.ongoingText} />
        <GText
          GrMedium
          text={` ${t('records_string')}`}
          style={styles.plansText}
        />
      </View>
      <View>
        <FlatList
          data={invoicesList}
          contentContainerStyle={{gap: scaledValue(9)}}
          renderItem={({item}) => (
            <InvoiceItem item={item} navigation={navigation} />
          )} // Use the new component
        />
      </View>
      <GButton
        icon={Images.PlusIcon}
        iconStyle={styles.buttonIcon}
        title={t('add_new_record_string')}
        textStyle={styles.buttonText}
        style={styles.button(insets)}
      />
    </View>
  );
};

export default DocumentListScreen;
