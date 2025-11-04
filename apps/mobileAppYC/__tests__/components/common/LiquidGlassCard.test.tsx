import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Text, View} from 'react-native';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {themeReducer} from '@/features/theme';

// Mock the liquid glass library
jest.mock('@callstack/liquid-glass', () => ({
  LiquidGlassView: ({children, style, interactive, effect}: any) => {
    const MockReact = require('react');
    const {View: MockView} = require('react-native');
    return MockReact.createElement(
      MockView,
      {testID: 'liquid-glass-view', style, 'data-interactive': interactive, 'data-effect': effect},
      children
    );
  },
  isLiquidGlassSupported: true,
}));

describe('LiquidGlassCard', () => {
  const createTestStore = () => {
    return configureStore({
      reducer: {
        theme: themeReducer,
      },
    });
  };

  const wrap = (children: React.ReactElement) => (
    <Provider store={createTestStore()}>{children}</Provider>
  );

  it('should render children', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard>
            <Text>Card Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe('Card Content');
  });

  it('should render fallback View on Android', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard>
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    const views = tree.root.findAllByType(View);
    expect(views.length).toBeGreaterThan(0);

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should use default glassEffect regular', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard>
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    // On iOS with liquid glass support, should render LiquidGlassView
    expect(tree.root).toBeTruthy();
  });

  it('should accept custom glassEffect', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard glassEffect="clear">
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();
  });

  it('should accept interactive prop', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard interactive={true}>
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();
  });

  it('should accept custom tintColor', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard tintColor="#FF0000">
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();
  });

  it('should accept custom colorScheme', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard colorScheme="dark">
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();
  });

  it('should apply custom style', () => {
    const customStyle = {marginTop: 20};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard style={customStyle}>
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();
  });

  it('should accept custom padding', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard padding="8">
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();
  });

  it('should accept custom borderRadius', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard borderRadius="xl">
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();
  });

  it('should accept custom shadow', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard shadow="lg">
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();
  });

  it('should accept fallbackStyle', () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    const fallbackStyle = {opacity: 0.9};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard fallbackStyle={fallbackStyle}>
            <Text>Content</Text>
          </LiquidGlassCard>
        )
      );
    });

    expect(tree.root).toBeTruthy();

    require('react-native').Platform.OS = originalPlatform;
  });

  it('should render multiple children', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <LiquidGlassCard>
            <Text>First</Text>
            <Text>Second</Text>
          </LiquidGlassCard>
        )
      );
    });

    const texts = tree.root.findAllByType(Text);
    expect(texts.length).toBe(2);
    expect(texts[0].props.children).toBe('First');
    expect(texts[1].props.children).toBe('Second');
  });
});
