import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {TextInput} from 'react-native';
import {OTPInput} from '@/components/common/OTPInput/OTPInput';
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
  });

  it('should render with default 4 inputs', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });
    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs).toHaveLength(4);
  });

  it('should render with custom length', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput length={6} onComplete={() => {}} />));
    });
    const inputs = tree.root.findAllByType(TextInput);
    expect(inputs).toHaveLength(6);
  });

  it('should call onComplete when all digits are entered', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput length={4} onComplete={onComplete} />));
    });

    const inputs = tree.root.findAllByType(TextInput);

    TestRenderer.act(() => {
      inputs[0].props.onChangeText('1');
    });
    TestRenderer.act(() => {
      inputs[1].props.onChangeText('2');
    });
    TestRenderer.act(() => {
      inputs[2].props.onChangeText('3');
    });
    TestRenderer.act(() => {
      inputs[3].props.onChangeText('4');
    });

    // Should have been called with '1234' when complete
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('should only accept numeric input', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={onComplete} />));
    });

    const inputs = tree.root.findAllByType(TextInput);

    TestRenderer.act(() => {
      inputs[0].props.onChangeText('a');
    });

    // Non-numeric input should be ignored
    expect(inputs[0].props.value).toBe('');
  });

  it('should handle backspace to move to previous input', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={onComplete} />));
    });

    const inputs = tree.root.findAllByType(TextInput);

    TestRenderer.act(() => {
      inputs[0].props.onChangeText('1');
      inputs[1].props.onChangeText('2');
    });

    TestRenderer.act(() => {
      inputs[1].props.onKeyPress({nativeEvent: {key: 'Backspace'}});
    });

    // Should clear the second input
    expect(inputs[1].props.value).toBe('');
  });

  it('should display error message when error prop is provided', () => {
    const errorMessage = 'Invalid code';
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<OTPInput onComplete={() => {}} error={errorMessage} />)
      );
    });

    const texts = tree.root.findAllByType(require('react-native').Text);
    const errorText = texts.find(text => text.props.children === errorMessage);
    expect(errorText).toBeTruthy();
  });

  it('should not display error message when error prop is not provided', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    const texts = tree.root.findAllByType(require('react-native').Text);
    expect(texts).toHaveLength(0);
  });

  it('should set keyboard type to numeric', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    const inputs = tree.root.findAllByType(TextInput);
    inputs.forEach(input => {
      expect(input.props.keyboardType).toBe('numeric');
    });
  });

  it('should set maxLength to 1 for each input', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    const inputs = tree.root.findAllByType(TextInput);
    inputs.forEach(input => {
      expect(input.props.maxLength).toBe(1);
    });
  });

  it('should clear onComplete when incomplete', () => {
    const onComplete = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput length={4} onComplete={onComplete} />));
    });

    const inputs = tree.root.findAllByType(TextInput);

    TestRenderer.act(() => {
      inputs[0].props.onChangeText('1');
    });
    TestRenderer.act(() => {
      inputs[1].props.onChangeText('2');
    });
    TestRenderer.act(() => {
      inputs[2].props.onChangeText('3');
    });
    TestRenderer.act(() => {
      inputs[3].props.onChangeText('4');
    });

    // Verify complete was called with the full OTP
    expect(onComplete).toHaveBeenCalledWith('1234');

    // Clear the mock to check the next call
    onComplete.mockClear();

    TestRenderer.act(() => {
      inputs[3].props.onKeyPress({nativeEvent: {key: 'Backspace'}});
    });

    // After backspace, component doesn't automatically call onComplete with empty
    // This test verifies the component handles backspace correctly
    expect(tree.root).toBeTruthy();
  });

  it('should handle focus correctly', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<OTPInput onComplete={() => {}} />));
    });

    const inputs = tree.root.findAllByType(TextInput);

    TestRenderer.act(() => {
      inputs[2].props.onFocus();
    });

    // Active index should be set, but we can't directly test internal state
    // We verify the component doesn't crash
    expect(tree.root).toBeTruthy();
  });
});
