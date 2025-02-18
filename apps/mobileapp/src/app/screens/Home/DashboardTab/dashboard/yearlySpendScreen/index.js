import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';

import HeaderButton from '../../../../../components/HeaderButton';
import {useTranslation} from 'react-i18next';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';
import {scaledValue} from '../../../../../utils/design.utils';
import GText from '../../../../../components/GText/GText';
import {styles} from './styles';
import Modal from 'react-native-modal';
import LinearGradient from 'react-native-linear-gradient';
import RBSheet from 'react-native-raw-bottom-sheet';
import Input from '../../../../../components/Input';
import GTextButton from '../../../../../components/GTextButton/GTextButton';
import GButton from '../../../../../components/GButton';
import OptionMenuSheet from '../../../../../components/OptionMenuSheet';

const YearlySpendScreen = ({navigation}) => {
  const refRBSheet = useRef();
  const [visible, setVisible] = useState(false);
  const [visibleModal, setVisibleModal] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [amount, setAmount] = useState('');
  const {t} = useTranslation();
  useEffect(() => {
    configureHeader();
  }, []);

  const recentData = [
    {
      task: 'Monthly Food Supply',
      price: '$30',
      date: '20 Nov 2024',
    },
    {
      task: 'Annual Vaccination',
      price: '$15',
      date: '12 Nov 2024',
    },
    {
      task: 'Grooming Session',
      price: '$30',
      date: '20 Nov 2024',
    },
    {
      task: 'Pet Insurance Premium',
      price: '$30',
      date: '20 Nov 2024',
    },
    {
      task: 'New Collar and Leash',
      price: '$30',
      date: '20 Nov 2024',
    },
  ];
  const settingsList = [
    {
      id: 1,
      title: t('edit_expense_string'),
      subTitle: '',
      textColor: '#007AFF',
      action: () => setVisibleModal(true),
    },

    {
      id: 2,
      title: t('del_expense_string'),
      subTitle: '',
      textColor: '#F42626',
      action: () => {},
    },
  ];

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

  const renderItem = ({item}) => {
    return (
      <View style={styles.flatlistMain}>
        <View style={styles.taskView}>
          <GText GrMedium style={styles.taskText} text={item.task} />
          <GText SatoshiBold style={styles.dateText} text={item.date} />
        </View>
        <View style={styles.priceView}>
          <GText GrMedium style={styles.priceText} text={item.price} />
          <TouchableOpacity
            hitSlop={styles.hitSlop}
            onPress={() => refRBSheet.current.open()}>
            <Image
              tintColor={'#A09F9F'}
              style={styles.threeDots}
              source={Images.ThreeDots}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <LinearGradient
          colors={['#D04122', '#FDBD74']}
          start={{x: 0, y: 1}}
          end={{x: 1, y: 1}}
          style={styles.yearlySpendView}>
          <Image style={styles.kiziImage} source={Images.Kizi} />
          <GText
            GrMedium
            style={styles.subHeading}
            text={t('yearly_spend_string')}
          />
          <GText GrMedium style={styles.price} text="$ 2,487" />
        </LinearGradient>
        <View style={styles.recentView}>
          <Text style={styles.recentText}>{t('recent_string')}</Text>
          <TouchableOpacity
            onPress={() => setVisible(true)}
            style={styles.addView}>
            <Image style={styles.addImage} source={Images.addImage} />
            <Text style={styles.addExpenseText}>{t('add_expense_string')}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          contentContainerStyle={{
            marginTop: scaledValue(16),
            gap: scaledValue(12),
            marginBottom: scaledValue(28),
          }}
          renderItem={renderItem}
          data={recentData}
          showsVerticalScrollIndicator={false}
        />
        <Modal
          statusBarTranslucent={true}
          onBackdropPress={() => setVisible(false)}
          isVisible={visible}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={{
                alignSelf: 'flex-end',
                position: 'absolute',
                top: scaledValue(19.5),
                right: scaledValue(20),
              }}>
              <Image style={styles.crossIcon} source={Images.Close} />
            </TouchableOpacity>
            <Image source={Images.Kizi} style={styles.kiziImage} />
            <Text style={styles.addText}>
              {t('add_string')}
              <Text style={styles.expenseText}>
                {'  '}
                {t('expense_string')}
              </Text>
            </Text>
            <Input
              value={expenseName}
              label={t('expense_name_string')}
              onChangeText={value => setExpenseName(value)} //
              style={styles.input}
            />
            {/* <Input
              value={category}
              label={'Category'}
              onChangeText={value => setCategory(value)} //
              style={styles.input}
              rightIcon={Images.ArrowDown}
              iconStyle={styles.iconStyle}
              rightIconPress={() => refRBSheet.current.open()}
            /> */}
            <View style={styles.categoryView}>
              <Text style={styles.categoryText}>{t('category_string')}</Text>
              <TouchableOpacity onPress={() => refRBSheet.current.open()}>
                <Image style={styles.iconStyle} source={Images.ArrowDown} />
              </TouchableOpacity>
            </View>

            {/* <Input
              value={expenseDate}
              label={'Expense Date'}
              onChangeText={value => setExpenseDate(value)} //
              style={styles.input}
              rightIcon={Images.Calender}
              iconStyle={styles.iconStyle}
            /> */}
            <View style={styles.calendarView}>
              <Text style={styles.expenseDateText}>{t('category_string')}</Text>
              <TouchableOpacity onPress={() => refRBSheet.current.open()}>
                <Image style={styles.iconStyle} source={Images.Calender} />
              </TouchableOpacity>
            </View>
            <Input
              value={amount}
              label={'Amount'}
              onChangeText={value => setAmount(value)} //
              style={styles.inputAmount}
              leftIcon={Images.dollarImage}
              iconLeftStyle={styles.iconLeftStyle}
            />
            <GButton
              style={styles.buttonStyle}
              title={t('Add Expense')}
              iconStyle={styles.buttonIcon}
              icon={Images.tickImage}
            />
          </View>
        </Modal>
        <RBSheet
          ref={refRBSheet}
          // useNativeDriver={true}
          // customStyles={{
          //   wrapper: {
          //     backgroundColor: 'transparent',
          //   },
          //   draggableIcon: {
          //     backgroundColor: '#000',
          //   },
          // }}
          // customModalProps={{
          //   animationType: 'slide',
          //   statusBarTranslucent: true,
          // }}
          // customAvoidingViewProps={{
          //   enabled: false,
          // }}
        ></RBSheet>
        <Modal
          statusBarTranslucent={true}
          onBackdropPress={() => setVisibleModal(false)}
          isVisible={visibleModal}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              onPress={() => setVisibleModal(false)}
              style={{
                alignSelf: 'flex-end',
                position: 'absolute',
                top: scaledValue(19.5),
                right: scaledValue(20),
              }}>
              <Image style={styles.crossIcon} source={Images.Close} />
            </TouchableOpacity>
            <Image source={Images.Kizi} style={styles.kiziImage} />
            <Text style={styles.addText}>
              Edit <Text style={styles.expenseText}> expense</Text>
            </Text>
            <Input
              value={expenseName}
              label={'Expense Name'}
              onChangeText={value => setExpenseName(value)} //
              style={styles.input}
            />

            <View style={styles.categoryView}>
              <Text style={styles.categoryText}>{t('category_string')}</Text>
              <TouchableOpacity onPress={() => refRBSheet.current.open()}>
                <Image style={styles.iconStyle} source={Images.ArrowDown} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarView}>
              <Text style={styles.expenseDateText}>
                {t('expense_date_string')}
              </Text>

              <TouchableOpacity onPress={() => refRBSheet.current.open()}>
                <Image style={styles.iconStyle} source={Images.Calender} />
              </TouchableOpacity>
            </View>
            <Input
              value={amount}
              label={t('amount_string')}
              onChangeText={value => setAmount(value)} //
              style={styles.inputAmount}
              leftIcon={Images.dollarImage}
              iconLeftStyle={styles.iconLeftStyle}
            />
            <GButton
              style={styles.buttonStyle}
              title={t('Update Expense')}
              iconStyle={styles.buttonIcon}
              icon={Images.tickImage}
            />
          </View>
        </Modal>
        <OptionMenuSheet
          refRBSheet={refRBSheet}
          options={settingsList}
          onChoose={val => {
            val.action();
            refRBSheet.current.close();
          }}
          onPressCancel={() => refRBSheet.current.close()}
        />
      </ScrollView>
    </View>
  );
};

export default YearlySpendScreen;
