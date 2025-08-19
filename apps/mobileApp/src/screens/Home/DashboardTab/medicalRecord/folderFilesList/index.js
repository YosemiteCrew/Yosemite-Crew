import {StyleSheet, Text, View} from 'react-native';
import React, {useEffect} from 'react';
import HeaderButton from '../../../../../components/HeaderButton';
import {Images} from '../../../../../utils';
import {colors} from '../../../../../../assets/colors';

const FolderFilesList = ({navigation}) => {
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton
          icon={Images.arrowLeftOutline}
          tintColor={colors.jetBlack}
          onPress={() => navigation.goBack()}
        />
      ),
    });
  }, []);
  return (
    <View>
      <Text>FolderFilesList</Text>
    </View>
  );
};

export default FolderFilesList;

const styles = StyleSheet.create({});
