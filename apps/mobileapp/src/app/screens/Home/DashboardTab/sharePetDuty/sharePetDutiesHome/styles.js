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
    paddingHorizontal: scaledValue(20),
  },
  headerRow: {
    flexDirection: 'row',
    marginTop: scaledValue(38),
  },
  ongoingText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.appRed,
  },
  plansText: {
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    letterSpacing: scaledValue(20 * -0.01),
    color: colors.darkPurple,
  },
  userListContainer: {marginTop: scaledValue(30), flexDirection: 'row'},
  userListContentContainer: {gap: scaledValue(12)},
  userItem: {alignItems: 'center'},
  userImage: {width: scaledValue(80), height: scaledValue(80)},
  userNameText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    marginTop: scaledValue(2),
  },
  userTaskText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.appRed,
    marginTop: scaledValue(2),
  },
  addCoOwnerContainer: {marginLeft: scaledValue(16)},
  addCoOwnerText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    marginTop: scaledValue(4),
    textAlign: 'center',
  },
  taskItemContainer: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    width: scaledValue(335),
    backgroundColor: '#FFF2E3',
    borderRadius: scaledValue(20),
  },
  taskItemContent: {flexDirection: 'row', right: scaledValue(10)},
  taskPetImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    right: scaledValue(-10),
  },
  taskUserImage: {
    width: scaledValue(40),
    height: scaledValue(40),
  },
  taskItemDetails: {paddingLeft: scaledValue(12)},
  taskTitle: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.appRed,
  },
  taskDate: {
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: colors.darkPurple,
    opacity: 0.7,
    marginTop: scaledValue(4),
  },
  taskInfoRow: {
    flexDirection: 'row',
    marginTop: scaledValue(4),
    alignItems: 'center',
    gap: scaledValue(8),
  },
  taskInfoItem: {
    flexDirection: 'row',
  },
  taskInfoLabel: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
    opacity: 0.7,
  },
  taskInfoValue: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.appRed,
    opacity: 0.7,
  },
  taskDotSeparator: {
    width: scaledValue(4),
    height: scaledValue(4),
    borderRadius: scaledValue(10),
    backgroundColor: colors.appRed,
  },
  taskMenuIcon: {width: scaledValue(20), height: scaledValue(20)},
  taskInnerView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaledValue(20),
    paddingHorizontal: scaledValue(12),
    paddingBottom: scaledValue(20),
  },
  bottomSheetSubTitle: {
    fontSize: scaledValue(14),
    color: '#3D3D3D',
    fontFamily: fonts.SATOSHI_REGULAR,
    lineHeight: scaledHeightValue(16.8),
  },
  hitSlop: {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20,
  },
  modalContainer: {
    backgroundColor: colors.white,
    height: scaledValue(428),
    borderRadius: scaledValue(24),
  },
  petWalkImage: {
    height: scaledValue(200),
    width: scaledValue(200),
    alignSelf: 'center',
    marginTop: scaledValue(30),
  },
  modalHeading: {
    fontSize: scaledValue(23),
    lineHeight: scaledValue(27.6),
    letterSpacing: scaledValue(23 * -0.01),
    marginTop: scaledValue(20),
    marginBottom: scaledValue(8),
    textAlign: 'center',
  },
  modalSubHeading: {
    fontSize: scaledValue(16),
    lineHeight: scaledValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),
    textAlign: 'center',
    marginBottom: scaledValue(24),
  },
  buttonView: {
    marginHorizontal: scaledValue(24),
    height: scaledValue(50),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
