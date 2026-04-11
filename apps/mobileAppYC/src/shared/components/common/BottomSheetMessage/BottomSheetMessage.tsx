import React, {useMemo} from 'react';
import {StyleSheet, Text, View, type TextProps, type ViewProps} from 'react-native';
import {useTheme} from '@/hooks';

type BottomSheetMessageComponent = React.FC<{children: React.ReactNode} & ViewProps> & {
  Highlight: React.FC<TextProps>;
};

const BottomSheetMessageInner = ({children, style, ...rest}: any) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.messageContainer, style]} {...rest}>
      <Text style={styles.messageText}>{children}</Text>
    </View>
  );
};

const Highlight: React.FC<TextProps> = ({children, style, ...rest}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Text style={[styles.highlightText, style]} {...rest}>
      {children}
    </Text>
  );
};

export const BottomSheetMessage = BottomSheetMessageInner as BottomSheetMessageComponent;
BottomSheetMessage.Highlight = Highlight;

const createStyles = (theme: any) =>
  StyleSheet.create({
    messageContainer: {
      paddingHorizontal: theme.spacing['2'],
      marginBottom: theme.spacing['2'],
    },
    messageText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    highlightText: {
      color: theme.colors.secondary,
      fontWeight: '600',
    },
  });

export default BottomSheetMessage;
