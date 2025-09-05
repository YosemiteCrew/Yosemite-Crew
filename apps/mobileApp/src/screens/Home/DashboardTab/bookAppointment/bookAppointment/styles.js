import {Dimensions, StyleSheet} from 'react-native';
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
  doctorNameText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.8),
    letterSpacing: scaledValue(18 * -0.01),
    color: '#090A0A',
  },
  doctorImgStyle: {
    width: scaledValue(88),
    height: scaledValue(88),
    borderRadius: scaledValue(12),
  },
  card: {
    //   width: scaledValue(335),
    //   backgroundColor: colors.white,
    //   flexDirection: 'row',
    marginTop: scaledValue(22),
    marginHorizontal: scaledValue(20),
    //   borderRadius: scaledValue(20),
    paddingBottom: scaledValue(16),
    paddingTop: scaledValue(12),
    paddingLeft: scaledValue(12),
    //   borderColor: colors.paletteWhite,
    //  shadowColor: '##47382714',
    //   shadowOffset: { width: 6, height: 2 },
    //   shadowOpacity: 0.15,
    //   shadowRadius: 20,
    //   elevation: 4,
    backgroundColor: colors.white,
    width: scaledValue(335),
    borderRadius: scaledValue(20),
    borderColor: colors.paletteWhite,
    shadowColor: '##47382714',
    shadowOffset: {width: 6, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    flexDirection: 'row',
  },
  departmentText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),

    opacity: 0.7,
    marginTop: scaledValue(2),
  },
  textView: {
    marginLeft: scaledValue(8),
  },
  ongoingText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.jetBlack,
  },
  plansText: {
    fontSize: scaledValue(18),
    letterSpacing: scaledValue(18 * -0.01),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaledValue(28),
    paddingHorizontal: scaledValue(19),
  },
  petTitle: {
    fontSize: scaledValue(16),
    lineHeight: scaledHeightValue(19.2),
    letterSpacing: scaledValue(16 * -0.02),

    marginTop: scaledValue(4),
  },
  imgStyle: {
    width: scaledValue(60),
    height: scaledValue(60),
    borderRadius: scaledValue(30),
  },
  petItem: {
    alignItems: 'center',
  },
  petListContainer: {
    flexDirection: 'row',
    marginTop: scaledValue(16),
    rowGap: scaledValue(12),
    paddingHorizontal: scaledValue(19),
  },
  professionalButton: {
    borderWidth: scaledValue(0.5),
    height: scaledValue(48),
    marginTop: scaledValue(12),
    borderRadius: scaledValue(24),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: scaledValue(20),
  },
  professionalText: {
    fontSize: scaledValue(16),
    letterSpacing: scaledValue(16 * -0.03),
  },
  arrowIcon: {
    width: scaledValue(20),
    height: scaledValue(20),
  },
  dayText: (pickSlot, item) => ({
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: pickSlot === item ? colors.paletteWhite : colors.jetBlack,
    opacity: 0.7,
    marginTop: scaledValue(8),
  }),
  dateText: (pickSlot, item) => ({
    fontSize: scaledValue(20),
    lineHeight: scaledHeightValue(24),
    color: pickSlot === item ? colors.paletteWhite : colors.jetBlack,
    letterSpacing: scaledValue(20 * -0.01),
  }),
  slotText: (pickSlot, item) => ({
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color: pickSlot === item ? colors.paletteWhite : colors.jetBlack,
    marginTop: scaledValue(8),
    marginBottom: scaledValue(8),
  }),
  slotTime: (pickSlotTime, item) => ({
    fontSize: scaledValue(13),
    lineHeight: scaledHeightValue(15.6),
    color:
      pickSlotTime === item?.resource?.slotTime
        ? colors.white
        : colors.jetBlack,
    textAlign: 'center',
    opacity: item?.resource?.isBooked === 'true' ? 0.4 : 1,
  }),
  inputStyle: {
    height: scaledValue(114),
    marginTop: scaledValue(12),
    borderRadius: scaledValue(16),
    borderColor: '#312943',
    width: Dimensions.get('screen').width - 40,
    textAlignVertical: 'top',
    borderWidth: scaledValue(0.5),
    padding: scaledValue(15),
  },
  uploadContainer: {
    width: scaledValue(335),
    borderWidth: scaledValue(1),
    borderStyle: 'dashed',
    borderRadius: scaledValue(20),
    borderColor: '#37223C4D',
    marginTop: scaledValue(32),
    alignSelf: 'center',
  },
  uploadImage: {
    width: scaledValue(40),
    height: scaledValue(40),
    alignSelf: 'center',
    marginTop: scaledValue(16),
    tintColor: colors.jetBlack,
  },
  uploadText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(21.6),
    letterSpacing: scaledValue(18 * -0.01),

    textAlign: 'center',
    paddingHorizontal: scaledValue(53),
    marginTop: scaledValue(10),
  },
  documentText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),

    textAlign: 'center',
    paddingHorizontal: scaledValue(53),
    opacity: 0.7,
    marginTop: scaledValue(10),
    marginBottom: scaledValue(16),
  },
  buttonText: {
    fontSize: scaledValue(18),
    lineHeight: scaledHeightValue(18),
    letterSpacing: scaledValue(18 * -0.01),
    color: colors.white,
    fontFamily: fonts?.CLASH_GRO_MEDIUM,
  },
  buttonStyle: {
    backgroundColor: colors.jetBlack,
    marginTop: scaledValue(40),
    marginBottom: scaledValue(62),
    height: scaledValue(52),
    borderRadius: scaledValue(28),
    marginHorizontal: scaledValue(20),
  },
  slotListUpperView: {
    marginTop: scaledValue(28),
    marginLeft: scaledValue(20),
  },
  slotCard: (pickSlot, item) => ({
    backgroundColor:
      pickSlot === item?.code?.date ? colors.jetBlack : colors.white,
    width: scaledValue(64),
    alignItems: 'center',
    opacity: item?.valueInteger === 0 && 0.5,
    borderRadius: scaledValue(8),
    borderColor: colors.paletteWhite,
    shadowColor: '##47382714',
    shadowOffset: {width: -0, height: -0.5},
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 8,
    marginVertical: scaledValue(8),
    marginHorizontal: scaledValue(2),
  }),
  slotTimeUpperView: {
    marginTop: scaledValue(39),
    paddingHorizontal: scaledValue(20),
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: scaledValue(8),
    rowGap: scaledValue(16),
    backgroundColor: 'transparent',
  },
  slotTimeCard: (pickSlotTime, i) => ({
    backgroundColor:
      pickSlotTime === i?.resource?.slotTime ? colors.jetBlack : 'transparent',
    borderRadius: scaledValue(8),
    height: scaledValue(40),
    justifyContent: 'center',
    shadowColor: '#47382726',
    shadowOffset: {width: 1, height: 5},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    borderWidth:
      i?.resource?.isBooked === 'true'
        ? scaledValue(0.5)
        : pickSlotTime != i?.resource?.slotTime
        ? scaledValue(0.75)
        : 0,
    paddingHorizontal: scaledValue(11),
    opacity: i?.resource?.isBooked === 'true' && 0.4,
    borderColor: colors.jetBlack,
  }),
  timeContentContainer: {
    gap: scaledValue(8),
    backgroundColor: 'red',
    // marginBottom: scaledHeightValue(16),
    // paddingHorizontal: scaledValue(20),
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    fontSize: scaledValue(16),
    // lineHeight: scaledValue(16),
    // marginTop: scaledValue(20),
    paddingLeft: scaledValue(10),
  },
  imageStyle: {
    width: scaledValue(100),
    height: scaledValue(100),
  },
  crossStyle: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  crossImgView: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  PlusIconImage: {
    width: scaledValue(24),
    height: scaledValue(24),
  },
  addImgButton: {
    width: scaledValue(100),
    height: scaledValue(100),
    borderWidth: scaledValue(1),
    borderColor: '#37223C4D',
    borderStyle: 'dashed',
    borderRadius: scaledValue(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  petUnderline: isSelected => ({
    width: scaledValue(80),
    height: scaledValue(1),
    backgroundColor: isSelected ? '#247AED' : 'transparent',
  }),
});
