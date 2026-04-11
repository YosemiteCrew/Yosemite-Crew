import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Loading} from '@/shared/components/common/Loading/Loading';
import {themeReducer} from '@/features/theme';

// Fix: Require View inside the mock to avoid ReferenceError
jest.mock('@/shared/components/common/GifLoader/GifLoader', () => {
  const {View} = require('react-native');
  return {
    GifLoader: ({size}: {size: string}) => (
      <View testID="gif-loader" data-size={size} />
    ),
  };
});

// Mock hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

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

  it('should render GifLoader', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading />));
    });
    const loader = tree.root.findByProps({testID: 'gif-loader'});
    expect(loader).toBeTruthy();
  });

  it('should pass default size "medium" to GifLoader', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading />));
    });
    const loader = tree.root.findByProps({testID: 'gif-loader'});
    expect(loader.props['data-size']).toBe('medium');
  });

  it('should pass small size to GifLoader', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading size="small" />));
    });
    const loader = tree.root.findByProps({testID: 'gif-loader'});
    expect(loader.props['data-size']).toBe('small');
  });

  it('should pass large size to GifLoader', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Loading size="large" />));
    });
    const loader = tree.root.findByProps({testID: 'gif-loader'});
    expect(loader.props['data-size']).toBe('large');
  });
});
