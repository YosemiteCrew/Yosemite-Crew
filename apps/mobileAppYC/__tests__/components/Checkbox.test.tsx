import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {themeReducer} from '@/features/theme';
import {TouchableOpacity, Text} from 'react-native';

describe('Checkbox', () => {
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

  it('should render unchecked checkbox', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={false} onValueChange={onValueChange} />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    expect(touchable).toBeTruthy();
  });

  it('should render checked checkbox with checkmark', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={true} onValueChange={onValueChange} />)
      );
    });

    const checkmarks = tree.root.findAllByType(Text);
    const hasCheckmark = checkmarks.some(text => text.props.children === '✓');
    expect(hasCheckmark).toBe(true);
  });

  it('should call onValueChange when pressed', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={false} onValueChange={onValueChange} />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    TestRenderer.act(() => {
      touchable.props.onPress();
    });

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('should toggle value when pressed', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={true} onValueChange={onValueChange} />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    TestRenderer.act(() => {
      touchable.props.onPress();
    });

    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('should render with label', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={false} onValueChange={onValueChange} label="Accept terms" />)
      );
    });

    const labels = tree.root.findAllByType(Text);
    const hasLabel = labels.some(text => text.props.children === 'Accept terms');
    expect(hasLabel).toBe(true);
  });

  it('should not render label when not provided', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={false} onValueChange={onValueChange} />)
      );
    });

    const texts = tree.root.findAllByType(Text);
    // Should only have checkmark text if checked, no label
    expect(texts.length).toBe(0);
  });

  it('should render error message when error prop is provided', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={false} onValueChange={onValueChange} error="This field is required" />)
      );
    });

    const texts = tree.root.findAllByType(Text);
    const hasError = texts.some(text => text.props.children === 'This field is required');
    expect(hasError).toBe(true);
  });

  it('should not render error when error prop is not provided', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={false} onValueChange={onValueChange} label="Test" />)
      );
    });

    const texts = tree.root.findAllByType(Text);
    // Should only have label text
    expect(texts.length).toBe(1);
    expect(texts[0].props.children).toBe('Test');
  });

  it('should render with both label and error', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <Checkbox
            value={false}
            onValueChange={onValueChange}
            label="Accept terms"
            error="You must accept"
          />
        )
      );
    });

    const texts = tree.root.findAllByType(Text);
    const hasLabel = texts.some(text => text.props.children === 'Accept terms');
    const hasError = texts.some(text => text.props.children === 'You must accept');
    expect(hasLabel).toBe(true);
    expect(hasError).toBe(true);
  });

  it('should have correct activeOpacity', () => {
    const onValueChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<Checkbox value={false} onValueChange={onValueChange} />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    expect(touchable.props.activeOpacity).toBe(0.7);
  });
});
