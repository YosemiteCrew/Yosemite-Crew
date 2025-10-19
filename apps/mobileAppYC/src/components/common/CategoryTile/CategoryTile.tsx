import React from 'react';
import {Image, ImageSourcePropType, StyleSheet} from 'react-native';
import {Images} from '@/assets/images';
import {IconInfoTile} from '@/components/common/tiles/IconInfoTile';

export interface CategoryTileProps {
  icon: ImageSourcePropType;
  title: string;
  subtitle: string;
  isSynced?: boolean;
  onPress: () => void;
  containerStyle?: any;
}

export const CategoryTile: React.FC<CategoryTileProps> = ({
  icon,
  title,
  subtitle,
  isSynced = false,
  onPress,
  containerStyle,
}) => {
  return (
    <IconInfoTile
      icon={icon}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      isSynced={isSynced}
      syncLabel={'Synced with\nYosemite Crew PMS'}
      rightAccessory={
        <Image
          source={Images.rightArrow}
          style={styles.rightArrow}
        />
      }
      containerStyle={containerStyle}
    />
  );
};

const styles = StyleSheet.create({
  rightArrow: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: '#7A7F85',
  },
});
