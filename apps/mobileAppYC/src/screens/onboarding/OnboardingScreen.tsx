/* eslint-disable react-native/no-inline-styles */
import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  Image,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks';
import {
  LiquidGlassButton,
} from '@/components/common/LiquidGlassButton/LiquidGlassButton';

const { width, height } = Dimensions.get('window');

interface OnboardingItem {
  id: string;
  textImage: any;
  bottomImage: any;
  textImageWidth: number; // Custom width for text image
  bottomImageHeight: number; // Custom height for bottom image
}

interface OnboardingScreenProps {
  onComplete: () => void;
}

const onboardingData: OnboardingItem[] = [
  {
    id: '1',
    textImage: require('../../assets/images/onboarding/text-image-1.png'),
    bottomImage: require('../../assets/images/onboarding/bottom-image-1.png'),
    textImageWidth: 0.55, // 60% of screen width for slide 1
    bottomImageHeight: 0.5, // 60% of screen height for slide 1
  },
  {
    id: '2',
    textImage: require('../../assets/images/onboarding/text-image-2.png'),
    bottomImage: require('../../assets/images/onboarding/bottom-image-2.png'),
    textImageWidth: 0.85, // 70% of screen width for slide 2
    bottomImageHeight: 0.55, // 55% of screen height for slide 2
  },
  {
    id: '3',
    textImage: require('../../assets/images/onboarding/text-image-3.png'),
    bottomImage: require('../../assets/images/onboarding/bottom-image-3.png'),
    textImageWidth: 0.8, // 65% of screen width for slide 3
    bottomImageHeight: 0.6, // 65% of screen height for slide 3
  },
  {
    id: '4',
    textImage: require('../../assets/images/onboarding/text-image-4.png'),
    bottomImage: require('../../assets/images/onboarding/bottom-image-4.png'),
    textImageWidth: 0.7, // 75% of screen width for slide 4
    bottomImageHeight: 0.6, // 50% of screen height for slide 4
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
}) => {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index || 0);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {onboardingData.map((item, index) => (
          <View
            key={`onboarding-dot-${item.id}`}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === currentIndex
                    ? theme.colors.black
                    : theme.colors.textSecondary,
                opacity: index === currentIndex ? 1 : 0.3,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderOnboardingItem = ({
    item,
    index,
  }: {
    item: OnboardingItem;
    index: number;
  }) => {
    const isLastSlide = index === onboardingData.length - 1;

    return (
      <View style={styles.slideContainer}>
        {/* Text Image */}
        <View style={styles.textImageContainer}>
          <Image
            source={item.textImage}
            style={[styles.textImage, { width: width * item.textImageWidth }]}
            resizeMode="contain"
          />
        </View>

        {/* Dots Indicator */}
        {renderDots()}

        {/* Bottom Image */}
        <View
          style={[
            styles.bottomImageContainer,
            { height: height * item.bottomImageHeight },
          ]}
        >
          <Image
            source={item.bottomImage}
            style={styles.bottomImage}
            resizeMode="cover"
          />
        </View>

        {/* Get Started Button (only on last slide) */}
        {isLastSlide && (
          <View style={styles.getStartedContainer}>

            <LiquidGlassButton
              title="Get Started"
              glassEffect="clear"
              style={styles.getStartedButton}
              borderRadius="lg"
              height={60}
              tintColor="#302F2E"
              width={width * 0.45}
              textStyle={styles.getStartedText}
              onPress={() => onComplete()}
            />
          </View>
        )}
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    slideContainer: {
      width,
      height,
      backgroundColor: '#FFFFFF',
      position: 'relative',
    },
    textImageContainer: {
      position: 'absolute',
      top: height * 0.1,
      left: 0,
      right: 0,
      height: height * 0.15,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['6'],
    },
    textImage: {
      // Width is now set dynamically in renderOnboardingItem
      height: '100%',
    },
    dotsContainer: {
      position: 'absolute',
      top: height * 0.3,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['4'],
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginHorizontal: 4,
    },
    bottomImageContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
      // Height is now set dynamically in renderOnboardingItem
      justifyContent: 'flex-end',
    },
    bottomImage: {
      width: '100%',
      height: '100%',
    },
    getStartedContainer: {
      position: 'absolute',
      bottom: height * 0.48,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: theme.spacing['6'],
    },
    getStartedButton: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    getStartedText: {
      ...theme.typography.h5,
      color: theme.colors.white,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        ref={flatListRef}
        data={onboardingData}
        renderItem={renderOnboardingItem}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );
};
