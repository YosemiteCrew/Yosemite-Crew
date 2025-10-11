import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

import {useTheme} from '@/hooks/useTheme';
import {themeReducer} from '@/features/theme';
import {lightTheme} from '@/theme/themes';

describe('useTheme', () => {
  const createTestStore = (isDark: boolean = false) =>
    configureStore({
      reducer: {
        theme: themeReducer,
      },
      preloadedState: {
        theme: {
          isDark,
          theme: (isDark ? 'dark' : 'light') as 'light' | 'dark' | 'system',
        },
      },
    });

  const Probe: React.FC<{onValue: (v: ReturnType<typeof useTheme>) => void}> = ({
    onValue,
  }) => {
    const value = useTheme();

    React.useEffect(() => {
      onValue(value);
    }, [onValue, value]);

    return null;
  };

  it('returns light theme when store is already light', () => {
    const store = createTestStore(false);
    let captured: ReturnType<typeof useTheme> | undefined;

    TestRenderer.act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Probe onValue={value => { captured = value; }} />
        </Provider>,
      );
    });

    expect(captured?.theme).toEqual(lightTheme);
    expect(captured?.isDark).toBe(false);
    expect(captured?.themeMode).toBe('light');
    expect(captured?.darkModeLocked).toBe(true);
  });

  it('forces light theme even when store is dark', () => {
    const store = createTestStore(true);
    let captured: ReturnType<typeof useTheme> | undefined;

    TestRenderer.act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Probe onValue={value => { captured = value; }} />
        </Provider>,
      );
    });

    expect(captured?.theme).toEqual(lightTheme);
    expect(captured?.isDark).toBe(false);
    expect(captured?.themeMode).toBe('light');
    expect(captured?.darkModeLocked).toBe(true);
  });

  it('exposes expected shape for theme tokens', () => {
    const store = createTestStore();
    let captured: ReturnType<typeof useTheme> | undefined;

    TestRenderer.act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Probe onValue={value => { captured = value; }} />
        </Provider>,
      );
    });

    expect(captured?.theme.colors.primary).toBeDefined();
    expect(captured?.theme.typography.h1).toBeDefined();
    expect(captured?.theme.spacing['1']).toBeDefined();
    expect(captured?.theme.borderRadius.base).toBeDefined();
    expect(captured?.darkModeLocked).toBe(true);
  });
});
