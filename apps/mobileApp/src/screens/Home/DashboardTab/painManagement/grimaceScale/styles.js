import {StyleSheet} from 'react-native';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../utils/design.utils';
import {fonts} from '../../../../../utils/fonts';
import {colors} from '../../../../../../assets/colors';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: colors.themeColor,
  },
  scrollView: {
    flex: 1,
  },
  headerRight: {
    paddingRight: scaledValue(20),
  },
  headerLeft: {
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: scaledValue(28),
    height: scaledValue(28),
  },
  headerButton: {
    marginHorizontal: scaledValue(20),
  },
  questionsText: {
    fontSize: scaledValue(12),
    lineHeight: scaledValue(12),
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  cardContainer: {
    marginTop: scaledValue(28),
    backgroundColor: colors.themeColor,
    marginHorizontal: scaledValue(20),
    borderRadius: scaledValue(20),
    shadowColor: '#47382726',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 10,
    borderWidth: scaledValue(1),
    borderColor: colors.jetBlack50,
    marginBottom: scaledValue(33),
  },
  petImg: {
    width: scaledValue(60),
    height: scaledValue(60),
    marginTop: scaledValue(28),
    alignSelf: 'center',
  },
  titleText: {
    fontSize: scaledValue(18),
    lineHeight: scaledValue(25.2),
    textAlign: 'center',
    letterSpacing: scaledValue(18 * -0.02),
    marginTop: scaledValue(20),
  },
  subTitleText: {
    fontSize: scaledValue(14),
    lineHeight: scaledValue(16.8),
    textAlign: 'center',
    opacity: 0.7,
    marginTop: scaledValue(8),
    paddingHorizontal: scaledValue(30),
    paddingBottom: scaledValue(30),
  },
  imgStyle: {
    width: scaledValue(100),
    height: scaledValue(100),
  },
  tileStyle: (select, item) => ({
    flexDirection: 'row',
    borderWidth: scaledValue(1),
    borderColor: '#37223C1A',
    paddingVertical: scaledValue(12),
    borderRadius: scaledValue(20),
    paddingHorizontal: scaledValue(12),
    backgroundColor: select === item?.id ? colors.jetBlack : 'transparent',
  }),
  titleStyle: (select, item) => ({
    fontSize: scaledValue(18),
    lineHeight: scaledValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    marginTop: scaledValue(8),
    marginLeft: scaledValue(12),
    color: select === item?.id ? colors.white : colors.jetBlack,
    width: '65%',
  }),
  listView: {
    paddingHorizontal: scaledValue(20),
    gap: scaledValue(16),
  },
  filledButtonText: {
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.brown,
  },
  filledButtonStyle: {
    width: '90%',
    alignSelf: 'center',
    marginBottom: scaledValue(58),
  },
});
