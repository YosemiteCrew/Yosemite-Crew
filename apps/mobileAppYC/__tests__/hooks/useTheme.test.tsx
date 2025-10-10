import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {useTheme} from '@/hooks/useTheme';
import themeReducer from '@/store/slices/themeSlice';
import {lightTheme} from '@/theme/themes';

describe('useTheme', () => {
  const createTestStore = (isDark: boolean = false) => {
    return configureStore({
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
  };

  const Probe: React.FC<{onValue: (v: any) => void}> = ({ onValue }) => {
    const v = useTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => { onValue(v); }, [v]);
    return null;
  };

  it('should return light theme when isDark is false', () => {
    const store = createTestStore(false);
    let captured: any;
    TestRenderer.act(() => {
      TestRenderer.create(<Provider store={store}><Probe onValue={v => { captured = v; }} /></Provider>);
    });
    expect(captured.theme).toEqual(lightTheme);
    expect(captured.isDark).toBe(false);
  });

  it('should reflect isDark=true while theme currently remains lightTheme', () => {
    const store = createTestStore(true);
    let captured: any;
    TestRenderer.act(() => {
      TestRenderer.create(<Provider store={store}><Probe onValue={v => { captured = v; }} /></Provider>);
    });
    expect(captured.theme).toEqual(lightTheme);
    expect(captured.isDark).toBe(true);
  });

  it('should have colors property in theme', () => {
    const store = createTestStore();
    let captured: any;
    TestRenderer.act(() => {
      TestRenderer.create(<Provider store={store}><Probe onValue={v => { captured = v; }} /></Provider>);
    });
    expect(captured.theme.colors).toBeDefined();
    expect(captured.theme.colors.primary).toBeDefined();
    expect(captured.theme.colors.background).toBeDefined();
  });

  it('should have typography property in theme', () => {
    const store = createTestStore();
    let captured: any;
    TestRenderer.act(() => {
      TestRenderer.create(<Provider store={store}><Probe onValue={v => { captured = v; }} /></Provider>);
    });
    expect(captured.theme.typography).toBeDefined();
    expect(captured.theme.typography.h1).toBeDefined();
  });

  it('should have spacing property in theme', () => {
    const store = createTestStore();
    let captured: any;
    TestRenderer.act(() => {
      TestRenderer.create(<Provider store={store}><Probe onValue={v => { captured = v; }} /></Provider>);
    });
    expect(captured.theme.spacing).toBeDefined();
    expect(captured.theme.spacing['1']).toBeDefined();
  });

  it('should have borderRadius property in theme', () => {
    const store = createTestStore();
    let captured: any;
    TestRenderer.act(() => {
      TestRenderer.create(<Provider store={store}><Probe onValue={v => { captured = v; }} /></Provider>);
    });
    expect(captured.theme.borderRadius).toBeDefined();
    expect(captured.theme.borderRadius.base).toBeDefined();
  });
});
