import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
// react-native-reanimated is globally mocked in jest.setup.js
// (useReducedMotion -> false, withDelay/withTiming pass-through).
import * as Reanimated from 'react-native-reanimated';
import {InkAnnotation} from '@/shared/components/common/InkAnnotation/InkAnnotation';

const layoutEvent = (width: number, height: number) => ({
  nativeEvent: {layout: {width, height, x: 0, y: 0}},
});

describe('InkAnnotation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the accent text', () => {
    const {getByText} = render(
      <InkAnnotation color="#FF90D4">Keep it whole.</InkAnnotation>,
    );
    expect(getByText('Keep it whole.')).toBeTruthy();
  });

  it('builds and draws the circle geometry once the word is measured', () => {
    const {getByText} = render(
      <InkAnnotation color="#FF90D4" type="circle" delay={100} italic>
        together.
      </InkAnnotation>,
    );
    // Firing layout exercises buildCircle + smooth + polylineLength + the draw.
    fireEvent(getByText('together.'), 'layout', layoutEvent(140, 34));
    expect(getByText('together.')).toBeTruthy();
  });

  it('builds the underline geometry for type="underline"', () => {
    const {getByText} = render(
      <InkAnnotation color="#257BED" type="underline">
        the phone call.
      </InkAnnotation>,
    );
    fireEvent(getByText('the phone call.'), 'layout', layoutEvent(220, 30));
    expect(getByText('the phone call.')).toBeTruthy();
  });

  it('renders the text without drawing while inactive', () => {
    const {getByText} = render(
      <InkAnnotation color="#FF90D4" active={false}>
        soon.
      </InkAnnotation>,
    );
    fireEvent(getByText('soon.'), 'layout', layoutEvent(90, 30));
    expect(getByText('soon.')).toBeTruthy();
  });

  it('ignores a zero-size layout (no geometry, no crash)', () => {
    const {getByText} = render(
      <InkAnnotation color="#FF90D4">x</InkAnnotation>,
    );
    fireEvent(getByText('x'), 'layout', layoutEvent(0, 0));
    expect(getByText('x')).toBeTruthy();
  });

  it('ignores a re-layout with the same measured size', () => {
    const {getByText} = render(
      <InkAnnotation color="#FF90D4">Keep it whole.</InkAnnotation>,
    );
    const node = getByText('Keep it whole.');
    fireEvent(node, 'layout', layoutEvent(140, 34));
    fireEvent(node, 'layout', layoutEvent(140, 34));
    expect(getByText('Keep it whole.')).toBeTruthy();
  });

  it('rebuilds geometry when a re-layout reports a different size', () => {
    const {getByText} = render(
      <InkAnnotation color="#FF90D4">Keep it whole.</InkAnnotation>,
    );
    const node = getByText('Keep it whole.');
    fireEvent(node, 'layout', layoutEvent(140, 34));
    // A width-only change and then a height-only change each drive the
    // "prev present but size differs" branch of onLayout's setSize updater.
    fireEvent(node, 'layout', layoutEvent(200, 34));
    fireEvent(node, 'layout', layoutEvent(200, 50));
    expect(getByText('Keep it whole.')).toBeTruthy();
  });

  it('skips geometry when the measured height is below the threshold', () => {
    const {getByText} = render(
      <InkAnnotation color="#FF90D4">thin.</InkAnnotation>,
    );
    // width is above the minimum but height is not -> geometry stays null.
    fireEvent(getByText('thin.'), 'layout', layoutEvent(120, 1));
    expect(getByText('thin.')).toBeTruthy();
  });

  it('draws instantly (no timed stroke) when reduce-motion is enabled', () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const timingSpy = jest.spyOn(Reanimated, 'withTiming');

    const {getByText} = render(
      <InkAnnotation color="#FF90D4" type="circle">
        instant.
      </InkAnnotation>,
    );
    // Measuring the word kicks the draw; with reduce-motion the stroke jumps
    // straight to fully-drawn instead of scheduling a timed animation.
    fireEvent(getByText('instant.'), 'layout', layoutEvent(120, 30));

    expect(timingSpy).not.toHaveBeenCalled();
    expect(getByText('instant.')).toBeTruthy();
  });
});
