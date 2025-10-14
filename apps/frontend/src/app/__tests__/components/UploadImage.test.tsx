import React from 'react';
import { render } from '@testing-library/react';
import UploadImage from '@/app/components/UploadImage/UploadImage';

describe('UploadImage Component', () => {
  test('should render without crashing', () => {
    render(<UploadImage />);
  });
});