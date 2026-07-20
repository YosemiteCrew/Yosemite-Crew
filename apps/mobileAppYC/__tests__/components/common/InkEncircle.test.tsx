import React from 'react';
import {render} from '@testing-library/react-native';

import {InkEncircle} from '../../../src/shared/components/common/InkEncircle/InkEncircle';

describe('InkEncircle', () => {
  it('renders the encircle container and svg ellipse', () => {
    const {getByTestId} = render(
      <InkEncircle width={200} height={160} testID="enc" />,
    );
    expect(getByTestId('enc')).toBeTruthy();
  });

  it('is non-interactive so it never blocks touches', () => {
    const {getByTestId} = render(
      <InkEncircle width={200} height={160} testID="enc" />,
    );
    expect(getByTestId('enc').props.pointerEvents).toBe('none');
  });

  it('accepts custom colour, stroke width and timing overrides', () => {
    const {getByTestId} = render(
      <InkEncircle
        width={120}
        height={120}
        color="#123456"
        strokeWidth={3}
        duration={500}
        delay={100}
        testID="enc-custom"
      />,
    );
    expect(getByTestId('enc-custom')).toBeTruthy();
  });
});
