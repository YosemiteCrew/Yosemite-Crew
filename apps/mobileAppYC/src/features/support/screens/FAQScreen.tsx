import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Header} from '@/shared/components/common';
import {PillSelector} from '@/shared/components/common/PillSelector/PillSelector';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {useTheme} from '@/hooks';
import {FAQ_CATEGORIES, FAQ_ENTRIES, type FAQEntry} from '../data/faqData';
import {Images} from '@/assets/images';
import type {HomeStackParamList} from '@/navigation/types';

const isFabricEnabled =
  typeof globalThis !== 'undefined' &&
  Boolean(
    // nativeFabricUIManager is present when the New Architecture is active
    (globalThis as {nativeFabricUIManager?: object}).nativeFabricUIManager,
  );

if (
  Platform.OS === 'android' &&
  !isFabricEnabled &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FAQScreenProps = NativeStackScreenProps<HomeStackParamList, 'FAQ'>;

interface HelpfulState {
  [faqId: string]: 'yes' | 'no' | null;
}

// Small presentational card extracted to reduce nesting inside FAQScreen
const FAQCard: React.FC<{
  faq: FAQEntry;
  isExpanded: boolean;
  relatedEntries: FAQEntry[];
  helpfulSelection: 'yes' | 'no' | null;
  onToggle: (id: string) => void;
  onHelpfulSelect: (id: string, value: 'yes' | 'no') => void;
  onRelatedPress: (id: string, isInFiltered: boolean) => void;
  styles: ReturnType<typeof createStyles>;
  theme: any;
}> = ({faq, isExpanded, relatedEntries, helpfulSelection, onToggle, onHelpfulSelect, onRelatedPress, styles, theme}) => (
  <LiquidGlassCard
    glassEffect="regular"
    interactive
    style={styles.faqCard}
    fallbackStyle={styles.cardFallback}>
    <TouchableOpacity
      style={styles.questionRow}
      onPress={() => onToggle(faq.id)}
      activeOpacity={0.8}>
      <Text style={styles.questionText}>{faq.question}</Text>
      <Text style={styles.toggleSymbol}>{isExpanded ? '−' : '+'}</Text>
    </TouchableOpacity>

    {isExpanded && (
      <View style={styles.answerSection}>
        <Text style={styles.answerText}>{faq.answer}</Text>

        <View style={styles.helpfulSection}>
          <Text style={styles.helpfulPrompt}>Was this answer helpful?</Text>
          <View style={styles.helpfulButtons}>
            <LiquidGlassButton
              title="Yes"
              size="small"
              glassEffect="regular"
              interactive
              borderRadius="xl"
              forceBorder
              tintColor={theme.colors.secondary}
              borderColor={theme.colors.secondary}
              style={[styles.glassButtonDark, helpfulSelection === 'yes' && styles.glassButtonSelected]}
              textStyle={styles.glassButtonDarkText}
              onPress={() => onHelpfulSelect(faq.id, 'yes')}
            />
            <LiquidGlassButton
              title="No"
              size="small"
              glassEffect="regular"
              interactive
              borderRadius="xl"
              forceBorder
              tintColor={theme.colors.background}
              borderColor={theme.colors.secondary}
              style={styles.glassButtonLight}
              textStyle={styles.glassButtonLightText}
              onPress={() => onHelpfulSelect(faq.id, 'no')}
            />
          </View>
        </View>

        {relatedEntries.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Related Questions</Text>
            {relatedEntries.map(related => (
              <TouchableOpacity
                key={related.id}
                style={styles.relatedRow}
                onPress={() => onRelatedPress(related.id, false)}
                activeOpacity={0.7}>
                <Text style={styles.relatedText}>{related.question}</Text>
                <Image source={Images.rightArrow} style={styles.relatedArrow} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    )}
  </LiquidGlassCard>
);

// (removed unused helper; per-component `onRelatedPress` used instead)

export const FAQScreen: React.FC<FAQScreenProps> = ({navigation}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [expandedFaqId, setExpandedFaqId] = React.useState<string | null>(
    FAQ_ENTRIES[0]?.id ?? null,
  );
  const [helpfulState, setHelpfulState] = React.useState<HelpfulState>({});
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const categoryOptions = React.useMemo(
    () => FAQ_CATEGORIES.map(category => ({id: category.id, label: category.label})),
    [],
  );

  const filteredFaqs = React.useMemo(() => {
    let faqs = FAQ_ENTRIES;

    // Filter by category
    if (selectedCategory !== 'all') {
      faqs = faqs.filter(entry =>
        entry.categoryIds.includes(selectedCategory),
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      faqs = faqs.filter(entry => {
        const questionMatch = entry.question.toLowerCase().includes(query);
        const answerMatch = entry.answer.toLowerCase().includes(query);
        return questionMatch || answerMatch;
      });
    }

    return faqs;
  }, [selectedCategory, searchQuery]);

  const relatedLookup = React.useMemo(() => {
    const map = new Map<string, FAQEntry>();
    for (const entry of FAQ_ENTRIES) {
      map.set(entry.id, entry);
    }
    return map;
  }, []);

  const handleToggle = React.useCallback(
    (faqId: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedFaqId(prev => (prev === faqId ? null : faqId));
    },
    [],
  );

  const handleHelpfulSelection = React.useCallback((faqId: string, value: 'yes' | 'no') => {
    setHelpfulState(prev => ({
      ...prev,
      [faqId]: prev[faqId] === value ? null : value,
    }));
  }, []);

  const onRelatedPress = React.useCallback((id: string, isInFiltered: boolean) => {
    // keep behavior same as previous inline handler
    setExpandedFaqId(id);
    if (!isInFiltered) {
      setSelectedCategory('all');
      setSearchQuery('');
    }
  }, []);

  const handleCategoryChange = React.useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    // Optionally clear search when changing categories
    // setSearchQuery('');
  }, []);

  const handleSearchChange = React.useCallback((text: string) => {
    setSearchQuery(text);
    // If user is searching, show all categories
    if (text.trim() && selectedCategory !== 'all') {
      setSelectedCategory('all');
    }
  }, [selectedCategory]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[styles.topSection, {paddingTop: insets.top}]}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive={false}
          style={styles.topGlassCard}
          fallbackStyle={styles.topGlassFallback}>
          <Header
            title="FAQs"
            showBackButton
            onBack={() => navigation.goBack()}
            rightIcon={Images.accountMailIcon}
            onRightPress={() => navigation.navigate('ContactUs')}
            glass={false}
          />
          <SearchBar
            mode="input"
            placeholder="Search FAQs..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            containerStyle={styles.searchContainer}
          />
          <PillSelector
            options={categoryOptions}
            selectedId={selectedCategory}
            onSelect={handleCategoryChange}
            containerStyle={styles.pillContainer}
          />
        </LiquidGlassCard>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          topGlassHeight
            ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['3']}
            : null,
        ]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.faqList}>
          {filteredFaqs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {searchQuery.trim()
                  ? `No FAQs found for "${searchQuery}"`
                  : 'No FAQs available in this category'}
              </Text>
              {Boolean(searchQuery.trim()) && (
                <Text style={styles.emptyStateSubtext}>
                  Try searching with different keywords or browse by category
                </Text>
              )}
            </View>
          ) : (
            filteredFaqs.map(faq => {
              const isExpanded = expandedFaqId === faq.id;
              const relatedEntries: FAQEntry[] = (faq.relatedIds ?? [])
                .map(id => relatedLookup.get(id))
                .filter(Boolean) as FAQEntry[];
              const helpfulSelection = helpfulState[faq.id] ?? null;

              return (
                <FAQCard
                  key={faq.id}
                  faq={faq}
                  isExpanded={isExpanded}
                  relatedEntries={relatedEntries}
                  helpfulSelection={helpfulSelection}
                  onToggle={handleToggle}
                  onHelpfulSelect={handleHelpfulSelection}
                  onRelatedPress={onRelatedPress}
                  styles={styles}
                  theme={theme}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['8'],
      gap: theme.spacing['4'],
    },
    topSection: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
    },
    topGlassCard: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: theme.spacing['3'],
      gap: theme.spacing['3'],
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    topGlassFallback: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      borderWidth: 0,
      borderColor: 'transparent',
    },
    searchContainer: {
      marginHorizontal: theme.spacing['6'],
    },
    pillContainer: {
      paddingHorizontal: theme.spacing['6'],
    },
    faqList: {
      gap: theme.spacing['4'],
    },
    emptyState: {
      paddingVertical: theme.spacing['8'],
      paddingHorizontal: theme.spacing['6'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyStateText: {
      ...theme.typography.paragraphBold,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['2'],
    },
    emptyStateSubtext: {
      ...theme.typography.bodySmall,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      opacity: 0.7,
    },
    faqCard: {
      gap: theme.spacing['3'],
      padding: theme.spacing['4'],
    },
    cardFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.none,
    },
    questionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
    },
    questionText: {
      flex: 1,
      ...theme.typography.paragraphBold,
      color: theme.colors.text,
    },
    toggleSymbol: {
      fontFamily: theme.typography.paragraphBold.fontFamily,
      fontWeight: theme.typography.paragraphBold.fontWeight,
      fontSize: theme.typography.titleLarge.fontSize,
      lineHeight: theme.typography.titleLarge.lineHeight,
      color: theme.colors.text,
    },
    answerSection: {
      gap: theme.spacing['3'],
    },
    answerText: {
      ...theme.typography.bodySmall,
      lineHeight: 21,
      color: theme.colors.placeholder,
    },
    helpfulSection: {
      gap: theme.spacing['2'],
    },
    helpfulPrompt: {
      ...theme.typography.subtitleBold14,
      lineHeight: 16.8,
      color: theme.colors.placeholder,
    },
    helpfulButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['3'],
    },
    relatedSection: {
      gap: theme.spacing['2'],
    },
    relatedTitle: {
      ...theme.typography.subtitleBold14,
      lineHeight: 16.8,
      color: theme.colors.placeholder,
    },
    relatedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      paddingVertical: theme.spacing['2'],
    },
    relatedText: {
      flex: 1,
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    relatedArrow: {
      width: theme.spacing['4'],
      height: theme.spacing['4'],
      marginLeft: theme.spacing['2'],
      resizeMode: 'contain',
    },
    glassButtonDark: {
      minWidth: 100,
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['5'],
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.secondary,
    },
    glassButtonSelected: {
      borderColor: theme.colors.secondary,
    },
    glassButtonDarkText: {
      ...theme.typography.titleSmall,
      color: theme.colors.white,
      textAlign: 'center',
    },
    glassButtonLight: {
      minWidth: 100,
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['5'],
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.secondary,
    },
    glassButtonLightText: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
  });

export default FAQScreen;
