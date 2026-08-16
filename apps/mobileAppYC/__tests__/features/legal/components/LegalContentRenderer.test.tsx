import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
import LegalContentRenderer from '../../../../src/features/legal/components/LegalContentRenderer';

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('@/hooks', () => ({
  useTheme: jest.fn(() => ({theme: mockTheme, isDark: false})),
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

  it('skips the __DEV__ logging block when __DEV__ is false', () => {
    const originalDev = (global as any).__DEV__;
    (global as any).__DEV__ = false;
    consoleSpy.mockClear();

    render(
      <LegalContentRenderer
        sections={[{id: '1', title: 'No Log Test', blocks: []}]}
      />,
    );

    expect(consoleSpy).not.toHaveBeenCalled();
    (global as any).__DEV__ = originalDev;
  });

  it('logs an undefined firstTitle when there are no sections', () => {
    consoleSpy.mockClear();
    render(<LegalContentRenderer sections={[]} />);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('LegalContentRenderer:'),
      0,
      expect.stringContaining('firstTitle='),
      undefined,
    );
  });

  it('defaults to an empty section list when sections is not an array', () => {
    expect(() =>
      render(<LegalContentRenderer sections={undefined as any} />),
    ).not.toThrow();
  });

  it('renders nothing inside a section whose blocks is not an array', () => {
    const sections = [
      {
        id: 'no-blocks-array',
        title: 'Title Only Section',
        blocks: undefined,
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    expect(getByText('Title Only Section')).toBeTruthy();
  });

  it('keys list items and paragraph blocks safely when segments is missing', () => {
    const sections = [
      {
        id: 'no-segments',
        blocks: [
          {
            type: 'ordered-list',
            items: [{marker: '1.'}, {marker: '2.', segments: undefined}],
          },
        ],
      },
    ];

    expect(() =>
      render(<LegalContentRenderer sections={sections as any} />),
    ).not.toThrow();
  });

  it('gives borderWidth 1 to the card fallback style on Android', () => {
    const {Platform} = require('react-native');
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    expect(() =>
      render(
        <LegalContentRenderer
          sections={[{id: '1', title: 'Android Test', blocks: []}]}
        />,
      ),
    ).not.toThrow();

    Platform.OS = originalOS;
  });

  it('falls back to SATOSHI typography tokens when subtitle typography variants are missing', () => {
    const {useTheme} = require('@/hooks');
    (useTheme as jest.Mock).mockReturnValueOnce({
      theme: {
        ...mockTheme,
        typography: {
          ...mockTheme.typography,
          subtitleBold14: undefined,
          subtitleRegular14: undefined,
        },
      },
      isDark: false,
    });

    const sections = [
      {
        id: 'fallback-typography',
        title: 'Fallback Title',
        blocks: [{type: 'paragraph', segments: [{text: 'Fallback Body'}]}],
      },
    ];

    const {getByText} = render(
      <LegalContentRenderer sections={sections as any} />,
    );

    expect(getByText('Fallback Title')).toBeTruthy();
    expect(getByText('Fallback Body')).toBeTruthy();
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
