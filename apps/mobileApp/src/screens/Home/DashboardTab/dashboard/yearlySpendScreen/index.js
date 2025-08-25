import {
  FlatList,
  Image,
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
import GText from '../../../../../components/GText/GText';
import {styles} from './styles';
import Modal from 'react-native-modal';
import LinearGradient from 'react-native-linear-gradient';
import Input from '../../../../../components/Input';
import GButton from '../../../../../components/GButton';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
import {recentData} from '../../../../../utils/constants';
import {scaledValue} from '../../../../../utils/design.utils';

const YearlySpendScreen = ({navigation}) => {
  const refRBSheet = useRef();
  const [visible, setVisible] = useState(false);
  const [visibleModal, setVisibleModal] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [amount, setAmount] = useState('');
  const {t} = useTranslation();
  useEffect(() => {
    configureHeader();
  }, []);

  const configureHeader = () => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  };

  const renderItem = ({item}) => {
    return (
      <View style={styles.flatlistMain}>
        <Menu style={styles.menuView}>
          <MenuTrigger style={styles.menuTriggerView}>
            <View style={styles.dotView}>
              <Image
                tintColor={colors.jetBlack}
                style={styles.threeDots}
                source={Images.ThreeDots}
              />
            </View>
          </MenuTrigger>
          <MenuOptions
            customStyles={{
              optionsWrapper: styles.optionsWrapper,
              optionsContainer: styles.optionsContainer,
            }}>
            <MenuOption
              style={styles.menuOption}
              onSelect={() => {
                setVisibleModal(true);
              }}>
              <Image source={Images.penBold} style={styles.editImg} />
              <GText
                GrMedium
                style={styles.editText}
                text={t('edit_expense_string')}
              />
            </MenuOption>
            <View style={styles.menuDivider} />
            <MenuOption style={styles.menuOption} onSelect={() => {}}>
              <Image source={Images.deleteBold} style={styles.editImg} />
              <GText
                GrMedium
                style={styles.editText}
                text={t('del_expense_string')}
              />
            </MenuOption>
          </MenuOptions>
        </Menu>

        <View style={styles.tileContainer}>
          <View style={styles.innerTileContainer}>
            <GText
              componentProps={{
                numberOfLines: 1,
                ellipsizeMode: 'tail',
              }}
              GrMedium
              style={styles.taskText}
              text={item.task}
            />
            <GText SatoshiBold style={styles.billText} text={item.billId} />
            <GText
              componentProps={{}}
              SatoshiBold
              style={styles.businessText}
              text={item.businessName}
            />
          </View>

          <View>
            <View style={styles.priceTile(item?.status)}>
              <GText GrMedium style={styles.priceText} text={item.price} />
              <GText
                SatoshiBold
                style={[styles.statusText]}
                text={item.status}
              />
            </View>
            <GText SatoshiBold style={styles.dateText} text={item.date} />
          </View>
        </View>
        {item?.status != 'Paid' && (
          <GButton
            icon={Images.money}
            iconStyle={styles.threeDots}
            title={`Pay $${item?.price}`}
            style={styles.payBtnView}
            textStyle={styles.payTxtStyle}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        <LinearGradient
          colors={['#141413', '#595958']}
          start={{x: 0, y: 1}}
          end={{x: 1.5, y: 1}}
          style={styles.yearlySpendView}>
          <View style={styles.petView}>
            <Image style={styles.kiziImage} source={Images.Kizi} />
          </View>
          <GText
            GrMedium
            style={styles.subHeading}
            text={t('yearly_spend_string')}
          />
          <GText GrMedium style={styles.price} text="$ 2,487" />
        </LinearGradient>
        <GButton
          onPress={() => setVisible(true)}
          icon={Images.addImage}
          iconStyle={styles.addImage}
          title={t('add_expense_string')}
          style={styles.expenseBtn}
        />
        <View style={styles.recentView}>
          <GText GrMedium text={t('recent_string')} style={styles.recentText} />
          <View>
            <GText GrMedium text={'$603.71'} style={styles.outstandAmt} />
            <GText
              SatoshiBold
              text={'Outstanding Amount'}
              style={styles.outstandTxt}
            />
          </View>
        </View>
        <FlatList
          contentContainerStyle={styles.flatListContainer}
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
              style={styles.crossIconStyle}>
              <Image style={styles.crossIcon} source={Images.crossIcon} />
            </TouchableOpacity>
            <View
              style={[
                styles.petView,
                {marginTop: scaledValue(30), borderColor: colors.jetLightBlack},
              ]}>
              <Image source={Images.Kizi} style={[styles.kiziImage]} />
            </View>
            <GText
              GrMedium
              text={t('add_expense_small_string')}
              style={styles.addText}
            />
            <TouchableOpacity style={{marginTop: scaledValue(40)}}>
              <Image
                source={Images.scan_image}
                style={{
                  width: scaledValue(100),
                  height: scaledValue(100),
                }}
              />
            </TouchableOpacity>
            <GText
              GrMedium
              text={t('scan_bill_string')}
              style={styles.scanText}
            />
            <Input
              value={expenseName}
              label={t('expense_name_string')}
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

        <Modal
          statusBarTranslucent={true}
          onBackdropPress={() => setVisibleModal(false)}
          isVisible={visibleModal}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              onPress={() => setVisibleModal(false)}
              style={styles.crossIconView}>
              <Image style={styles.crossIcon} source={Images.Close} />
            </TouchableOpacity>
            <View
              style={[
                styles.petView,
                {marginTop: scaledValue(30), borderColor: colors.jetLightBlack},
              ]}>
              <Image source={Images.Kizi} style={[styles.kiziImage]} />
            </View>
            <GText
              GrMedium
              text={t('edit_expense_small_string')}
              style={styles.addText}
            />
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
      </ScrollView>
    </View>
  );
};

export default YearlySpendScreen;
