import React from 'react';
import {Image, ImageSourcePropType, StyleSheet} from 'react-native';
import {Images} from '@/assets/images';
import {IconInfoTile} from '@/shared/components/common/tiles/IconInfoTile';
import {useTheme} from '@/hooks';

export interface CategoryTileProps {
  icon: ImageSourcePropType;
  title: string;
  subtitle: string;
  isSynced?: boolean;
  onPress: () => void;
  containerStyle?: any;
  iconTint?: string;
}

export const CategoryTile: React.FC<CategoryTileProps> = ({
  icon,
  title,
  subtitle,
  isSynced = false,
  onPress,
  containerStyle,
  iconTint,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const rightArrow = React.useMemo(
    () => <Image source={Images.rightArrow} style={styles.rightArrow} />,
    [styles],
  );

  return (
    <IconInfoTile
      icon={icon}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      isSynced={isSynced}
      syncLabel={'Synced with\nYosemite Crew PMS'}
      rightAccessory={rightArrow}
      containerStyle={containerStyle}
      iconTint={iconTint}
    />
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    rightArrow: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
  });
