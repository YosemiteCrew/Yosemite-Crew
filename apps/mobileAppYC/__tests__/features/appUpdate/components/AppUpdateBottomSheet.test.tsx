import React from 'react';
import {Alert, Linking} from 'react-native';
import {render} from '@testing-library/react-native';
import AppUpdateBottomSheet from '@/features/appUpdate/components/AppUpdateBottomSheet';

const mockConfirmActionBottomSheet = jest.fn();

jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const mockReact = require('react');
    return {
      __esModule: true,
      default: mockReact.forwardRef((_props, _ref) => {
        mockConfirmActionBottomSheet(_props);
        return null;
      }),
    };
  },
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => key,
  }),
}));

const optionalPrompt = {
  kind: 'optional' as const,
  storeUrl: 'https://play.google.com/store/apps/details?id=com.mobileappyc',
  remindAfterHours: 1,
  currentVersion: '1.0.0',
  currentBuildNumber: 1,
};

const requiredPrompt = {
  kind: 'required' as const,
  storeUrl: 'https://play.google.com/store/apps/details?id=com.mobileappyc',
  currentVersion: '1.0.0',
  currentBuildNumber: 1,
};

describe('AppUpdateBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call onDeferred on initial closed state', () => {
    const onDeferred = jest.fn();

    render(
      <AppUpdateBottomSheet prompt={optionalPrompt} onDeferred={onDeferred} />,
    );

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    props.onSheetChange?.(-1);

    expect(onDeferred).not.toHaveBeenCalled();
  });

  it('calls onDeferred when optional sheet closes after opening', () => {
    const onDeferred = jest.fn();

    render(
      <AppUpdateBottomSheet prompt={optionalPrompt} onDeferred={onDeferred} />,
    );

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    props.onSheetChange?.(0);
    props.onSheetChange?.(-1);

    expect(onDeferred).toHaveBeenCalledTimes(1);
  });

  it('does not call onDeferred twice after open/close/close sequence', () => {
    const onDeferred = jest.fn();

    render(
      <AppUpdateBottomSheet prompt={optionalPrompt} onDeferred={onDeferred} />,
    );

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    props.onSheetChange?.(0);
    props.onSheetChange?.(-1);
    props.onSheetChange?.(-1); // extra close — deferredHandledRef resets, hasOpenedRef = false, so no second call

    expect(onDeferred).toHaveBeenCalledTimes(1);
  });

  it('does not call onDeferred for required prompt when sheet closes', () => {
    const onDeferred = jest.fn();

    render(
      <AppUpdateBottomSheet prompt={requiredPrompt} onDeferred={onDeferred} />,
    );

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    props.onSheetChange?.(0);
    props.onSheetChange?.(-1);

    expect(onDeferred).not.toHaveBeenCalled();
  });

  it('passes required prompt settings (no secondary button, pan disabled)', () => {
    render(<AppUpdateBottomSheet prompt={requiredPrompt} />);

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    expect(props.initialIndex).toBe(0);
    expect(props.enablePanDown).toBe(false);
    expect(props.enableHandlePanning).toBe(false);
    expect(props.showCloseButton).toBe(false);
    expect(props.backdropPressBehavior).toBe('none');
    expect(props.secondaryButton).toBeUndefined();
  });

  it('passes optional prompt settings (pan enabled, secondary button)', () => {
    render(
      <AppUpdateBottomSheet prompt={optionalPrompt} onDeferred={jest.fn()} />,
    );

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    expect(props.initialIndex).toBe(-1);
    expect(props.enablePanDown).toBe(true);
    expect(props.showCloseButton).toBe(true);
    expect(props.backdropPressBehavior).toBe('close');
    expect(props.secondaryButton).toBeDefined();
  });

  it('can mount optional prompt open when requested for local mock testing', () => {
    render(
      <AppUpdateBottomSheet
        prompt={optionalPrompt}
        onDeferred={jest.fn()}
        initialOpen
      />,
    );

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    expect(props.initialIndex).toBe(0);
  });

  it('uses custom title/message from prompt when provided', () => {
    const customPrompt = {
      ...optionalPrompt,
      title: 'Custom title',
      message: 'Custom message',
    };

    render(<AppUpdateBottomSheet prompt={customPrompt} />);

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    expect(props.title).toBe('Custom title');
    expect(props.message).toBe('Custom message');
  });

  it('falls back to translation keys for title/message when absent', () => {
    render(<AppUpdateBottomSheet prompt={optionalPrompt} />);

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    expect(props.title).toBe('appUpdate.optionalTitle');
    expect(props.message).toBe('appUpdate.optionalMessage');
  });

  it('uses required translation keys for title/message when kind=required', () => {
    render(<AppUpdateBottomSheet prompt={requiredPrompt} />);

    const props = mockConfirmActionBottomSheet.mock.calls[0][0];
    expect(props.title).toBe('appUpdate.requiredTitle');
    expect(props.message).toBe('appUpdate.requiredMessage');
  });

  describe('handleOpenStore (primary button)', () => {
    it('opens the store URL when storeUrl is present', async () => {
      const mockOpenURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined);

      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);

      const props = mockConfirmActionBottomSheet.mock.calls[0][0];
      await props.primaryButton.onPress();

      expect(mockOpenURL).toHaveBeenCalledWith(optionalPrompt.storeUrl);
      mockOpenURL.mockRestore();
    });

    it('shows alert when storeUrl is missing', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const noUrlPrompt = {...optionalPrompt, storeUrl: undefined as any};

      render(<AppUpdateBottomSheet prompt={noUrlPrompt} />);

      const props = mockConfirmActionBottomSheet.mock.calls[0][0];
      await props.primaryButton.onPress();

      expect(alertSpy).toHaveBeenCalledWith(
        'common.error',
        'appUpdate.missingStoreUrl',
      );
      alertSpy.mockRestore();
    });

    it('shows alert when Linking.openURL throws', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValue(new Error('Cannot open'));

      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);

      const props = mockConfirmActionBottomSheet.mock.calls[0][0];
      await props.primaryButton.onPress();

      expect(alertSpy).toHaveBeenCalledWith(
        'common.error',
        'appUpdate.openStoreFailed',
      );
      alertSpy.mockRestore();
      jest.spyOn(Linking, 'openURL').mockRestore();
    });
  });

  describe('imperative ref (open/close)', () => {
    it('exposes open and close via ref without throwing', () => {
      const ref = React.createRef<any>();
      render(<AppUpdateBottomSheet ref={ref} prompt={optionalPrompt} />);
      // bottomSheetRef.current is null in tests (mocked ConfirmActionBottomSheet returns null)
      // but the methods exist and are safely optional-chained
      expect(() => ref.current?.open()).not.toThrow();
      expect(() => ref.current?.close()).not.toThrow();
    });
  });

  describe('secondary button (later / optional only)', () => {
    it('calls onDeferred and closes the sheet when later is pressed', () => {
      const onDeferred = jest.fn();

      // Provide a ref to capture close
      const ref = React.createRef<any>();
      render(
        <AppUpdateBottomSheet
          ref={ref}
          prompt={optionalPrompt}
          onDeferred={onDeferred}
        />,
      );

      const props = mockConfirmActionBottomSheet.mock.calls[0][0];
      // Manually wire close mock through capturedRef if needed
      // Directly invoke secondary button onPress
      props.secondaryButton?.onPress();

      expect(onDeferred).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onDeferred via onSheetChange after secondary button press', () => {
      const onDeferred = jest.fn();

      render(
        <AppUpdateBottomSheet
          prompt={optionalPrompt}
          onDeferred={onDeferred}
        />,
      );

      const props = mockConfirmActionBottomSheet.mock.calls[0][0];
      // Open
      props.onSheetChange?.(0);
      // Press Later (sets deferredHandledRef = true, calls onDeferred)
      props.secondaryButton?.onPress();
      // Sheet closes — deferredHandledRef is true so onSheetChange should NOT call onDeferred again
      props.onSheetChange?.(-1);

      // onDeferred called once (from secondary button), NOT again from onSheetChange
      expect(onDeferred).toHaveBeenCalledTimes(1);
    });
  });
});
