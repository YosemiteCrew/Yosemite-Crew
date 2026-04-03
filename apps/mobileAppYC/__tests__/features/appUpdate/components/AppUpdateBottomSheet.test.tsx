import React from 'react';
import {render} from '@testing-library/react-native';
import AppUpdateBottomSheet from '@/features/appUpdate/components/AppUpdateBottomSheet';

const mockConfirmActionBottomSheet = jest.fn();

jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const mockReact = require('react');
    return {
      __esModule: true,
      default: mockReact.forwardRef((_props: any, _ref) => {
        mockConfirmActionBottomSheet(_props);
        return null;
      }),
    };
  },
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AppUpdateBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call onDeferred on initial closed state', () => {
    const onDeferred = jest.fn();

    render(
      <AppUpdateBottomSheet
        prompt={{
          kind: 'optional',
          storeUrl:
            'https://play.google.com/store/apps/details?id=com.mobileappyc',
          remindAfterHours: 1,
          currentVersion: '1.0.0',
          currentBuildNumber: 1,
        }}
        onDeferred={onDeferred}
      />,
    );

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    props.onSheetChange?.(-1);

    expect(onDeferred).not.toHaveBeenCalled();
  });

  it('calls onDeferred when optional sheet closes after opening', () => {
    const onDeferred = jest.fn();

    render(
      <AppUpdateBottomSheet
        prompt={{
          kind: 'optional',
          storeUrl:
            'https://play.google.com/store/apps/details?id=com.mobileappyc',
          remindAfterHours: 1,
          currentVersion: '1.0.0',
          currentBuildNumber: 1,
        }}
        onDeferred={onDeferred}
      />,
    );

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    props.onSheetChange?.(0);
    props.onSheetChange?.(-1);

    expect(onDeferred).toHaveBeenCalledTimes(1);
  });
});
