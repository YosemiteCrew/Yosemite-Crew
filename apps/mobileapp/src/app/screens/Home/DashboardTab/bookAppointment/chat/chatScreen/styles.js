import {StyleSheet} from 'react-native';
import {colors} from '../../../../../../../assets/colors';
import {
  scaledHeightValue,
  scaledValue,
} from '../../../../../../utils/design.utils';

export const styles = StyleSheet.create({
  dashboardMainView: {
    flex: 1,
    backgroundColor: '#FEF8F4',
  },
  ownerChatBubble: {
    backgroundColor: '#FBDDBA',
    marginLeft: '20%',
    maxWidth: '68%',
    alignSelf: 'flex-end',
    borderRadius: scaledValue(16),
    marginTop: scaledValue(16),
    borderBottomRightRadius: scaledValue(2),
    paddingHorizontal: scaledValue(10),
    marginHorizontal: scaledValue(20),
  },
  ownerContent: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.darkPurple,
  },
  anotherUser: {
    backgroundColor: '#FFFFFF',
    padding: scaledValue(10),
    maxWidth: '68%',
    alignSelf: 'flex-start',
    borderRadius: scaledValue(16),
    borderBottomLeftRadius: scaledValue(2),
    marginHorizontal: scaledValue(20),
  },
  anotherContent: {
    fontSize: scaledValue(14),
    color: colors.darkPurple,
    justifyContent: 'center',
    lineHeight: scaledHeightValue(16.8),
    opacity: 0.8,
  },
  youText: {
    fontSize: scaledValue(14),
    lineHeight: scaledHeightValue(16.8),
    color: colors.appRed,
    marginBottom: scaledValue(8),
    marginTop: scaledValue(10),
  },
  timeText: {
    fontSize: scaledValue(11),
    lineHeight: scaledHeightValue(13.2),
    color: colors.darkPurple,
    opacity: 0.5,
    marginTop: scaledValue(8),
    marginBottom: scaledValue(10),
  },
  flexContainer: {
    flex: 1,
  },
  inputView: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaledValue(20),
    height: scaledValue(80),
    paddingBottom: scaledValue(15),
  },
  plusImgStyle: {width: scaledValue(24), height: scaledValue(24)},
  input: {
    backgroundColor: '#F7F7FC',
    borderRadius: scaledValue(8),
    height: scaledValue(45),
    width: scaledValue(263),
    paddingLeft: scaledValue(8),
  },
  arrowStyle: {width: scaledValue(28), height: scaledValue(28)},
});
