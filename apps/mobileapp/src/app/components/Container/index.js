import {SafeAreaView, StyleSheet} from 'react-native';
import React from 'react';
import {scaledValue} from '../../utils/design.utils';
import {colors} from '../../../assets/colors';

const Container = props => {
  return (
    <SafeAreaView
      style={[styles.container, props?.style]}
      forceInset={{top: 'always'}}>
      {props?.children}
    </SafeAreaView>
  );
};

export default Container;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: scaledValue(20),
    backgroundColor: colors.themeColor,
  },
});
