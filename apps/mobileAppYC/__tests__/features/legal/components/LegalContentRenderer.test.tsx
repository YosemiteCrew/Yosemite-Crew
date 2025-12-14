import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
import LegalContentRenderer from '../../../../src/features/legal/components/LegalContentRenderer';

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#000',
        cardBackground: '#fff',
        borderMuted: '#ccc',
      },
      spacing: {
        '1': 4,
        '2': 8,
        '3': 12,
        '4': 16,
      },
      typography: {
        subtitleBold14: {fontFamily: 'Bold', fontWeight: '700'},
        subtitleRegular14: {fontFamily: 'Regular', fontWeight: '400'},
        paragraphBold: {fontFamily: 'Bold', fontWeight: '700'},
        labelSmall: {fontSize: 10},
        SATOSHI_BOLD: 'Satoshi-Bold',
        SATOSHI_REGULAR: 'Satoshi-Regular',
      },
      borderRadius: {
        lg: 8,
      },
    },
  }),
}));

// 2. Mock LiquidGlassCard
// Fix: Use standard View with testID instead of non-existent JSX element <mock-liquid-glass-card>
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View} = require('react-native');
  return {
    LiquidGlassCard: ({children, style}: any) => (
      <View testID="mock-liquid-glass-card" style={style}>
        {children}
      </View>
    ),
  };
});

// 3. Force StyleSheet.create to return styles as-is for easy assertion
jest.spyOn(StyleSheet, 'create').mockImplementation(styles => styles);

describe('LegalContentRenderer', () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  afterAll(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('filters out completely empty sections', () => {
    const sections = [
      {
        id: '1',
        title: '   ',
        blocks: [],
      },
      {
        id: '2',
        title: 'Valid Section',
        blocks: [],
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    expect(getByText('Valid Section')).toBeTruthy();
  });

  it('filters out blocks that have no content', () => {
    const sections = [
      {
        id: '1',
        blocks: [
          {type: 'paragraph', segments: []},
          {type: 'paragraph', segments: [{text: '   '}]},
          {type: 'ordered-list', items: []},
          {type: 'paragraph', segments: [{text: 'Valid Content'}]},
        ],
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    expect(getByText('Valid Content')).toBeTruthy();
  });

  // --- 2. Content Rendering: Paragraphs ---

  it('renders paragraph text with styling (bold, underline)', () => {
    const sections = [
      {
        id: 'p1',
        title: 'Styling Test',
        blocks: [
          {
            type: 'paragraph',
            segments: [
              {text: 'Bold', bold: true},
              {text: 'Underline', underline: true},
            ],
          },
        ],
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    const boldText = getByText('Bold');
    const underlineText = getByText('Underline');

    expect(boldText.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({fontWeight: '700'})]),
    );
    expect(underlineText.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({textDecorationLine: 'underline'}),
      ]),
    );
  });

  // --- 3. Content Rendering: Ordered Lists ---

  it('renders ordered list items', () => {
    const sections = [
      {
        id: 'list1',
        blocks: [
          {
            type: 'ordered-list',
            items: [
              {marker: '1.', segments: [{text: 'Item 1'}]},
              {marker: '2.', markerBold: true, segments: [{text: 'Item 2'}]},
            ],
          },
        ],
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    expect(getByText('1.')).toBeTruthy();
    expect(getByText('Item 1')).toBeTruthy();

    const marker2 = getByText('2.');
    expect(marker2.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({fontWeight: '700'})]),
    );
    expect(getByText('Item 2')).toBeTruthy();
  });

  // --- 4. Alignment & Layout ---

  it('applies center alignment styles when configured', () => {
    const sections = [
      {
        id: 'center1',
        align: 'center',
        title: 'Centered Title',
        blocks: [
          {
            type: 'paragraph',
            segments: [{text: 'Centered Text'}],
          },
        ],
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    const title = getByText('Centered Title');

    expect(title.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({textAlign: 'center'})]),
    );
  });

  // --- 5. Edge Cases & Safety Checks ---

  it('handles unknown block types gracefully', () => {
    const sections = [
      {
        id: 'unknown1',
        blocks: [
          {type: 'video', url: 'http://...'},
          {type: 'paragraph', segments: [{text: 'Visible'}]},
        ],
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    expect(getByText('Visible')).toBeTruthy();
  });

  it('handles undefined segments or items in helper functions safely', () => {
    const sections = [
      {
        id: 'malformed',
        title: 'Malformed Block',
        blocks: [
          {type: 'paragraph'}, // Missing segments
          {type: 'ordered-list'}, // Missing items
        ],
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    expect(getByText('Malformed Block')).toBeTruthy();
  });

  it('executes the __DEV__ logging block', () => {
    render(
      <LegalContentRenderer
        sections={[{id: '1', title: 'Log Test', blocks: []}]}
      />,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('LegalContentRenderer:'),
      1,
      expect.stringContaining('firstTitle='),
      'Log Test',
    );
  });
});
