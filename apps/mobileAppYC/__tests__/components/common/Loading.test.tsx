import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Loading} from '@/shared/components/common/Loading/Loading';
import {themeReducer} from '@/features/theme';
import {View} from 'react-native';
import {GifLoader} from '@/shared/components/common/GifLoader/GifLoader';

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

  it('should render GifLoader component', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading />));
    });
    expect(tree.root.findByType(GifLoader)).toBeTruthy();
  });

  it('should render with container View', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading />));
    });
    const views = tree.root.findAllByType(View);
    expect(views.length).toBeGreaterThan(0);
  });

  it('should render with default medium size', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading />));
    });
    const gifLoader = tree.root.findByType(GifLoader);
    expect(gifLoader.props.size).toBe('medium');
  });

  it('should render with small size', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading size="small" />));
    });
    const gifLoader = tree.root.findByType(GifLoader);
    expect(gifLoader.props.size).toBe('small');
  });

  it('should render with large size', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading size="large" />));
    });
    const gifLoader = tree.root.findByType(GifLoader);
    expect(gifLoader.props.size).toBe('large');
  });
});
