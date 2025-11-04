import React, {useMemo} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface CompanionProfileImageProps {
  name: string;
  breedName?: string | null;
  profileImage?: string | null;
  size?: number;
}

export const CompanionProfileImage: React.FC<CompanionProfileImageProps> = ({
  name,
  breedName,
  profileImage,
  size = 100,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const imageSource = profileImage ? {uri: profileImage} : Images.cat;

  return (
    <View style={styles.profileHeader}>
      <View style={[styles.avatar, {width: size, height: size, borderRadius: size / 2}]}>
        <Image source={imageSource} style={styles.avatarImage} />
      </View>
      <Text style={styles.profileName}>{name}</Text>
      <Text style={styles.profileBreed}>{breedName ?? 'Unknown Breed'}</Text>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    profileHeader: {
      alignItems: 'center',
      marginBottom: theme.spacing[6],
      marginTop: theme.spacing[4],
    },
    avatar: {
      backgroundColor: theme.colors.lightBlueBackground,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary,
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    profileName: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
      marginTop: theme.spacing['4'],
    },
    profileBreed: {
      ...theme.typography.labelMdBold,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing['1'],
    },
  });

export default CompanionProfileImage;
