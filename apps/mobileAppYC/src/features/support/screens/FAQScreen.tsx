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
import {SafeAreaView} from 'react-native-safe-area-context';
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
      <Header
        title="FAQs"
        showBackButton
        onBack={() => navigation.goBack()}
        rightIcon={Images.accountMailIcon}
        onRightPress={() => navigation.navigate('ContactUs')}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
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
      paddingTop: theme.spacing['3'],
      gap: theme.spacing['4'],
    },
    searchContainer: {
      marginBottom: theme.spacing['4'],
    },
    pillContainer: {
      marginBottom: theme.spacing['3'],
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
      fontFamily: theme.typography.paragraphBold.fontFamily,
      fontSize: 16,
      fontWeight: theme.typography.paragraphBold.fontWeight,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['2'],
    },
    emptyStateSubtext: {
      fontFamily: theme.typography.paragraph.fontFamily,
      fontSize: 14,
      fontWeight: theme.typography.paragraph.fontWeight,
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
  borderRadius: 16,
  backgroundColor: '#FFFEFE',
  borderWidth: 1,
  borderColor: '#EAEAEA',
  // No shadows
  shadowColor: 'transparent',
  elevation: 0,
    },
    questionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['3'],
    },
    questionText: {
      flex: 1,
  // Paragraph Bold
  fontFamily: 'Satoshi',
  fontSize: 16,
  fontStyle: 'normal',
  fontWeight: '700',
  lineHeight: 19.2,
  letterSpacing: -0.32,
  color: '#302F2E',
    },
    toggleSymbol: {
      fontFamily: theme.typography.paragraphBold.fontFamily,
      fontWeight: theme.typography.paragraphBold.fontWeight,
      fontSize: 24,
      lineHeight: 24,
      color: '#302F2E',
    },
    answerSection: {
      gap: theme.spacing['3'],
    },
    answerText: {
  // Answer body
  fontFamily: 'Satoshi',
  fontSize: 14,
  fontStyle: 'normal',
  fontWeight: '400',
  lineHeight: 21,
  color: '#595958',
    },
    helpfulSection: {
      gap: theme.spacing['2'],
    },
    helpfulPrompt: {
  // Subtitle Bold
  fontFamily: 'Satoshi',
  fontSize: 14,
  fontStyle: 'normal',
  fontWeight: '700',
  lineHeight: 16.8,
  color: '#595958',
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
  // Subtitle Bold
  fontFamily: 'Satoshi',
  fontSize: 14,
  fontStyle: 'normal',
  fontWeight: '700',
  lineHeight: 16.8,
  color: '#595958',
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
      width: 16,
      height: 16,
      marginLeft: theme.spacing['2'],
      resizeMode: 'contain',
    },
    glassButtonDark: {
  minWidth: 100,
  paddingVertical: 14,
  paddingHorizontal: 20,
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'row',
  // gap is not fully supported on all RN versions; children spacing handled via styles
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#302F2E',
    },
    glassButtonSelected: {
      borderColor: theme.colors.secondary,
    },
    glassButtonDarkText: {
      fontFamily: theme.typography.businessTitle16.fontFamily,
      fontSize: 16,
      fontWeight: theme.typography.businessTitle16.fontWeight,
      letterSpacing: -0.16,
      lineHeight: 16,
      color: theme.colors.white,
      textAlign: 'center',
    },
    glassButtonLight: {
  minWidth: 100,
  paddingVertical: 14,
  paddingHorizontal: 20,
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'row',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#302F2E',
    },
    glassButtonLightText: {
      fontFamily: theme.typography.businessTitle16.fontFamily,
      fontSize: 16,
      fontWeight: theme.typography.businessTitle16.fontWeight,
      letterSpacing: -0.16,
      lineHeight: 16,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
  });

export default FAQScreen;
