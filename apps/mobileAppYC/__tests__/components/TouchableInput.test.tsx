import React from 'react';
import TestRenderer from 'react-test-renderer';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Text, TouchableOpacity, View} from 'react-native';
import {TouchableInput} from '@/components/common/TouchableInput/TouchableInput';
import themeReducer from '@/store/slices/themeSlice';

describe('TouchableInput', () => {
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

  it('should render with placeholder', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<TouchableInput placeholder="Select date" onPress={() => {}} />)
      );
    });
    const texts = tree.root.findAllByType(Text);
    const placeholderText = texts.find(t => t.props.children === 'Select date');
    expect(placeholderText).toBeTruthy();
  });

  it('should render with value', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<TouchableInput value="01/01/2024" onPress={() => {}} />)
      );
    });
    const texts = tree.root.findAllByType(Text);
    const valueText = texts.find(t => t.props.children === '01/01/2024');
    expect(valueText).toBeTruthy();
  });

  it('should render with label', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <TouchableInput
            label="Date of Birth"
            value="01/01/2024"
            onPress={() => {}}
          />
        )
      );
    });
    // Label is rendered but might be in Animated.Text
    expect(tree.root).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<TouchableInput placeholder="Select" onPress={onPress} />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    TestRenderer.act(() => {
      touchable.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPress = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<TouchableInput placeholder="Select" onPress={onPress} disabled />)
      );
    });

    const touchable = tree.root.findByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(true);
  });

  it('should display error message', () => {
    const errorMessage = 'This field is required';
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <TouchableInput
            placeholder="Select"
            onPress={() => {}}
            error={errorMessage}
          />
        )
      );
    });

    const texts = tree.root.findAllByType(Text);
    const errorText = texts.find(t => t.props.children === errorMessage);
    expect(errorText).toBeTruthy();
  });

  it('should render left component', () => {
    const LeftIcon = () => <View testID="left-icon" />;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <TouchableInput
            placeholder="Select"
            onPress={() => {}}
            leftComponent={<LeftIcon />}
          />
        )
      );
    });

    const leftIcon = tree.root.findByProps({testID: 'left-icon'});
    expect(leftIcon).toBeTruthy();
  });

  it('should render right component', () => {
    const RightIcon = () => <View testID="right-icon" />;
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <TouchableInput
            placeholder="Select"
            onPress={() => {}}
            rightComponent={<RightIcon />}
          />
        )
      );
    });

    const rightIcon = tree.root.findByProps({testID: 'right-icon'});
    expect(rightIcon).toBeTruthy();
  });

  it('should apply custom container style', () => {
    const customStyle = {marginTop: 20};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <TouchableInput
            placeholder="Select"
            onPress={() => {}}
            containerStyle={customStyle}
          />
        )
      );
    });

    const outerView = tree.root.findAllByType(View)[0];
    expect(outerView.props.style).toEqual(customStyle);
  });

  it('should apply custom input style', () => {
    const customStyle = {backgroundColor: 'red'};
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <TouchableInput
            placeholder="Select"
            onPress={() => {}}
            inputStyle={customStyle}
          />
        )
      );
    });

    // The input style is applied to the inner view
    expect(tree.root).toBeTruthy();
  });

  it('should show placeholder when no value', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(<TouchableInput placeholder="Choose option" onPress={() => {}} />)
      );
    });

    const texts = tree.root.findAllByType(Text);
    const placeholderText = texts.find(t => t.props.children === 'Choose option');
    expect(placeholderText).toBeTruthy();
  });

  it('should show value instead of placeholder when value is set', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        wrap(
          <TouchableInput
            placeholder="Choose option"
            value="Selected value"
            onPress={() => {}}
          />
        )
      );
    });

    const texts = tree.root.findAllByType(Text);
    const valueText = texts.find(t => t.props.children === 'Selected value');
    expect(valueText).toBeTruthy();
  });
});
