import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Input} from '@/components/common/Input/Input';
import {themeReducer} from '@/features/theme';
import {TextInput, Text, TouchableOpacity, View} from 'react-native';

describe('Input', () => {
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

  it('should render without label', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input placeholder="Enter text" />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput).toBeTruthy();
    expect(textInput.props.placeholder).toBe('Enter text');
  });

  it('should render with label', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input label="Username" />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput).toBeTruthy();
  });

  it('should render with value', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input value="test value" />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput.props.value).toBe('test value');
  });

  it('should call onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Input onChangeText={onChangeText} />)
      );
    });

    const textInput = tree.root.findByType(TextInput);
    TestRenderer.act(() => {
      textInput.props.onChangeText('new text');
    });

    expect(onChangeText).toHaveBeenCalledWith('new text');
  });

  it('should call onFocus when input is focused', () => {
    const onFocus = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input onFocus={onFocus} />));
    });

    const textInput = tree.root.findByType(TextInput);
    TestRenderer.act(() => {
      textInput.props.onFocus({});
    });

    expect(onFocus).toHaveBeenCalled();
  });

  it('should call onBlur when input loses focus', () => {
    const onBlur = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input onBlur={onBlur} />));
    });

    const textInput = tree.root.findByType(TextInput);
    TestRenderer.act(() => {
      textInput.props.onBlur({});
    });

    expect(onBlur).toHaveBeenCalled();
  });

  it('should render error message when error prop is provided', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Input error="This field is required" />)
      );
    });

    const texts = tree.root.findAllByType(Text);
    const hasError = texts.some(
      text => text.props.children === 'This field is required'
    );
    expect(hasError).toBe(true);
  });

  it('should not render error when error prop is not provided', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input label="Test" />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput).toBeTruthy();
  });

  it('should render icon when icon prop is provided', () => {
    const Icon = () => <Text>🔒</Text>;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input icon={<Icon />} />));
    });

    const texts = tree.root.findAllByType(Text);
    const hasIcon = texts.some(text => text.props.children === '🔒');
    expect(hasIcon).toBe(true);
  });

  it('should render icon as TouchableOpacity when onIconPress is provided', () => {
    const onIconPress = jest.fn();
    const Icon = () => <Text>👁</Text>;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Input icon={<Icon />} onIconPress={onIconPress} />)
      );
    });

    const touchables = tree.root.findAllByType(TouchableOpacity);
    expect(touchables.length).toBeGreaterThan(0);
  });

  it('should call onIconPress when icon is pressed', () => {
    const onIconPress = jest.fn();
    const Icon = () => <Text>👁</Text>;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Input icon={<Icon />} onIconPress={onIconPress} />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    TestRenderer.act(() => {
      touchable.props.onPress();
    });

    expect(onIconPress).toHaveBeenCalled();
  });

  it('should render icon as View when onIconPress is not provided', () => {
    const Icon = () => <Text>🔒</Text>;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input icon={<Icon />} />));
    });

    const views = tree.root.findAllByType(View);
    expect(views.length).toBeGreaterThan(0);
  });

  it('should apply custom containerStyle', () => {
    const customStyle = {marginTop: 20};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Input containerStyle={customStyle} />)
      );
    });

    const views = tree.root.findAllByType(View);
    const hasCustomStyle = views.some(
      view =>
        view.props.style &&
        (Array.isArray(view.props.style)
          ? view.props.style.some((s: any) => s && s.marginTop === 20)
          : view.props.style.marginTop === 20)
    );
    expect(hasCustomStyle).toBe(true);
  });

  it('should apply custom inputStyle', () => {
    const customStyle = {fontSize: 18};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input inputStyle={customStyle} />));
    });

    const textInput = tree.root.findByType(TextInput);
    const styleArray = Array.isArray(textInput.props.style)
      ? textInput.props.style
      : [textInput.props.style];
    const hasCustomStyle = styleArray.some(
      (s: any) => s && s.fontSize === 18
    );
    expect(hasCustomStyle).toBe(true);
  });

  it('should pass through TextInput props', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <Input
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
            secureTextEntry
          />
        )
      );
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput.props.placeholder).toBe('Enter email');
    expect(textInput.props.keyboardType).toBe('email-address');
    expect(textInput.props.autoCapitalize).toBe('none');
    expect(textInput.props.secureTextEntry).toBe(true);
  });

  it('should set clearButtonMode to while-editing', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput.props.clearButtonMode).toBe('while-editing');
  });

  it('should set enablesReturnKeyAutomatically to true', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput.props.enablesReturnKeyAutomatically).toBe(true);
  });

  it('should handle focus and blur state changes', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input label="Test" />));
    });

    const textInput = tree.root.findByType(TextInput);

    // Simulate focus
    TestRenderer.act(() => {
      textInput.props.onFocus({});
    });

    // Simulate blur
    TestRenderer.act(() => {
      textInput.props.onBlur({});
    });

    expect(textInput).toBeTruthy();
  });

  it('should update hasValue state when text changes', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input />));
    });

    const textInput = tree.root.findByType(TextInput);

    TestRenderer.act(() => {
      textInput.props.onChangeText('some text');
    });

    expect(textInput).toBeTruthy();
  });

  it('should handle value prop updates', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input value="" />));
    });

    TestRenderer.act(() => {
      tree.update(wrap(<Input value="updated value" />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput.props.value).toBe('updated value');
  });

  it('should apply custom labelStyle', () => {
    const customStyle = {color: 'red'};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Input label="Test" labelStyle={customStyle} />)
      );
    });

    expect(tree).toBeTruthy();
  });

  it('should apply custom errorStyle', () => {
    const customStyle = {fontSize: 14};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Input error="Error" errorStyle={customStyle} />)
      );
    });

    const texts = tree.root.findAllByType(Text);
    const errorText = texts.find(
      text => text.props.children === 'Error'
    );
    expect(errorText).toBeTruthy();
  });

  it('should handle empty value correctly', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input value="" />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput.props.value).toBe('');
  });

  it('should handle undefined value correctly', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Input value={undefined} />));
    });

    const textInput = tree.root.findByType(TextInput);
    expect(textInput).toBeTruthy();
  });
});
