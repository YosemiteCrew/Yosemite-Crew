import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {store} from '@/app/store';
import {useTheme} from '@/shared/hooks/useTheme';

const Probe: React.FC<{onRead: (v: ReturnType<typeof useTheme>) => void}> = ({onRead}) => {
  const theme = useTheme();
  React.useEffect(() => { onRead(theme); }, [onRead, theme]);
  return null;
};

describe('useTheme', () => {
  it('returns light theme with dark mode locked off', () => {
    const spy = jest.fn();
    TestRenderer.act(() => {
      TestRenderer.create(
        <Provider store={store}>
          <Probe onRead={spy} />
        </Provider>
      );
    });
    expect(spy).toHaveBeenCalled();
    const value = spy.mock.calls[0][0];
    expect(value.isDark).toBe(false);
    expect(value.themeMode).toBe('light');
    expect(value.darkModeLocked).toBe(true);
  });
});

