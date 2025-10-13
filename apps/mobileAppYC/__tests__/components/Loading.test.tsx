import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Loading} from '@/components/common/Loading/Loading';
import {themeReducer} from '@/features/theme';
import { ActivityIndicator, Text } from 'react-native';

describe('Loading', () => {
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

  it('should render with default text', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading />));
    });
    expect(tree.root.findByType(Text).props.children).toBe('Loading...');
  });

  it('should render with custom text', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading text="Please wait" />));
    });
    expect(tree.root.findByType(Text).props.children).toBe('Please wait');
  });

  it('should not render text when text prop is empty', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading text="" />));
    });
    const texts = tree.root.findAllByType(Text);
    expect(texts.length).toBe(0);
  });

  it('should render ActivityIndicator', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading />));
    });
    expect(tree.root.findByType(ActivityIndicator)).toBeTruthy();
  });

  it('should render with small size', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading size="small" />));
    });
    const indicator = tree.root.findByType(ActivityIndicator);
    expect(indicator.props.size).toBe('small');
  });

  it('should render with large size', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading size="large" />));
    });
    const indicator = tree.root.findByType(ActivityIndicator);
    expect(indicator.props.size).toBe('large');
  });

  it('should use custom color', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading color="#FF0000" />));
    });
    const indicator = tree.root.findByType(ActivityIndicator);
    expect(indicator.props.color).toBe('#FF0000');
  });

  it('should use theme color when no custom color provided', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading />));
    });
    const indicator = tree.root.findByType(ActivityIndicator);
    expect(indicator.props.color).toBeDefined();
  });
});
