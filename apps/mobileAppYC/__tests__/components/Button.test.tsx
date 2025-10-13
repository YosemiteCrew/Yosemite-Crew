import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Button} from '@/components/common/Button/Button';
import {themeReducer} from '@/features/theme';
import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';

describe('Button', () => {
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

  it('should render with title', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Button title="Click Me" onPress={() => {}} />));
    });
    expect(tree.root.findByType(Text).props.children).toBe('Click Me');
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Button title="Click Me" onPress={onPress} />));
    });
    const touchable = tree.root.findByType(TouchableOpacity);
    touchable.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Button title="Click Me" onPress={onPress} disabled />));
    });
    const touchable = tree.root.findByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(true);
  });

  it('should not call onPress when loading', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Button title="Click Me" onPress={onPress} loading />));
    });
    const touchable = tree.root.findByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(true);
  });

  it('should show loading indicator when loading', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Button title="Click Me" onPress={() => {}} loading />));
    });
    expect(tree.root.findByType(ActivityIndicator)).toBeTruthy();
  });

  it('should render with different variants', () => {
    const variants: Array<'primary' | 'secondary' | 'outline' | 'ghost'> = [
      'primary',
      'secondary',
      'outline',
      'ghost',
    ];

    variants.forEach(variant => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(wrap(
          <Button title={`${variant} Button`} onPress={() => {}} variant={variant} />
        ));
      });
      expect(tree.root.findByType(Text).props.children).toBe(`${variant} Button`);
    });
  });

  it('should render with different sizes', () => {
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

    sizes.forEach(size => {
      let tree!: TestRenderer.ReactTestRenderer;
      TestRenderer.act(() => {
        tree = TestRenderer.create(wrap(
          <Button title={`${size} Button`} onPress={() => {}} size={size} />
        ));
      });
      expect(tree.root.findByType(Text).props.children).toBe(`${size} Button`);
    });
  });

  it('should apply custom style', () => {
    const customStyle = {backgroundColor: 'red'};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(
        <Button title="Styled Button" onPress={() => {}} style={customStyle} />
      ));
    });
    const touchable = tree.root.findByType(TouchableOpacity);
    const styleArray = Array.isArray(touchable.props.style) ? touchable.props.style : [touchable.props.style];
    const hasCustom = styleArray.some((s: any) => s && s.backgroundColor === 'red');
    expect(hasCustom).toBe(true);
  });

  it('should apply custom textStyle', () => {
    const customTextStyle = {fontSize: 20};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(
        <Button title="Styled Text" onPress={() => {}} textStyle={customTextStyle} />
      ));
    });
    const text = tree.root.findByType(Text);
    const styleArray = Array.isArray(text.props.style) ? text.props.style : [text.props.style];
    const hasCustom = styleArray.some((s: any) => s && s.fontSize === 20);
    expect(hasCustom).toBe(true);
  });

  it('should use default variant when not specified', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Button title="Default" onPress={() => {}} />));
    });
    expect(tree.root.findByType(Text).props.children).toBe('Default');
  });

  it('should use default size when not specified', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(wrap(<Button title="Default" onPress={() => {}} />));
    });
    expect(tree.root.findByType(Text).props.children).toBe('Default');
  });
});
