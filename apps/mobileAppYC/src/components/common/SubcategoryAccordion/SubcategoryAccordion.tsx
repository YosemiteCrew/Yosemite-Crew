import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface SubcategoryAccordionProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  containerStyle?: any;
}

export const SubcategoryAccordion: React.FC<SubcategoryAccordionProps> = ({
  title,
  subtitle,
  children,
  defaultExpanded = false,
  containerStyle,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}>
        <View style={styles.headerContent}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Image
          source={Images.dropdownIcon}
          style={[
            styles.chevron,
            expanded && styles.chevronExpanded,
          ]}
        />
      </TouchableOpacity>

      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing[3],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing[4],
      backgroundColor: theme.colors.surface,
    },
    headerContent: {
      flex: 1,
      gap: theme.spacing[1],
      marginRight: theme.spacing[3],
    },
    title: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    subtitle: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
    },
    chevron: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
      transform: [{rotate: '0deg'}],
    },
    chevronExpanded: {
      transform: [{rotate: '180deg'}],
    },
    content: {
      padding: theme.spacing[4],
      paddingTop: theme.spacing[2],
      gap: theme.spacing[2],
    },
  });
