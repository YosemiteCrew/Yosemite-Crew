import React, {useState, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  Image,
  ScrollView,
  ViewToken,
  type ListRenderItem,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import {InkAnnotation} from '@/shared/components/common/InkAnnotation';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useReducedMotion} from '@/shared/components/common/Skeleton/useReducedMotion';
import {MEDIA_SOURCES} from '@/shared/constants/mediaSources';
import type {Theme} from '@/theme';

interface OnboardingScreenProps {
  onComplete: () => void;
}

type VideoSource = React.ComponentProps<typeof Video>['source'];

interface Slide {
  id: string;
  video: VideoSource;
  lead: string;
  accent: string;
  accentDelay: number;
  subtitle: string;
  cta: string;
}

// Served from the curated media CDN instead of bundled locally to keep the
// app binary smaller and allow the source video to be updated without a
// release.
const VIDEO_CAT = {uri: MEDIA_SOURCES.onboarding.slide1.video};
const VIDEO_DOG = {uri: MEDIA_SOURCES.onboarding.slide2.video};
const VIDEO_CARE = {uri: MEDIA_SOURCES.onboarding.slide3.video};

const SLIDE_META = [
  {id: '1', video: VIDEO_CAT, accentDelay: 1000},
  {id: '2', video: VIDEO_DOG, accentDelay: 600},
  {id: '3', video: VIDEO_CARE, accentDelay: 600},
] as const;

const CLUSTER = [
  {
    key: 'cat',
    source: require('../../../assets/images/addCompanion/cat.png'),
    variant: 'avatarCat',
  },
  {
    key: 'dog',
    source: require('../../../assets/images/addCompanion/dog.png'),
    variant: 'avatarDog',
  },
  {
    key: 'equine',
    source: require('../../../assets/images/addCompanion/equine.png'),
    variant: 'avatarEquine',
  },
] as const;

const LOGO = require('../../../assets/images/yosemite-logo-1024.png');

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const {width, height} = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const reduceMotion = useReducedMotion();

  const SLIDES: Slide[] = useMemo(
    () => [
      {
        ...SLIDE_META[0],
        lead: t('onboarding.slide1_lead'),
        accent: t('onboarding.slide1_accent'),
        subtitle: t('onboarding.slide1_subtitle'),
        cta: t('onboarding.continue'),
      },
      {
        ...SLIDE_META[1],
        lead: t('onboarding.slide2_lead'),
        accent: t('onboarding.slide2_accent'),
        subtitle: t('onboarding.slide2_subtitle'),
        cta: t('onboarding.continue'),
      },
      {
        ...SLIDE_META[2],
        lead: t('onboarding.slide3_lead'),
        accent: t('onboarding.slide3_accent'),
        subtitle: t('onboarding.slide3_subtitle'),
        cta: t('onboarding.getStarted'),
      },
    ],
    [t],
  );

  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({itemVisiblePercentThreshold: 60}).current;

  const styles = useMemo(() => createStyles(theme), [theme]);
  const accentTextStyle = useMemo(
    () => [
      theme.typography.onboardingHeadline,
      {fontFamily: theme.typography.NEWSREADER_ITALIC},
    ],
    [theme],
  );

  const goNext = useCallback(
    (index: number) => {
      if (index >= SLIDES.length - 1) {
        onComplete();
        return;
      }
      flatListRef.current?.scrollToIndex({index: index + 1, animated: true});
    },
    [SLIDES.length, onComplete],
  );

  const renderSlide = useCallback<ListRenderItem<Slide>>(
    ({item, index}) => {
      const isActive = index === currentIndex;
      return (
        <View style={[styles.slide, {width, height}]}>
          {/* Looping video + scrim (top media band) */}
          <View style={[styles.media, {height: height * 0.6}]}>
            <Video
              source={item.video}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              repeat
              muted
              paused={!isActive || reduceMotion}
              playInBackground={false}
              disableFocus
              ignoreSilentSwitch="obey"
            />
            <LinearGradient
              colors={[
                'rgba(29,28,27,0.22)',
                'rgba(29,28,27,0.0)',
                'rgba(29,28,27,0.0)',
                theme.colors.screen,
              ]}
              locations={[0, 0.22, 0.42, 0.99]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </View>

          {/* Top bar over the video */}
          <SafeAreaView edges={['top']} style={styles.topBarWrap}>
            <View style={styles.topBar}>
              {index === 0 ? (
                <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              ) : (
                <PressableOpacity
                  style={styles.glassCircle}
                  onPress={() =>
                    flatListRef.current?.scrollToIndex({
                      index: index - 1,
                      animated: true,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.back')}>
                  <Text style={styles.chevron}>‹</Text>
                </PressableOpacity>
              )}
              {index < SLIDES.length - 1 ? (
                <PressableOpacity
                  style={styles.skipPill}
                  onPress={onComplete}
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.skipOnboarding')}>
                  <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
                </PressableOpacity>
              ) : (
                <View style={styles.glassCircle} />
              )}
            </View>
          </SafeAreaView>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView
              testID="onboarding-content-scroll"
              style={styles.contentScroll}
              contentContainerStyle={styles.contentScrollInner}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              <View style={styles.contentTop}>
                {index === 0 ? (
                  <View style={styles.cluster}>
                    {CLUSTER.map(avatar => (
                      <View
                        key={avatar.key}
                        style={[styles.avatar, styles[avatar.variant]]}>
                        <Image
                          source={avatar.source}
                          style={styles.avatarImg}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.headline}>
                  <Text style={styles.lead}>{item.lead}</Text>
                  <InkAnnotation
                    color={theme.colors.pink}
                    type="circle"
                    italic
                    delay={item.accentDelay}
                    active={isActive}
                    textStyle={accentTextStyle}>
                    {item.accent}
                  </InkAnnotation>
                </View>

                <Text style={styles.subtitle}>{item.subtitle}</Text>

                <View style={styles.dots}>
                  {SLIDES.map((slide, dotIndex) => (
                    <View
                      key={slide.id}
                      style={[
                        styles.dot,
                        dotIndex === currentIndex
                          ? styles.dotActive
                          : styles.dotIdle,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.contentBottom}>
                <PressableOpacity
                  style={styles.ctaButton}
                  onPress={() => goNext(index)}
                  accessibilityRole="button"
                  accessibilityLabel={item.cta}>
                  <Text style={styles.ctaText}>{item.cta}</Text>
                </PressableOpacity>

                <View style={styles.signInRow}>
                  <Text style={styles.signInMuted}>
                    {t('onboarding.alreadyHaveAccount')}
                  </Text>
                  <Text style={styles.signInLink} onPress={onComplete}>
                    {t('onboarding.signIn')}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      );
    },
    [
      SLIDES,
      accentTextStyle,
      currentIndex,
      goNext,
      height,
      onComplete,
      reduceMotion,
      styles,
      t,
      theme.colors.pink,
      theme.colors.screen,
      width,
    ],
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.screen},
    slide: {flex: 1, backgroundColor: theme.colors.screen},
    media: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.inset,
    },
    topBarWrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['2'],
    },
    logo: {width: 44, height: 44},
    glassCircle: {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.glassPill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.glassPillBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevron: {
      fontSize: 26,
      lineHeight: 28,
      color: theme.colors.inkBody,
      marginTop: -2,
    },
    skipPill: {
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['2'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.glassPill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.glassPillBorder,
    },
    skipText: {...theme.typography.labelSmall, color: theme.colors.inkBody},
    content: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: '52%',
    },
    contentScroll: {
      flex: 1,
    },
    contentScrollInner: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['8'],
      justifyContent: 'space-between',
    },
    contentTop: {alignItems: 'center'},
    contentBottom: {alignItems: 'center'},
    cluster: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: theme.spacing['4'],
    },
    avatar: {
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: theme.colors.screen,
      backgroundColor: theme.colors.inset,
      ...theme.shadows.lg,
    },
    avatarCat: {width: 60, height: 60, borderRadius: 30, zIndex: 1},
    avatarDog: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginLeft: -14,
      zIndex: 2,
    },
    avatarEquine: {
      width: 60,
      height: 60,
      borderRadius: 30,
      marginLeft: -14,
      zIndex: 1,
    },
    avatarImg: {width: '100%', height: '100%', resizeMode: 'cover'},
    headline: {alignItems: 'center', gap: theme.spacing['1']},
    lead: {
      ...theme.typography.onboardingHeadline,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
      textAlign: 'center',
      marginTop: theme.spacing['3'],
      maxWidth: 300,
    },
    dots: {
      flexDirection: 'row',
      gap: theme.spacing['2'],
      marginTop: theme.spacing['5'],
    },
    dot: {height: 7, borderRadius: theme.borderRadius.full},
    dotActive: {width: 22, backgroundColor: theme.colors.blue},
    dotIdle: {width: 7, backgroundColor: theme.colors.divider},
    ctaButton: {
      width: '100%',
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.cta,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.md,
    },
    ctaText: {...theme.typography.buttonLarge, color: theme.colors.ctaText},
    signInRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing['4'],
    },
    signInMuted: {...theme.typography.body, color: theme.colors.inkMuted},
    signInLink: {...theme.typography.bodyMedium, color: theme.colors.blueText},
  });
