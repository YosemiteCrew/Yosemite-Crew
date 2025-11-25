import React, {useMemo} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '@/hooks';
import {normalizeImageUri} from '@/shared/utils/imageUri';

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
  const [loadFailed, setLoadFailed] = React.useState(false);

  const normalizedUri = React.useMemo(
    () => normalizeImageUri(profileImage ?? null),
    [profileImage],
  );

  const initials = useMemo(() => {
    const trimmed = name?.trim();
    if (!trimmed) {
      return 'C';
    }
    return trimmed.charAt(0).toUpperCase();
  }, [name]);

  React.useEffect(() => {
    setLoadFailed(false);
  }, [normalizedUri]);

  const shouldRenderImage = normalizedUri && !loadFailed;

  return (
    <View style={styles.profileHeader}>
      <View style={[styles.avatar, {width: size, height: size, borderRadius: size / 2}]}>
        {shouldRenderImage ? (
          <Image
            source={{uri: normalizedUri}}
            style={styles.avatarImage}
            onError={() => setLoadFailed(true)}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initials}</Text>
          </View>
        )}
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
    avatarFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySurface,
    },
    avatarInitial: {
      ...theme.typography.h4,
      color: theme.colors.primary,
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
