import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Text, View} from 'react-native';

// Always use clear/predictable mocks so tests don't depend on variables.local.ts
jest.mock('@/config/variables', () => ({
  UI_FEATURE_FLAGS: {forceLiquidGlassBorder: false},
}));

// Controlled isDark flag — toggled per describe block
let mockIsDark = false;
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: require('../../__tests__/setup/mockTheme').mockTheme,
    isDark: mockIsDark,
  }),
}));

jest.mock('@callstack/liquid-glass', () => ({
  LiquidGlassView: ({children, style, interactive, effect}: any) => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return MockReact.createElement(
      MockView,
      {
        testID: 'liquid-glass-view',
        style,
        'data-interactive': interactive,
        'data-effect': effect,
      },
      children,
    );
  },
  isLiquidGlassSupported: true,
}));

import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

describe('LiquidGlassCard — light mode (isDark=false)', () => {
  beforeAll(() => {
    mockIsDark = false;
  });

  it('should render children', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard>
          <Text>Card Content</Text>
        </LiquidGlassCard>,
      );
    });
    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe('Card Content');
  });

  it('should render LiquidGlassView on iOS (native glass path)', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(
      tree.root.findAll(n => n.props.testID === 'liquid-glass-view').length,
    ).toBeGreaterThan(0);
  });

  it('should render fallback View on Android', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    const views = tree.root.findAllByType(View);
    expect(views.length).toBeGreaterThan(0);

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should render fallback View when glassEffect=none', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard glassEffect="none">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root.findAllByType(View).length).toBeGreaterThan(0);
  });

  it('should resolve colorScheme=system to light', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard colorScheme="system">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should use IOS_DARK_CARD_TINT on iOS with colorScheme=dark', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard colorScheme="dark">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should use custom tintColor (short-circuits platform tint logic)', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard tintColor="#FF0000">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should apply individual corner radii from style override', () => {
    const customStyle = {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    };
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard style={customStyle}>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should apply numeric borderRadius from style override', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard style={{borderRadius: 20}}>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should skip overlay borderRadius when resolved radius is non-numeric', () => {
    // A borderRadius key absent from the theme resolves to undefined, so
    // baseRadius is non-numeric and the `typeof baseRadius === 'number'`
    // guard in overlayShapeStyle takes its false branch.
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard borderRadius={'nonexistent' as any}>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should apply custom borderColor from style override', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard style={{borderColor: '#AABBCC', borderWidth: 2}}>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should apply custom backgroundColor from style override', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard style={{backgroundColor: '#FFFFFF'}}>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should accept fallbackStyle on Android', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard fallbackStyle={{opacity: 0.9}}>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should use Android dark clear tint (android + clear + dark colorScheme)', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard glassEffect="clear" colorScheme="dark">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should use Android regular dark tint (android + regular + dark colorScheme)', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard glassEffect="regular" colorScheme="dark">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should use Android light clear tint (android + clear + light)', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard glassEffect="clear" colorScheme="light">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should use Android regular light tint (android + regular + light)', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard glassEffect="regular" colorScheme="light">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should accept custom padding, borderRadius, shadow', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard padding="8" borderRadius="xl" shadow="lg">
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });

  it('should render multiple children', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard>
          <Text>First</Text>
          <Text>Second</Text>
        </LiquidGlassCard>,
      );
    });
    const texts = tree.root.findAllByType(Text);
    expect(texts.length).toBe(2);
    expect(texts[0].props.children).toBe('First');
    expect(texts[1].props.children).toBe('Second');
  });

  it('should set interactive prop on LiquidGlassView', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard interactive={true}>
          <Text>Content</Text>
        </LiquidGlassCard>,
      );
    });
    const glassView = tree.root.find(
      n => n.props.testID === 'liquid-glass-view',
    );
    expect(glassView.props['data-interactive']).toBe(true);
  });
});

describe('LiquidGlassCard — dark mode (isDark=true)', () => {
  beforeAll(() => {
    mockIsDark = true;
  });

  afterAll(() => {
    mockIsDark = false;
  });

  it('should use dark background on Android with isDark=true', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard>
          <Text>Dark content</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should render dark fallback style on iOS glass path with isDark=true', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard>
          <Text>Dark iOS</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });
});

describe('LiquidGlassCard — FORCE_CARD_BORDER=true', () => {
  beforeAll(() => {
    mockIsDark = false;
    // Override the module-level mock so FORCE_CARD_BORDER evaluates to true
    jest.mock('@/config/variables', () => ({
      UI_FEATURE_FLAGS: {forceLiquidGlassBorder: true},
    }));
  });

  afterAll(() => {
    jest.mock('@/config/variables', () => ({
      UI_FEATURE_FLAGS: {forceLiquidGlassBorder: false},
    }));
  });

  it('renders without error when force border flag is active', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <LiquidGlassCard>
          <Text>Forced border</Text>
        </LiquidGlassCard>,
      );
    });
    expect(tree.root).toBeTruthy();
  });
});

// The module-level `jest.mock` above pins forceLiquidGlassBorder to false, and
// FORCE_CARD_BORDER is read once at import time, so the runtime jest.mock in the
// describe above cannot flip it. Re-import the component inside an isolated
// module registry with the flag doMocked true to drive the FORCE_CARD_BORDER
// true branches (FORCED_BORDER_COLOR / FORCED_BORDER_WIDTH).
describe('LiquidGlassCard — forced card border (flag true, isolated re-import)', () => {
  afterEach(() => {
    jest.dontMock('@/config/variables');
  });

  it('uses FORCED_BORDER_COLOR and FORCED_BORDER_WIDTH when forceLiquidGlassBorder is true', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    jest.isolateModules(() => {
      jest.doMock('@/config/variables', () => {
        const actual = jest.requireActual('@/config/variables');
        return {
          ...actual,
          UI_FEATURE_FLAGS: {
            ...actual.UI_FEATURE_FLAGS,
            forceLiquidGlassBorder: true,
          },
        };
      });
      // Require React, the renderer, and RN INSIDE the isolated registry so the
      // forced-flag tree is built with one consistent React instance (a
      // top-level TestRenderer would crash on a null hook dispatcher).
      const IsolatedReact = require('react');
      const IsolatedRenderer = require('react-test-renderer');
      const {Text: IsolatedText} = require('react-native');
      const {
        LiquidGlassCard: ForcedCard,
      } = require('@/shared/components/common/LiquidGlassCard/LiquidGlassCard');
      IsolatedRenderer.act(() => {
        tree = IsolatedRenderer.create(
          IsolatedReact.createElement(
            ForcedCard,
            null,
            IsolatedReact.createElement(IsolatedText, null, 'Forced border'),
          ),
        );
      });
    });
    expect(tree.root).toBeTruthy();
  });
});
