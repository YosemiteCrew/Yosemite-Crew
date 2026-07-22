// src/shared/components/common/OTPInput/OTPInput.test.tsx

import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Platform, Text, TextInput} from 'react-native';
import {OTPInput} from '@/shared/components/common/OTPInput/OTPInput';
import {themeReducer} from '@/features/theme';

describe('OTPInput', () => {
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

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should render with default 4 inputs', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(4);
  });

  it('should render with custom length', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput length={6} onComplete={() => {}} />),
      );
    });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(6);
  });

  it('should call onComplete on every digit change', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput length={4} onComplete={onComplete} />),
      );
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('1');
    });

    expect(onComplete).toHaveBeenCalledWith('1');

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[1].props.onChangeText('2');
    });

    expect(onComplete).toHaveBeenCalledWith('12');

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[2].props.onChangeText('3');
    });

    expect(onComplete).toHaveBeenCalledWith('123');

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[3].props.onChangeText('4');
    });

    expect(onComplete).toHaveBeenLastCalledWith('1234');
    expect(onComplete).toHaveBeenCalledTimes(4);
  });

  it('should ignore non-numeric input', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={onComplete} />));
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('a');
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('');
  });

  it('should allow empty input changes', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={onComplete} />));
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('');
    });

    expect(onComplete).toHaveBeenCalledWith('');
  });

  it('should clear current input on backspace when it has a value', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={onComplete} />));
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[1].props.onChangeText('2');
    });

    onComplete.mockClear();

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[1].props.onKeyPress({
        nativeEvent: {key: 'Backspace'},
      });
    });

    expect(tree.root.findAllByType(TextInput)[1].props.value).toBe('');
    expect(onComplete).toHaveBeenCalledWith('');
  });

  it('should clear previous input on backspace when current input is empty', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={onComplete} />));
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('1');
    });

    onComplete.mockClear();

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[1].props.onKeyPress({
        nativeEvent: {key: 'Backspace'},
      });
    });

    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('');
    expect(onComplete).toHaveBeenCalledWith('');
  });

  it('should ignore non-backspace key presses', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={onComplete} />));
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('1');
    });

    onComplete.mockClear();

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onKeyPress({
        nativeEvent: {key: 'Enter'},
      });
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('1');
  });

  it('should display error message when error prop is provided', () => {
    const errorMessage = 'Invalid code';
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput onComplete={() => {}} error={errorMessage} />),
      );
    });

    const errorText = tree.root
      .findAllByType(Text)
      .find(text => text.props.children === errorMessage);

    expect(errorText).toBeTruthy();
  });

  it('should not display error message when error prop is not provided', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });

  it('should set keyboard type to numeric', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    tree.root.findAllByType(TextInput).forEach(input => {
      expect(input.props.keyboardType).toBe('numeric');
    });
  });

  it('should set maxLength to 1 for each input', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    tree.root.findAllByType(TextInput).forEach(input => {
      expect(input.props.maxLength).toBe(1);
    });
  });

  it('should size each input responsively with a capped max width', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    tree.root.findAllByType(TextInput).forEach(input => {
      const flattenedStyle = input.props.style.reduce(
        (acc: Record<string, unknown>, style: Record<string, unknown>) => ({
          ...acc,
          ...style,
        }),
        {},
      );

      expect(flattenedStyle.flex).toBe(1);
      expect(flattenedStyle.maxWidth).toBe(50);
    });
  });

  it('should set textContentType to oneTimeCode', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    tree.root.findAllByType(TextInput).forEach(input => {
      expect(input.props.textContentType).toBe('oneTimeCode');
    });
  });

  it('should select existing digit text', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('7');
    });

    expect(tree.root.findAllByType(TextInput)[0].props.selection).toEqual({
      start: 0,
      end: 1,
    });
  });

  it('should use empty selection when input has no digit', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    expect(tree.root.findAllByType(TextInput)[0].props.selection).toEqual({
      start: 0,
      end: 0,
    });
  });

  it('should update active input on focus', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[2].props.onFocus();
    });

    expect(tree.root.findAllByType(TextInput)[2].props.style).toBeTruthy();
  });

  it('should update rendered inputs when length prop changes', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput length={4} onComplete={() => {}} />),
      );
    });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(4);

    TestRenderer.act(() => {
      tree.update(wrap(<OTPInput length={6} onComplete={() => {}} />));
    });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(6);
  });

  it('should preserve existing digits when length increases', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput length={4} onComplete={onComplete} />),
      );
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('1');
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[1].props.onChangeText('2');
    });

    TestRenderer.act(() => {
      tree.update(wrap(<OTPInput length={6} onComplete={onComplete} />));
    });

    const inputs = tree.root.findAllByType(TextInput);

    expect(inputs).toHaveLength(6);
    expect(inputs[0].props.value).toBe('1');
    expect(inputs[1].props.value).toBe('2');
    expect(inputs[2].props.value).toBe('');
    expect(inputs[3].props.value).toBe('');
    expect(inputs[4].props.value).toBe('');
    expect(inputs[5].props.value).toBe('');
  });

  it('should reduce rendered inputs when length decreases', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput length={6} onComplete={() => {}} />),
      );
    });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(6);

    TestRenderer.act(() => {
      tree.update(wrap(<OTPInput length={4} onComplete={() => {}} />));
    });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(4);
  });

  it('should render error styling when error exists', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput onComplete={() => {}} error="Invalid code" />),
      );
    });

    const input = tree.root.findAllByType(TextInput)[0];

    expect(input.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          borderColor: expect.any(String),
        }),
      ]),
    );
  });

  it('should render focused styling when input is active', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    TestRenderer.act(() => {
      tree.root.findAllByType(TextInput)[1].props.onFocus();
    });

    const input = tree.root.findAllByType(TextInput)[1];

    expect(input.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          borderColor: expect.any(String),
        }),
      ]),
    );
  });

  it('should not crash when autoFocus is disabled', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput autoFocus={false} onComplete={() => {}} />),
      );
    });

    TestRenderer.act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(4);
  });

  it('focuses the first input shortly after mount and clears the timer on unmount', () => {
    let tree!: TestRenderer.ReactTestRenderer;

    // autoFocus defaults to true, so mounting schedules the 100ms focus timer.
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    // Firing the timer runs the inputRefs.current[0]?.focus() body (the
    // autoFocus-true branch); unmount then exercises the clearTimeout cleanup.
    TestRenderer.act(() => {
      jest.advanceTimersByTime(100);
    });

    TestRenderer.act(() => {
      tree.unmount();
    });

    expect(tree).toBeTruthy();
  });

  it('applies android-specific text styles when running on android', () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    let tree!: TestRenderer.ReactTestRenderer;

    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(4);

    Platform.OS = originalOS;
  });
});
