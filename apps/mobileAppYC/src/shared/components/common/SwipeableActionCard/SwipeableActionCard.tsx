import React, { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { SwipeableGlassCard } from '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard';
import { useTheme } from '@/hooks';
import { Images } from '@/assets/images';
import {
  ACTION_WIDTH,
  getActionWrapperStyle,
  getEditActionButtonStyle,
  getViewActionButtonStyle,
} from '@/shared/components/common/cardStyles';

export interface SwipeableActionCardProps {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  onPressEdit?: () => void;
  onPressView?: () => void;
  showEditAction?: boolean;
  hideSwipeActions?: boolean;
  actionBackgroundColor?: string;
}

export const SwipeableActionCard: React.FC<SwipeableActionCardProps> = ({
  children,
  containerStyle,
  cardStyle,
  fallbackStyle,
  onPressEdit,
  onPressView,
  showEditAction = true,
  hideSwipeActions = false,
  actionBackgroundColor = 'transparent',
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const totalActionWidth = showEditAction ? ACTION_WIDTH * 2 : ACTION_WIDTH;

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      actionWidth={hideSwipeActions ? 0 : totalActionWidth}
      actionBackgroundColor={actionBackgroundColor}
      actionOverlap={0}
      containerStyle={[styles.container, containerStyle]}
      cardProps={{
        interactive: true,
        glassEffect: 'clear',
        shadow: 'none',
        colorScheme: 'light',
        style: cardStyle,
        fallbackStyle: fallbackStyle,
      }}
      actionContainerStyle={
        hideSwipeActions ? styles.hiddenActionContainer : styles.actionContainer
      }
      renderActionContent={
        hideSwipeActions
          ? undefined
          : (close) => (
              <View
                style={getActionWrapperStyle(showEditAction, theme)}
              >
                {showEditAction && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.actionButton,
                      getEditActionButtonStyle(theme),
                      { width: ACTION_WIDTH },
                    ]}
                    onPress={() => {
                      close();
                      onPressEdit?.();
                    }}
                  >
                    <Image
                      source={Images.editIconSlide}
                      style={styles.actionIcon}
                    />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.actionButton,
                    getViewActionButtonStyle(theme),
                    { width: ACTION_WIDTH },
                  ]}
                  onPress={() => {
                    close();
                    onPressView?.();
                  }}
                >
                  <Image
                    source={Images.viewIconSlide}
                    style={styles.actionIcon}
                  />
                </TouchableOpacity>
              </View>
            )
      }
    >
      {children}
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
      marginBottom: theme.spacing['3'],
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
    },
    hiddenActionContainer: {
      width: 0,
    },
    actionButton: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionIcon: {
      width: 30,
      height: 30,
      resizeMode: 'contain' as const,
    },
  });
